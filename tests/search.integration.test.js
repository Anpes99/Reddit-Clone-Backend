const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");

jest.mock("../models/index", () => ({
  Post: {},
  Subreddit: {},
  User: {},
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () =>
  jest.requireActual("../utils/middleware/middleware"),
);

jest.mock("../enums/post.enum.js", () => ({
  postsOrderType: { TOP: "TOP", NEW: "NEW" },
}));

jest.mock("../enums/sort-order.enum.js", () => ({
  SortOrder: { ASC: "ASC", DESC: "DESC" },
}));

jest.mock("../enums/subreddit.enum.js", () => ({
  SUBREDDIT_ORDER_BY_TYPES: { MEMBER_COUNT: "MEMBER_COUNT" },
}));

jest.mock("../utils/embeddings", () => ({
  generateEmbedding: jest.fn(),
}));

jest.mock("../websockets/onlineCount", () => ({
  getOnlineSubredditUserCount: jest.fn(),
}));

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../utils/db");
const { generateEmbedding } = require("../utils/embeddings");
const searchRouter = require("../controllers/search");

sequelize.options.logging = false;

const app = express();
app.use(express.json());
app.use(searchRouter);

let server;
let fixtureUserId;
let fixtureSubredditId;
let queryVector;
let exactMatchPostId;

const searchPosts = (payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path: "/posts",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
      },
      (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          responseBody += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        });
      },
    );

    request.on("error", reject);
    request.end(body);
  });

const insertPost = async ({ title, embedding, userId, subredditId }) => {
  const [post] = await sequelize.query(
    `INSERT INTO public.posts
      (title, text, user_id, subreddit_id, created_at, updated_at, embedding)
     VALUES
      (:title, :text, :userId, :subredditId, NOW(), NOW(), CAST(:embedding AS vector))
     RETURNING id;`,
    {
      replacements: {
        title,
        text: "Search integration test fixture",
        userId,
        subredditId,
        embedding: `[${embedding.join(",")}]`,
      },
      type: QueryTypes.SELECT,
    },
  );

  return post.id;
};

beforeAll(async () => {
  if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URI) {
    throw new Error(
      "The search integration test requires NODE_ENV=test and TEST_DATABASE_URI.",
    );
  }

  require("../scripts/verify-test-database");
  await sequelize.authenticate();

  const fixtureSuffix = crypto.randomUUID();
  const [user] = await sequelize.query(
    `INSERT INTO public.users
      (username, password_hash, email, email_verified, created_at, updated_at)
     VALUES
      (:username, 'test-password-hash', :email, true, NOW(), NOW())
     RETURNING id;`,
    {
      replacements: {
        username: `search-test-${fixtureSuffix}`,
        email: `search-test-${fixtureSuffix}@example.test`,
      },
      type: QueryTypes.SELECT,
    },
  );
  fixtureUserId = user.id;

  const [subreddit] = await sequelize.query(
    `INSERT INTO public.subreddits
      (name, description, creator_id, created_at, updated_at)
     VALUES
      (:name, 'Search integration test fixture', :creatorId, NOW(), NOW())
     RETURNING id;`,
    {
      replacements: {
        name: `search-test-${fixtureSuffix}`,
        creatorId: fixtureUserId,
      },
      type: QueryTypes.SELECT,
    },
  );
  fixtureSubredditId = subreddit.id;

  queryVector = Array.from(
    crypto.randomBytes(512),
    (value) => (value - 127.5) / 127.5,
  );
  exactMatchPostId = await insertPost({
    title: `Exact semantic match ${fixtureSuffix}`,
    embedding: queryVector,
    userId: fixtureUserId,
    subredditId: fixtureSubredditId,
  });
  await insertPost({
    title: `Distant semantic match ${fixtureSuffix}`,
    embedding: queryVector.map((value) => -value),
    userId: fixtureUserId,
    subredditId: fixtureSubredditId,
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  try {
    if (fixtureUserId) {
      await sequelize.query(
        "DELETE FROM public.posts WHERE user_id = :userId",
        {
          replacements: { userId: fixtureUserId },
        },
      );
    }
    if (fixtureSubredditId) {
      await sequelize.query(
        "DELETE FROM public.subreddits WHERE id = :subredditId",
        { replacements: { subredditId: fixtureSubredditId } },
      );
    }
    if (fixtureUserId) {
      await sequelize.query("DELETE FROM public.users WHERE id = :userId", {
        replacements: { userId: fixtureUserId },
      });
    }
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await sequelize.close();
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  generateEmbedding.mockResolvedValue(queryVector);
});

test("top post search ranks the exact vector match first in PostgreSQL", async () => {
  const response = await searchPosts({
    searchQuery: "semantic test query",
    offset: 0,
    limit: 1,
    orderType: "TOP",
  });

  expect(response.statusCode).toBe(200);
  expect(generateEmbedding).toHaveBeenCalledWith(
    "'semantic test query'",
    "query",
  );
  expect(response.body.posts).toHaveLength(1);
  expect(response.body.posts[0].id).toBe(exactMatchPostId);
  expect(response.body.posts[0].title).toMatch(/^Exact semantic match /);
  expect(response.body.posts[0].similarity).toBeCloseTo(1, 6);
  expect(response.body.posts[0]).not.toHaveProperty("embedding");
  expect(Number(response.body.totalCount)).toBeGreaterThanOrEqual(2);
  expect(response.body.searchWordEmbedding).toBe(`[${queryVector.join(",")}]`);
});
