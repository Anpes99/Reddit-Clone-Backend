const http = require("node:http");
const express = require("express");
const jwt = require("jsonwebtoken");

jest.mock("../models/index", () => ({
  User: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
  },
  Subreddit: {},
  Post: {},
  SubredditModerators: {},
}));

const { User } = require("../models/index");
const {
  errorHandler,
  tokenExtractor,
  userExtractor,
} = require("../utils/middleware/middleware");
const loggedInUserRouter = require("../controllers/loggedInUser");

const TEST_SECRET = "logged-in-user-test-secret";

const app = express();
app.use(express.json());
app.use(tokenExtractor);
app.use(userExtractor);
app.use(loggedInUserRouter);
app.use(errorHandler);

let server;
let originalSecret;

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

const authHeader = (user = { username: "test-user", id: 12 }) => ({
  Authorization: `Bearer ${jwt.sign(user, TEST_SECRET)}`,
});

beforeAll(async () => {
  originalSecret = process.env.SECRET;
  process.env.SECRET = TEST_SECRET;
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  process.env.SECRET = originalSecret;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/loggedInUser", () => {
  it("returns the authenticated user's own data and ignores a username query", async () => {
    User.findOne.mockResolvedValue({
      username: "test-user",
      id: 12,
      subreddits: [{ id: 3, name: "cats" }],
      ratedPosts: [{ id: 41, UserRatedPosts: { rating: -1 } }],
      avatarImageUrl: "https://cdn.example.test/avatar.png",
      profilePageBackgroundImageUrl: null,
    });

    const response = await request(
      "GET",
      "/?username=someone-else",
      undefined,
      authHeader(),
    );

    expect(response.statusCode).toBe(200);
    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { username: "test-user" } }),
    );
    expect(response.body).toEqual({
      username: "test-user",
      id: 12,
      subreddits: [{ id: 3, name: "cats" }],
      ratedPosts: [{ id: 41, rating: -1 }],
      avatarImageUrl: "https://cdn.example.test/avatar.png",
      profilePageBackgroundImageUrl: null,
    });
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await request("GET", "/", undefined, authHeader());

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: "user not found" });
  });

  it("requires authentication", async () => {
    const response = await request("GET", "/");

    expect(response.statusCode).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  it("rejects a token signed with another secret", async () => {
    const forgedToken = jwt.sign(
      { username: "test-user", id: 12 },
      "attacker-secret",
    );

    const response = await request("GET", "/", undefined, {
      Authorization: `Bearer ${forgedToken}`,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.error.name).toBe("JsonWebTokenError");
    expect(User.findOne).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/loggedInUser", () => {
  it("updates only the authenticated user's own account", async () => {
    const user = { update: jest.fn().mockResolvedValue() };
    User.findByPk.mockResolvedValue(user);

    const response = await request(
      "PATCH",
      "/",
      {
        introduction: "Hello there",
        userAvatarImageUrl: "https://cdn.example.test/avatar.png",
        profilePageBackgroundImageUrl: "",
      },
      authHeader(),
    );

    expect(response.statusCode).toBe(200);
    expect(User.findByPk).toHaveBeenCalledWith(12);
    expect(user.update).toHaveBeenCalledWith({
      introduction: "Hello there",
      avatarImageUrl: "https://cdn.example.test/avatar.png",
      profilePageBackgroundImageUrl: "",
    });
  });

  it.each([
    ["targets another user by id", { id: 99, introduction: "Hijacked" }],
    ["sets a field outside the profile", { karma: 1000000 }],
    [
      "uses a javascript: avatar URL",
      { userAvatarImageUrl: "javascript:alert(1)" },
    ],
  ])("rejects a body that %s", async (description, payload) => {
    const response = await request("PATCH", "/", payload, authHeader());

    expect(response.statusCode).toBe(400);
    expect(response.body).toMatchObject({ message: "Validation failed" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("returns 404 when the authenticated user no longer exists", async () => {
    User.findByPk.mockResolvedValue(null);

    const response = await request(
      "PATCH",
      "/",
      { introduction: "Hello" },
      authHeader(),
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: "user not found" });
  });

  it("requires authentication", async () => {
    const response = await request("PATCH", "/", { introduction: "Hello" });

    expect(response.statusCode).toBe(401);
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});
