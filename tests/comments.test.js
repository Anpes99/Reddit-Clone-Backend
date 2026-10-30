const http = require("node:http");
const express = require("express");

jest.mock("../models/index", () => ({
  Comment: {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
  },
  User: {},
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () => {
  const actual = jest.requireActual("../utils/middleware/middleware");
  return {
    ...actual,
    requireAuth: (req, res, next) => {
      req.user = { id: 12 };
      next();
    },
  };
});

jest.mock("../utils/middleware/requestRateLimiters", () => ({
  createCommentRequestLimiter: (req, res, next) => next(),
}));

const { Comment } = require("../models/index");
const { User } = require("../models/index");
const commentRouter = require("../controllers/comments");

const app = express();
app.use(express.json());
app.use(commentRouter);

let server;

const request = (method, path, payload) =>
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

const postComment = (payload) => request("POST", "/", payload);

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

test("returns 404 and does not create a reply when the parent comment ID is invalid", async () => {
  Comment.findByPk.mockResolvedValue(null);

  const response = await postComment({
    text: "A reply to a missing parent",
    directReplyToPost: false,
    commentId: 9999,
    subredditId: 3,
    postId: 17,
  });

  expect(response.statusCode).toBe(404);
  expect(response.body).toEqual({ error: "Parent comment not found." });
  expect(Comment.findByPk).toHaveBeenCalledWith(9999);
  expect(Comment.create).not.toHaveBeenCalled();
});

test("creates a top-level comment using the authenticated user's ID", async () => {
  Comment.create.mockResolvedValue({ id: 21 });

  const response = await postComment({
    text: "A new top-level comment",
    directReplyToPost: true,
    subredditId: 3,
    postId: 17,
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toBe("comment created");
  expect(Comment.findByPk).not.toHaveBeenCalled();
  expect(Comment.create).toHaveBeenCalledWith({
    text: "A new top-level comment",
    directReplyToPost: true,
    commentId: undefined,
    subredditId: 3,
    userId: 12,
    postId: 17,
  });
});

test("rejects a client-supplied user ID", async () => {
  const response = await postComment({
    text: "A comment",
    directReplyToPost: true,
    subredditId: 3,
    postId: 17,
    userId: 99,
  });

  expect(response.statusCode).toBe(400);
  expect(response.body.message).toBe("Validation failed");
  expect(Comment.create).not.toHaveBeenCalled();
});

test("creates a reply when its parent comment exists", async () => {
  Comment.findByPk.mockResolvedValue({ id: 44, postId: 17 });
  Comment.create.mockResolvedValue({ id: 45 });

  const response = await postComment({
    text: "A reply",
    directReplyToPost: false,
    commentId: 44,
    subredditId: 3,
    postId: 17,
  });

  expect(response.statusCode).toBe(200);
  expect(response.body).toBe("comment created");
  expect(Comment.findByPk).toHaveBeenCalledWith(44);
  expect(Comment.create).toHaveBeenCalledWith({
    text: "A reply",
    directReplyToPost: false,
    commentId: 44,
    subredditId: 3,
    userId: 12,
    postId: 17,
  });
});

test("rejects a reply whose parent comment belongs to a different post", async () => {
  Comment.findByPk.mockResolvedValue({ id: 44, postId: 18 });

  const response = await postComment({
    text: "A reply on the wrong post",
    directReplyToPost: false,
    commentId: 44,
    subredditId: 3,
    postId: 17,
  });

  expect(response.statusCode).toBe(400);
  expect(response.body).toEqual({
    error: "Parent comment belongs to a different post.",
  });
  expect(Comment.create).not.toHaveBeenCalled();
});

test("returns a single 500 response when comment creation fails", async () => {
  Comment.create.mockRejectedValue(new Error("database unavailable"));

  const response = await postComment({
    text: "A comment that fails to save",
    directReplyToPost: true,
    subredditId: 3,
    postId: 17,
  });

  expect(response.statusCode).toBe(500);
  expect(response.body).toBe("something went wrong while creating new comment");
});

test("retrieves replies for a parent comment with author details", async () => {
  const replies = [
    { id: 51, text: "First reply" },
    { id: 52, text: "Second reply" },
  ];
  Comment.findAll.mockResolvedValue(replies);

  const response = await request("GET", "/moreComments/44");

  expect(response.statusCode).toBe(200);
  expect(response.body).toEqual(replies);
  expect(Comment.findAll).toHaveBeenCalledWith({
    where: { commentId: "44" },
    include: [
      {
        model: User,
        attributes: ["username", "avatarImageUrl"],
        required: true,
      },
    ],
  });
});
