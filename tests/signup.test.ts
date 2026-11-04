import "express-async-errors";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { NextFunction, Request, Response } from "express";

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

jest.mock("../models/index", () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  EmailVerificationToken: {},
  PasswordResetToken: {},
  Post: {},
  Subreddit: {},
  Comment: {},
  UserSubreddits: {},
}));

jest.mock("../utils/db", () => ({
  sequelize: {},
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
  USER_PAGE_CONTENT_TYPES: {},
  USER_PAGE_CONTENT_SORT_BY_TYPES: {},
}));

jest.mock("../constants/sort-order.constant", () => ({
  SORT_ORDER: {},
}));

jest.mock("../queries/user/getUserPageOverviewPageFeedQuery", () => ({
  getUserPageOverviewPageFeedQuery: "",
}));

jest.mock("../utils/email", () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

import bcrypt from "bcrypt";
import { User } from "../models/index";
import { sendVerificationEmail } from "../utils/email";
import userRouter from "../controllers/users";
import { errorHandler } from "../utils/middleware/middleware";

const asMock = (fn: unknown) => fn as jest.Mock;

const app = express();
app.use(express.json());
app.use("/users", userRouter);
app.use(errorHandler);

type TestResponse = {
  statusCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

let server: http.Server;

const postJson = (path: string, payload: unknown) =>
  new Promise<TestResponse>((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = http.request(
      {
        host: "127.0.0.1",
        port: (server.address() as AddressInfo).port,
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
  asMock(bcrypt.hash).mockResolvedValue("hashed-password");
  asMock(sendVerificationEmail).mockResolvedValue(undefined);
});

describe("POST /users signup", () => {
  it("creates a user with a hashed password and sends verification email", async () => {
    asMock(User.findOne).mockResolvedValue(null);
    asMock(User.create).mockResolvedValue({ id: 12 });

    const response = await postJson("/users", {
      username: "test-user",
      email: "test@example.com",
      password: "secure-password",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("new user created");
    expect(bcrypt.hash).toHaveBeenCalledWith("secure-password", 10);
    expect(User.create).toHaveBeenCalledWith({
      username: "test-user",
      email: "test@example.com",
      passwordHash: "hashed-password",
      avatarImageUrl:
        "https://api.dicebear.com/10.x/voxel-art/svg?scale=1.25&seed=test-user",
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      userId: 12,
    });
  });

  it("rejects an already registered username", async () => {
    asMock(User.findOne).mockResolvedValue({ id: 12 });

    const response = await postJson("/users", {
      username: "test-user",
      email: "test@example.com",
      password: "secure-password",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      code: "USERNAME_ALREADY_TAKEN",
      message: "username already taken",
      details: {},
    });
    expect(User.create).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
