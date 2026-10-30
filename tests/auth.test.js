const http = require("node:http");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

jest.mock("../models/index", () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
  Subreddit: {},
  Post: {},
  EmailVerificationToken: { destroy: jest.fn() },
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware", () =>
  jest.requireActual("../utils/middleware/middleware"),
);

jest.mock("../utils/middleware/requestRateLimiters", () => ({
  loginIpLimiter: (req, res, next) => next(),
}));

jest.mock("../utils/redis", () => ({
  redisClient: {
    get: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock("../utils/email", () => ({
  sendVerificationEmail: jest.fn(),
}));

const bcrypt = require("bcrypt");
const { User, EmailVerificationToken } = require("../models/index");
const { redisClient } = require("../utils/redis");
const { sendVerificationEmail } = require("../utils/email");
const authRouter = require("../controllers/auth");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(authRouter);

let server;

const postRequest = (path, payload = {}, cookie) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      Connection: "close",
    };
    if (cookie) {
      headers.Cookie = cookie;
    }
    const request = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
        method: "POST",
        headers,
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
            headers: response.headers,
            body: responseBody ? JSON.parse(responseBody) : null,
          });
        });
      },
    );

    request.on("error", reject);
    request.end(body);
  });

const postLogin = (payload) => postRequest("/login", payload);

const createUser = () => ({
  id: 12,
  username: "test-user",
  passwordHash: "hashed-password",
  email: "test@example.com",
  emailVerified: true,
  subreddits: [],
  ratedPosts: [],
  avatarImageUrl: "https://example.com/avatar.png",
});

const createRefreshToken = (refreshTokenId, userId = 12) => {
  const absoluteExpiresAt = Date.now() + 5 * 24 * 60 * 60 * 1000;
  return jwt.sign(
    {
      id: userId,
      username: "test-user",
      type: "refresh",
      refreshTokenId,
      absoluteExpiresAt,
    },
    process.env.REFRESH_SECRET,
    { expiresIn: 60 * 60 },
  );
};

beforeAll(async () => {
  process.env.SECRET = "test-access-secret";
  process.env.REFRESH_SECRET = "test-refresh-secret";
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
  redisClient.get.mockResolvedValue(null);
  redisClient.del.mockResolvedValue(1);
  redisClient.incr.mockResolvedValue(1);
  redisClient.expire.mockResolvedValue(1);
  redisClient.set.mockResolvedValue("OK");
});

describe("POST /login", () => {
  it("returns tokens and user data for valid credentials", async () => {
    User.findOne.mockResolvedValue(createUser());
    bcrypt.compare.mockResolvedValue(true);

    const response = await postLogin({
      username: "test-user",
      password: "valid-password",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      username: "test-user",
      id: 12,
      avatarImageUrl: "https://example.com/avatar.png",
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("HttpOnly")]),
    );
    expect(redisClient.set).toHaveBeenCalledWith(
      expect.stringMatching(/^refresh:/),
      12,
      { EX: 24 * 60 * 60 },
    );
  });

  it("resends verification email and denies login for an unverified user", async () => {
    User.findOne.mockResolvedValue({ ...createUser(), emailVerified: false });
    bcrypt.compare.mockResolvedValue(true);

    const response = await postLogin({
      username: "test-user",
      password: "valid-password",
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      email: "test@example.com",
      error: { status: "EMAIL_NOT_VERIFIED" },
    });
    expect(EmailVerificationToken.destroy).toHaveBeenCalledWith({
      where: { userId: 12 },
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      userId: 12,
    });
    expect(redisClient.set).not.toHaveBeenCalled();
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an incorrect password", async () => {
    User.findOne.mockResolvedValue(createUser());
    bcrypt.compare.mockResolvedValue(false);

    const response = await postLogin({
      username: "test-user",
      password: "wrong-password",
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "invalid username or password" });
    expect(redisClient.incr).toHaveBeenCalledTimes(1);
    expect(redisClient.expire).toHaveBeenCalledWith(expect.any(String), 900);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an unknown username without comparing a password", async () => {
    User.findOne.mockResolvedValue(null);

    const response = await postLogin({
      username: "unknown-user",
      password: "valid-password",
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "invalid username or password" });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(redisClient.incr).toHaveBeenCalledTimes(1);
    expect(response.headers["set-cookie"]).toBeUndefined();
  });
});

describe("POST /refresh and POST /logout", () => {
  it("rotates a valid refresh token and rejects the old token afterward", async () => {
    const oldRefreshTokenId = "old-refresh-token-id";
    const oldRefreshToken = createRefreshToken(oldRefreshTokenId);
    User.findByPk.mockResolvedValue(createUser());
    redisClient.get.mockResolvedValueOnce("12").mockResolvedValueOnce(null);

    const response = await postRequest(
      "/refresh",
      {},
      `refreshToken=${oldRefreshToken}`,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(redisClient.del).toHaveBeenCalledWith(
      `refresh:${oldRefreshTokenId}`,
    );

    const [newRedisKey, storedUserId, redisOptions] =
      redisClient.set.mock.calls[0];
    expect(newRedisKey).toMatch(/^refresh:/);
    expect(newRedisKey).not.toBe(`refresh:${oldRefreshTokenId}`);
    expect(storedUserId).toBe(12);
    expect(redisOptions).toEqual({ EX: 24 * 60 * 60 });

    const refreshCookie = response.headers["set-cookie"].find((cookie) =>
      cookie.startsWith("refreshToken="),
    );
    const newRefreshToken = decodeURIComponent(
      refreshCookie.split(";")[0].slice("refreshToken=".length),
    );
    const newDecodedToken = jwt.verify(
      newRefreshToken,
      process.env.REFRESH_SECRET,
    );
    expect(newDecodedToken.refreshTokenId).not.toBe(oldRefreshTokenId);

    const replayResponse = await postRequest(
      "/refresh",
      {},
      `refreshToken=${oldRefreshToken}`,
    );
    expect(replayResponse.statusCode).toBe(401);
  });

  it("revokes the refresh token on logout and clears its cookie", async () => {
    const refreshTokenId = "logout-refresh-token-id";
    const refreshToken = createRefreshToken(refreshTokenId);

    const logoutResponse = await postRequest(
      "/logout",
      {},
      `refreshToken=${refreshToken}`,
    );

    expect(logoutResponse.statusCode).toBe(204);
    expect(redisClient.del).toHaveBeenCalledWith(`refresh:${refreshTokenId}`);
    expect(logoutResponse.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("refreshToken=;")]),
    );

    redisClient.get.mockResolvedValue(null);
    const replayResponse = await postRequest(
      "/refresh",
      {},
      `refreshToken=${refreshToken}`,
    );
    expect(replayResponse.statusCode).toBe(401);
  });
});
