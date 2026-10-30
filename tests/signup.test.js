const http = require("node:http");
const express = require("express");

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
}));

const bcrypt = require("bcrypt");
const { User } = require("../models/index");
const { sendVerificationEmail } = require("../utils/email");
const userRouter = require("../controllers/users");

const app = express();
app.use(express.json());
app.use("/users", userRouter);

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
  sendVerificationEmail.mockResolvedValue(undefined);
});

describe("POST /users signup", () => {
  it("creates a user with a hashed password and sends verification email", async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({ id: 12 });

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
    User.findOne.mockResolvedValue({ id: 12 });

    const response = await postJson("/users", {
      username: "test-user",
      email: "test@example.com",
      password: "secure-password",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "username already taken" });
    expect(User.create).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
