const http = require("node:http");
const express = require("express");

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
}));

jest.mock("../models/index", () => ({
  User: {
    findOne: jest.fn(),
  },
  PasswordResetToken: {
    findOne: jest.fn(),
  },
  EmailVerificationToken: {},
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
  signUpLimiter: (req, res, next) => next(),
  signUpPerDayLimiter: (req, res, next) => next(),
}));

jest.mock("../enums/user.enum", () => ({
  USER_PAGE_CONTENT_TYPES: {},
  USER_PAGE_CONTENT_SORT_BY_TYPES: {},
}));

jest.mock("../enums/sort-order.enum", () => ({
  SortOrder: {},
}));

jest.mock("../queries/user/getUserPageOverviewPageFeedQuery", () => ({
  getUserPageOverviewPageFeedQuery: "",
}));

jest.mock("../utils/email", () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  hashEmailVerificationToken: jest.fn((token) => `hashed-email-${token}`),
  hashPasswordResetToken: jest.fn((token) => `hashed-password-${token}`),
}));

const bcrypt = require("bcrypt");
const { User, PasswordResetToken } = require("../models/index");
const {
  sendPasswordResetEmail,
  hashPasswordResetToken,
} = require("../utils/email");
const userRouter = require("../controllers/users");

const app = express();
app.use(express.json());
app.use("/", userRouter);

let server;

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
            body: responseBody ? JSON.parse(responseBody) : null,
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
  bcrypt.hash.mockResolvedValue("hashed-password");
  sendPasswordResetEmail.mockResolvedValue(undefined);
});

describe("POST /forgotten-password", () => {
  it("sends a reset email to the matching account", async () => {
    User.findOne.mockResolvedValue({
      id: 12,
      email: "test@example.com",
    });

    const response = await postJson("/forgotten-password", {
      email: "test@example.com",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      message: "forgotten password email sent",
    });
    expect(sendPasswordResetEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      userId: 12,
    });
  });

  it("returns not found when no account has the email", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await postJson("/forgotten-password", {
      email: "missing@example.com",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "user not found" });
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe("POST /reset-password", () => {
  it("updates the password and consumes the reset token", async () => {
    const resetToken = {
      userId: 12,
      expiresAt: new Date(Date.now() + 60_000),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const user = { update: jest.fn().mockResolvedValue(undefined) };
    PasswordResetToken.findOne.mockResolvedValue(resetToken);
    User.findOne.mockResolvedValue(user);

    const response = await postJson("/reset-password", {
      password: "new-secure-password",
      passwordResetToken: "a".repeat(64),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "user password changed" });
    expect(hashPasswordResetToken).toHaveBeenCalledWith("a".repeat(64));
    expect(PasswordResetToken.findOne).toHaveBeenCalledWith({
      where: { tokenHash: `hashed-password-${"a".repeat(64)}` },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith("new-secure-password", 10);
    expect(user.update).toHaveBeenCalledWith({
      passwordHash: "hashed-password",
    });
    expect(resetToken.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown reset token", async () => {
    PasswordResetToken.findOne.mockResolvedValue(null);

    const response = await postJson("/reset-password", {
      password: "new-secure-password",
      passwordResetToken: "a".repeat(64),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ message: "Invalid or expired token" });
    expect(User.findOne).not.toHaveBeenCalled();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it("deletes an expired reset token", async () => {
    const resetToken = {
      expiresAt: new Date(Date.now() - 60_000),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    PasswordResetToken.findOne.mockResolvedValue(resetToken);

    const response = await postJson("/reset-password", {
      password: "new-secure-password",
      passwordResetToken: "a".repeat(64),
    });

    expect(response.statusCode).toBe(410);
    expect(response.body).toEqual({ message: "Invalid or expired token" });
    expect(resetToken.destroy).toHaveBeenCalledTimes(1);
    expect(User.findOne).not.toHaveBeenCalled();
  });
});
