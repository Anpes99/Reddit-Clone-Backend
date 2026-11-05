import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";

jest.mock("pgvector/sequelize", () => {
  const { DataTypes } =
    jest.requireActual<typeof import("sequelize")>("sequelize");
  (DataTypes as unknown as { VECTOR: () => unknown }).VECTOR = () =>
    DataTypes.STRING;
  return {};
});

jest.mock("../constants/subreddit.constant", () => ({
  SUBREDDIT_ORDER_BY_TYPES: { MEMBER_COUNT: "MEMBER_COUNT" },
  SUBREDDIT_MODERATOR_ROLE: {
    OWNER: "owner",
    MODERATOR: "moderator",
    MODERATOR_LIMITED: "moderator_limited",
  },
  SUBREDDIT_PERMISSIONS: {
    POSTS_MANAGE: "posts.manage",
    USERS_MANAGE: "users.manage",
    SETTINGS_MANAGE: "settings.manage",
    MODERATORS_MANAGE: "moderators.manage",
  },
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () =>
  jest.requireActual("../utils/middleware/middleware"),
);

jest.mock("../constants/post.constant.js", () => ({
  POSTS_ORDER_TYPE: { TOP: "TOP", NEW: "NEW" },
  POST_MODERATION_STATUS: {
    PENDING: "pending",
    COMPLETED: "completed",
    FAILED: "failed",
    REVIEW_REQUIRED: "review_required",
  },
}));

jest.mock("../constants/sort-order.constant.js", () => ({
  SORT_ORDER: { ASC: "ASC", DESC: "DESC" },
}));

jest.mock("../utils/embeddings", () => ({
  generateEmbedding: jest.fn(),
}));

jest.mock("../websockets/onlineCount", () => ({
  getOnlineSubredditUserCount: jest.fn(() => 0),
}));

import { QueryTypes } from "sequelize";
import { disableQueryLogging, sequelize } from "../utils/db";
import searchRouter from "../controllers/search";

disableQueryLogging();

const app = express();
app.use(express.json());
app.use(searchRouter);

type TestResponse = {
  statusCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

let server: http.Server;
let fixtureUserId: number;
const fixtureSubredditIds: number[] = [];
let exactMatchName: string;
let nearMatchName: string;

const searchSubreddits = (payload: unknown) =>
  new Promise<TestResponse>((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        host: "127.0.0.1",
        port: (server.address() as AddressInfo).port,
        path: "/subreddits",
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
        response.on("data", (chunk: string) => {
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

const insertSubreddit = async ({
  name,
  memberCount,
}: {
  name: string;
  memberCount: number;
}) => {
  const [subreddit] = await sequelize.query<{ id: number }>(
    `INSERT INTO public.subreddits
      (name, description, creator_id, member_count, created_at, updated_at)
     VALUES
      (:name, 'Subreddit search integration fixture', :creatorId,
       :memberCount, NOW(), NOW())
     RETURNING id;`,
    {
      replacements: { name, creatorId: fixtureUserId, memberCount },
      type: QueryTypes.SELECT,
    },
  );
  fixtureSubredditIds.push(subreddit.id);
};

beforeAll(async () => {
  if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URI) {
    throw new Error(
      "The subreddit search integration test requires NODE_ENV=test and TEST_DATABASE_URI.",
    );
  }

  jest.requireActual("../scripts/verify-test-database");
  await sequelize.authenticate();

  const fixtureSuffix = crypto.randomUUID();
  const [user] = await sequelize.query<{ id: number }>(
    `INSERT INTO public.users
      (username, password_hash, email, email_verified, created_at, updated_at)
     VALUES
      (:username, 'subreddit-search-test-password-hash', :email, true,
       NOW(), NOW())
     RETURNING id;`,
    {
      replacements: {
        username: `subreddit-search-${fixtureSuffix}`,
        email: `subreddit-search-${fixtureSuffix}@example.test`,
      },
      type: QueryTypes.SELECT,
    },
  );
  fixtureUserId = user.id;

  exactMatchName = `cobalt-nebula-${fixtureSuffix}`;
  nearMatchName = `cobalt-nebulae-${fixtureSuffix}`;
  await insertSubreddit({ name: exactMatchName, memberCount: 1 });
  await insertSubreddit({ name: nearMatchName, memberCount: 500 });

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  try {
    if (fixtureSubredditIds.length > 0) {
      await sequelize.query(
        "DELETE FROM public.subreddits WHERE id IN (:ids)",
        { replacements: { ids: fixtureSubredditIds } },
      );
    }
    if (fixtureUserId) {
      await sequelize.query("DELETE FROM public.users WHERE id = :id", {
        replacements: { id: fixtureUserId },
      });
    }
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await sequelize.close();
  }
});

test("ranks a closer subreddit name ahead of a more popular weaker match", async () => {
  const response = await searchSubreddits({
    searchQuery: "cobalt nebula",
    offset: 0,
    limit: 100,
  });

  expect(response.statusCode).toBe(200);
  expect(Number(response.body.totalCount)).toBeGreaterThanOrEqual(2);

  const resultNames = response.body.subreddits.map(
    (subreddit: { name: string }) => subreddit.name,
  );
  const exactMatchIndex = resultNames.indexOf(exactMatchName);
  const nearMatchIndex = resultNames.indexOf(nearMatchName);

  expect(exactMatchIndex).toBeGreaterThanOrEqual(0);
  expect(nearMatchIndex).toBeGreaterThanOrEqual(0);
  expect(exactMatchIndex).toBeLessThan(nearMatchIndex);
  expect(response.body.subreddits[nearMatchIndex].memberCount).toBe(500);
});
