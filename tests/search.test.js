const http = require("node:http");
const express = require("express");
const { Op, QueryTypes } = require("sequelize");

jest.mock("../models/index", () => ({
  Post: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Subreddit: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  User: {},
}));

jest.mock("../utils/db", () => ({
  sequelize: {
    query: jest.fn(),
    escape: jest.fn((value) => `'${value}'`),
    fn: jest.fn((...args) => ({ functionName: args[0], args: args.slice(1) })),
    col: jest.fn((column) => ({ column })),
    where: jest.fn((...args) => ({ whereArgs: args })),
  },
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

const { sequelize } = require("../utils/db");
const { generateEmbedding } = require("../utils/embeddings");
const { Post, Subreddit } = require("../models/index");
const { getOnlineSubredditUserCount } = require("../websockets/onlineCount");
const searchRouter = require("../controllers/search");

const app = express();
app.use(express.json());
app.use(searchRouter);

let server;

const searchPosts = (payload) => postJson("/posts", payload);

const searchSubreddits = (payload) => postJson("/subreddits", payload);

const postJson = (path, payload) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
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
            body: JSON.parse(responseBody),
          });
        });
      },
    );

    request.on("error", reject);
    request.end(body);
  });

beforeAll(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

test("top post search returns results in vector relevance order", async () => {
  generateEmbedding.mockResolvedValue([0.11, 0.22, 0.33]);
  sequelize.query.mockResolvedValue([
    {
      id: 101,
      title: "Closest semantic match",
      user_id: 7,
      subreddit_id: 3,
      up_votes: 18,
      down_votes: 1,
      image_url: null,
      comment_count: 4,
      created_at: "2026-10-28T12:00:00.000Z",
      updated_at: "2026-10-28T12:00:00.000Z",
      total_count: 2,
      subreddit_name: "cats",
      subreddit_icon_url: null,
      embedding: [0.1, 0.2, 0.3],
      similarity: 0.94,
    },
    {
      id: 102,
      title: "Next closest semantic match",
      user_id: 8,
      subreddit_id: 4,
      up_votes: 5,
      down_votes: 0,
      image_url: null,
      comment_count: 1,
      created_at: "2026-10-27T12:00:00.000Z",
      updated_at: "2026-10-27T12:00:00.000Z",
      total_count: 2,
      subreddit_name: "pets",
      subreddit_icon_url: null,
      embedding: [0.4, 0.5, 0.6],
      similarity: 0.71,
    },
  ]);

  const response = await searchPosts({
    searchQuery: "Cats",
    offset: 0,
    limit: 10,
    orderType: "TOP",
  });

  expect(response.statusCode).toBe(200);
  expect(generateEmbedding).toHaveBeenCalledWith("'cats'", "query");
  expect(sequelize.query).toHaveBeenCalledWith(
    expect.stringMatching(
      /ORDER BY posts\.embedding <=> CAST\(:searchWordEmbedding AS vector\)/,
    ),
    {
      replacements: {
        searchWordEmbedding: "[0.11,0.22,0.33]",
        limit: 10,
        offset: 0,
      },
      type: QueryTypes.SELECT,
    },
  );
  expect(response.body.posts.map((post) => post.title)).toEqual([
    "Closest semantic match",
    "Next closest semantic match",
  ]);
  expect(response.body.posts[0]).toMatchObject({
    id: 101,
    similarity: 0.94,
    userId: 7,
    subredditId: 3,
    upVotes: 18,
    subreddit: { name: "cats", iconUrl: null },
    totalCount: 2,
  });
  expect(response.body.posts[0]).not.toHaveProperty("embedding");
  expect(response.body.totalCount).toBe(2);
  expect(response.body.searchWordEmbedding).toBe("[0.11,0.22,0.33]");
});

test("new post search returns text matches with pagination and total count", async () => {
  const posts = [{ id: 201, title: "New fox post" }];
  Post.count.mockResolvedValue(3);
  Post.findAll.mockResolvedValue(posts);

  const response = await searchPosts({
    searchQuery: "fox",
    offset: 1,
    limit: 2,
    orderType: "NEW",
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({ posts, totalCount: 3 });
  expect(Post.count).toHaveBeenCalledTimes(1);
  expect(Post.findAll).toHaveBeenCalledTimes(1);

  const options = Post.findAll.mock.calls[0][0];
  expect(options).toMatchObject({
    offset: 1,
    limit: 2,
    order: [["createdAt", "DESC"]],
    include: [
      { model: expect.anything(), attributes: ["username"] },
      { model: expect.anything(), attributes: ["name", "iconUrl"] },
    ],
  });
  expect(options.where[Op.or]).toBeDefined();
  expect(sequelize.fn).toHaveBeenCalledWith(
    "word_similarity",
    "fox",
    expect.objectContaining({ column: "title" }),
  );
  expect(Post.count.mock.calls[0][0]).toMatchObject({
    include: [{ model: expect.anything(), attributes: [] }],
  });
});

test("subreddit search orders matches by similarity and includes online user counts.", async () => {
  const subredditInstances = [
    {
      dataValues: {
        id: 301,
        name: "foxes",
        description: "Fox community",
        memberCount: 12,
        iconUrl: null,
      },
      name: "foxes",
    },
    {
      dataValues: {
        id: 302,
        name: "wildlife",
        description: "Wildlife community",
        memberCount: 8,
        iconUrl: "wildlife.png",
      },
      name: "wildlife",
    },
  ];
  Subreddit.count.mockResolvedValue(4);
  Subreddit.findAll.mockResolvedValue(subredditInstances);
  getOnlineSubredditUserCount.mockImplementation((name) =>
    name === "foxes" ? 5 : 2,
  );

  const response = await searchSubreddits({
    searchQuery: "Fox",
    offset: 2,
    limit: 2,
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    subreddits: [
      { ...subredditInstances[0].dataValues, onlineUserCount: 5 },
      { ...subredditInstances[1].dataValues, onlineUserCount: 2 },
    ],
    totalCount: 4,
  });
  expect(sequelize.escape).toHaveBeenCalledWith("fox");
  expect(sequelize.fn).toHaveBeenCalledWith(
    "word_similarity",
    "'fox'",
    expect.objectContaining({ column: "name" }),
  );

  const findAllOptions = Subreddit.findAll.mock.calls[0][0];
  expect(findAllOptions).toMatchObject({
    offset: 2,
    limit: 2,
    attributes: ["id", "name", "description", "memberCount", "iconUrl"],
    order: [
      [expect.objectContaining({ functionName: "word_similarity" }), "DESC"],
      ["member_count", "DESC"],
    ],
  });
  expect(Subreddit.count).toHaveBeenCalledWith({
    where: findAllOptions.where,
  });
  expect(getOnlineSubredditUserCount).toHaveBeenCalledWith("foxes");
  expect(getOnlineSubredditUserCount).toHaveBeenCalledWith("wildlife");
});

test("top post search returns an empty result when nothing matches", async () => {
  generateEmbedding.mockResolvedValue([0.11, 0.22, 0.33]);
  sequelize.query.mockResolvedValue([]);

  const response = await searchPosts({
    searchQuery: "nothing",
    offset: 0,
    limit: 10,
    orderType: "TOP",
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual({
    posts: [],
    totalCount: 0,
    searchWordEmbedding: "[0.11,0.22,0.33]",
  });
});

test("top post search reuses the previous embedding when paginating", async () => {
  sequelize.query.mockResolvedValue([]);

  const response = await searchPosts({
    searchQuery: "cats",
    offset: 10,
    limit: 10,
    orderType: "TOP",
    prevSearchWordEmbedding: "[0.5,0.6,0.7]",
  });

  expect(response.statusCode).toBe(200);
  expect(generateEmbedding).not.toHaveBeenCalled();
  expect(sequelize.query).toHaveBeenCalledWith(expect.any(String), {
    replacements: {
      searchWordEmbedding: "[0.5,0.6,0.7]",
      limit: 10,
      offset: 10,
    },
    type: QueryTypes.SELECT,
  });
  expect(response.body.searchWordEmbedding).toBe("[0.5,0.6,0.7]");
});
