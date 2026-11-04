require("express-async-errors");
const http = require("node:http");
const express = require("express");

jest.mock("../models/index", () => ({
  User: {},
  Comment: {},
  Post: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  Subreddit: {
    findOne: jest.fn(),
  },
}));

jest.mock("../utils/db", () => ({
  sequelize: {
    literal: jest.fn((sql) => ({ literal: sql })),
  },
}));

jest.mock("../constants/sort-order.constant", () => ({
  SORT_ORDER: { ASC: "ASC", DESC: "DESC" },
}));

jest.mock("../utils/embeddings", () => ({
  generateEmbedding: jest.fn(),
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () => {
  const actual = jest.requireActual("../utils/middleware/middleware");
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      if (!req.get("authorization")) {
        return res.status(401).json({ error: "Authentication required" });
      }

      req.user = { id: 12 };
      next();
    },
  };
});

jest.mock("../utils/middleware/requestRateLimiters", () => ({
  createPostRequestLimiter: (req, res, next) => next(),
}));

jest.mock("../constants/post.constant", () => ({
  COMMENTS_SORT_BY: {
    CREATED_AT: "createdAt",
    UP_VOTES: "upVotes",
  },
  POST_MODERATION_STATUS: {
    PENDING: "pending",
  },
}));

jest.mock("../queues/moderation.queue", () => ({
  moderationQueue: { add: jest.fn() },
}));

const { User, Comment, Post, Subreddit } = require("../models/index");
const { sequelize } = require("../utils/db");
const { generateEmbedding } = require("../utils/embeddings");
const { moderationQueue } = require("../queues/moderation.queue");
const postsRouter = require("../controllers/posts");

const app = express();
app.use(express.json());
app.use("/posts", postsRouter);
app.use(require("../utils/middleware/middleware").errorHandler);

let server;

const request = (method, path, payload, headers = {}) =>
  new Promise((resolve, reject) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const httpRequest = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
        method,
        headers: {
          ...(payload === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }),
          Connection: "close",
          ...headers,
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

    httpRequest.on("error", reject);
    httpRequest.end(body);
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

describe("POST /posts", () => {
  it("creates an authenticated post with a document embedding", async () => {
    const embedding = [0.1, 0.2, 0.3];
    Subreddit.findOne.mockResolvedValue({ id: 34 });
    generateEmbedding.mockResolvedValue(embedding);
    Post.create.mockResolvedValue({ id: 56 });

    const response = await request(
      "POST",
      "/posts",
      {
        title: "A useful title",
        text: "Post body",
        subredditName: "technology",
        imageUrl: "https://example.test/image.png",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toBe("New post created");
    expect(Subreddit.findOne).toHaveBeenCalledWith({
      where: { name: "technology" },
    });
    expect(generateEmbedding).toHaveBeenCalledWith(
      "A useful title\n\nPost body",
      "document",
    );
    expect(Post.create).toHaveBeenCalledWith({
      title: "A useful title",
      text: "Post body",
      imageUrl: "https://example.test/image.png",
      userId: 12,
      subredditId: 34,
      embedding,
      moderationStatus: "pending",
      safe: null,
    });
    expect(moderationQueue.add).toHaveBeenCalledWith("moderate-image", {
      postId: 56,
      imageUrl: "https://example.test/image.png",
    });
  });

  it("rejects a request without authentication", async () => {
    const response = await request("POST", "/posts", {
      title: "A useful title",
      text: "Post body",
      subredditName: "technology",
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Authentication required" });
    expect(Subreddit.findOne).not.toHaveBeenCalled();
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(Post.create).not.toHaveBeenCalled();
  });

  it("rejects a post when its subreddit does not exist", async () => {
    Subreddit.findOne.mockResolvedValue(null);

    const response = await request(
      "POST",
      "/posts",
      {
        title: "A useful title",
        text: "Post body",
        subredditName: "missing-community",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: "SUBREDDIT_NOT_FOUND",
      message: "subreddit not found",
      details: {},
    });
    expect(generateEmbedding).not.toHaveBeenCalled();
    expect(Post.create).not.toHaveBeenCalled();
  });
});

describe("GET /posts/:id", () => {
  it("retrieves the post with its direct comments and default comment ordering", async () => {
    const post = { id: 56, title: "A useful title" };
    Post.findOne.mockResolvedValue(post);

    const response = await request("GET", "/posts/56");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ post });
    expect(Post.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "56", safe: true },
        include: [
          {
            model: Comment,
            where: { directReplyToPost: true },
            include: [
              {
                model: User,
                attributes: ["username", "avatarImageUrl"],
                required: true,
              },
            ],
            required: false,
          },
          { model: Subreddit, as: "subreddit", required: false },
          {
            model: User,
            attributes: ["username"],
            required: true,
          },
        ],
        order: [
          [{ literal: 'comments."up_votes"-comments."down_votes"' }, "DESC"],
        ],
      }),
    );
    expect(sequelize.literal).toHaveBeenCalledWith(
      'comments."up_votes"-comments."down_votes"',
    );
  });

  it("uses the requested comment sort field and order", async () => {
    const post = { id: 56, title: "A useful title" };
    Post.findOne.mockResolvedValue(post);

    const response = await request(
      "GET",
      "/posts/56?sortBy=createdAt&order=ASC",
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ post });
    expect(Post.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "56", safe: true },
        order: [[Comment, "createdAt", "ASC"]],
      }),
    );
  });

  it("returns 404 when the post does not exist", async () => {
    Post.findOne.mockResolvedValue(null);

    const response = await request("GET", "/posts/56");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: "POST_NOT_FOUND",
      message: "post not found",
      details: {},
    });
  });
});
