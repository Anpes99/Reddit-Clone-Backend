import "express-async-errors";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { QueryTypes } from "sequelize";

jest.mock("../models/index", () => ({
  User: {
    findOne: jest.fn(),
  },
  Post: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  Subreddit: {},
  Comment: {
    findAll: jest.fn(),
    count: jest.fn(),
  },
  UserSubreddits: {
    count: jest.fn(),
  },
  PasswordResetToken: {},
}));

jest.mock("../utils/db", () => ({
  sequelize: {
    query: jest.fn(),
    literal: jest.fn((sql) => ({ literal: sql })),
  },
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () =>
  jest.requireActual("../utils/middleware/middleware"),
);

jest.mock("../utils/middleware/requestRateLimiters", () => ({
  signUpLimiter: (req: Request, res: Response, next: NextFunction) => next(),
  signUpPerDayLimiter: (req: Request, res: Response, next: NextFunction) =>
    next(),
}));

jest.mock("../constants/user.constant", () => ({
  USER_PAGE_CONTENT_TYPES: {
    POSTS: "posts",
    COMMENTS: "comments",
    OVERVIEW: "overview",
  },
  USER_PAGE_CONTENT_SORT_BY_TYPES: {
    NEW: "new",
    TOP: "top",
  },
}));

jest.mock("../constants/sort-order.constant", () => ({
  SORT_ORDER: {
    ASC: "ASC",
    DESC: "DESC",
  },
}));

jest.mock("../queries/user/getUserPageOverviewPageFeedQuery", () => ({
  getUserPageOverviewPageFeedQuery: "overview-feed-query",
}));

jest.mock("../utils/email", () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  hashPasswordResetToken: jest.fn(),
}));

import { User, Post, Comment, UserSubreddits } from "../models/index";
import { sequelize } from "../utils/db";
import usersRouter from "../controllers/users";
import { errorHandler } from "../utils/middleware/middleware";

const asMock = (fn: unknown) => fn as jest.Mock;

const app = express();
app.use(express.json());
app.use("/users", usersRouter);
app.use(errorHandler);

type TestResponse = {
  statusCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

let server: http.Server;

const getJson = (path: string) =>
  new Promise<TestResponse>((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port: (server.address() as AddressInfo).port,
        path,
        method: "GET",
        headers: { Connection: "close" },
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
    request.end();
  });

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /users/:username profile", () => {
  it("returns profile details and contribution counts", async () => {
    const createdAt = "2024-01-02T03:04:05.000Z";
    asMock(User.findOne).mockResolvedValue({
      id: 12,
      username: "test-user",
      introduction: "Hello",
      avatarImageUrl: "https://example.test/avatar.png",
      profilePageBackgroundImageUrl: "https://example.test/background.png",
      createdAt,
      karma: 42,
    });
    asMock(UserSubreddits.count).mockResolvedValue(3);
    asMock(sequelize.query).mockResolvedValue([{ totalcount: "9" }]);

    const response = await getJson("/users/test-user");

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      username: "test-user",
      introduction: "Hello",
      avatarImageUrl: "https://example.test/avatar.png",
      profilePageBackgroundImageUrl: "https://example.test/background.png",
      createdAt,
      subredditsJoinedCount: 3,
      contributionsCount: "9",
      karma: 42,
    });
    expect(UserSubreddits.count).toHaveBeenCalledWith({
      where: { userId: 12 },
    });
    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("COUNT(*) FROM posts"),
      {
        replacements: { userId: 12 },
        type: QueryTypes.SELECT,
      },
    );
  });

  it("returns 404 for an unknown profile", async () => {
    asMock(User.findOne).mockResolvedValue(null);

    const response = await getJson("/users/missing-user");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: "USER_NOT_FOUND",
      message: "user not found",
      details: {},
    });
    expect(UserSubreddits.count).not.toHaveBeenCalled();
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});

describe("GET /users/:username/feed", () => {
  beforeEach(() => {
    asMock(User.findOne).mockResolvedValue({ id: 12, username: "test-user" });
  });

  it("returns the user's newest posts with pagination and optional total count", async () => {
    const posts = [{ id: 21, title: "A post" }];
    asMock(Post.findAll).mockResolvedValue(posts);
    asMock(Post.count).mockResolvedValue(7);

    const response = await getJson(
      "/users/test-user/feed?contentType=posts&offset=5&sortByType=new&getTotalCount=true",
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      feedItems: [{ data: posts[0], type: "post" }],
      type: "post",
      totalCount: 7,
    });
    expect(Post.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 12, safe: true },
        order: [["createdAt", "DESC"]],
        offset: 5,
        limit: 5,
        include: expect.arrayContaining([
          {
            model: User,
            attributes: ["username"],
            where: { username: "test-user" },
            required: true,
          },
        ]),
      }),
    );
    expect(Post.count).toHaveBeenCalledWith({
      where: { userId: 12, safe: true },
    });
  });

  it("orders top posts by score then creation date and omits unrequested count", async () => {
    asMock(Post.findAll).mockResolvedValue([]);

    const response = await getJson(
      "/users/test-user/feed?contentType=posts&sortByType=top",
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      feedItems: [],
      type: "post",
    });
    expect(Post.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        order: [
          [{ literal: '"up_votes"-"down_votes"' }, "desc"],
          ["createdAt", "DESC"],
        ],
        offset: 0,
        limit: 5,
      }),
    );
    expect(sequelize.literal).toHaveBeenCalledWith('"up_votes"-"down_votes"');
    expect(Post.count).not.toHaveBeenCalled();
  });

  it("returns comments with post and subreddit context", async () => {
    const comment = {
      get: jest.fn(() => ({
        id: 31,
        text: "A comment",
        post: {
          id: 21,
          subreddit: { name: "testing", iconUrl: null },
        },
        comment: null,
      })),
      post: {
        id: 21,
        subreddit: { name: "testing", iconUrl: null },
      },
      comment: null,
    };
    asMock(Comment.findAll).mockResolvedValue([comment]);

    const response = await getJson(
      "/users/test-user/feed?contentType=comments&offset=10&sortByType=top",
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      feedItems: [
        {
          data: {
            id: 31,
            text: "A comment",
            post: {
              id: 21,
              subreddit: { name: "testing", iconUrl: null },
            },
            comment: null,
            subreddit: { name: "testing", iconUrl: null },
          },
          type: "comment",
        },
      ],
    });
    expect(comment.get).toHaveBeenCalledWith({ plain: true });
    expect(Comment.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 12 },
        order: [
          [{ literal: 'comment."up_votes"-comment."down_votes"' }, "DESC"],
          ["createdAt", "DESC"],
        ],
        offset: 10,
        limit: 5,
      }),
    );
    expect(Comment.count).not.toHaveBeenCalled();
  });

  it("returns overview items and includes a numeric combined count when requested", async () => {
    const overviewRows = [
      {
        data: { id: 21, title: "A post" },
        type: "post",
        subreddit: { name: "testing", iconUrl: null },
        user: { username: "test-user" },
        post: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    asMock(sequelize.query)
      .mockResolvedValueOnce(overviewRows)
      .mockResolvedValueOnce([{ totalcount: "11" }]);

    const response = await getJson(
      "/users/test-user/feed?contentType=overview&offset=20&getTotalCount=true",
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      feedItems: [
        {
          data: {
            id: 21,
            title: "A post",
            subreddit: { name: "testing", iconUrl: null },
            user: { username: "test-user" },
            post: null,
          },
          type: "post",
        },
      ],
      totalCount: 11,
    });
    expect(sequelize.query).toHaveBeenNthCalledWith(1, "overview-feed-query", {
      replacements: { userId: 12, offset: 20 },
      type: QueryTypes.SELECT,
    });
    expect(sequelize.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("COUNT(*) FROM posts"),
      {
        replacements: { userId: 12 },
        type: QueryTypes.SELECT,
      },
    );
  });

  it("returns 404 when the feed user does not exist", async () => {
    asMock(User.findOne).mockResolvedValue(null);

    const response = await getJson(
      "/users/missing-user/feed?contentType=posts",
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      code: "USER_NOT_FOUND",
      message: "user not found",
      details: {},
    });
    expect(Post.findAll).not.toHaveBeenCalled();
    expect(Comment.findAll).not.toHaveBeenCalled();
    expect(sequelize.query).not.toHaveBeenCalled();
  });
});
