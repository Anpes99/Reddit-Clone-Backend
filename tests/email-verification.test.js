const http = require("node:http");
const express = require("express");

jest.mock("../models/User.js", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../models/EmailVerificationToken.js", () => ({
  findOne: jest.fn(),
}));

jest.mock("../models/index", () => ({
  SubredditModerators: { findOne: jest.fn() },
}));

jest.mock("../config/subreddit-moderator-permissions", () => ({
  hasSubredditPermission: jest.fn(),
}));

jest.mock("../utils/middleware/middleware.js", () =>
  jest.requireActual("../utils/middleware/middleware.js"),
);

jest.mock("../utils/email.js", () => ({
  sendVerificationEmail: jest.fn(),
  hashEmailVerificationToken: jest.fn((token) => `hashed-email-${token}`),
}));

const User = require("../models/User.js");
const EmailVerificationToken = require("../models/EmailVerificationToken.js");
const {
  sendVerificationEmail,
  hashEmailVerificationToken,
} = require("../utils/email.js");
const verifyEmailRouter = require("../controllers/verifyEmail");

const app = express();
app.use(express.json());
app.use("/", verifyEmailRouter);

let server;
const rawVerificationToken = "a".repeat(64);

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
  sendVerificationEmail.mockResolvedValue(undefined);
});

describe("POST / verification", () => {
  it("verifies the user and marks the token as used", async () => {
    const user = { update: jest.fn().mockResolvedValue(undefined) };
    const verificationToken = {
      userId: 12,
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      update: jest.fn().mockResolvedValue(undefined),
    };
    EmailVerificationToken.findOne.mockResolvedValue(verificationToken);
    User.findByPk.mockResolvedValue(user);

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "Email verified" });
    expect(hashEmailVerificationToken).toHaveBeenCalledWith(
      rawVerificationToken,
    );
    expect(EmailVerificationToken.findOne).toHaveBeenCalledWith({
      where: { tokenHash: `hashed-email-${rawVerificationToken}` },
    });
    expect(User.findByPk).toHaveBeenCalledWith(12);
    expect(user.update).toHaveBeenCalledWith({ emailVerified: true });
    expect(verificationToken.update).toHaveBeenCalledWith({
      usedAt: expect.any(Date),
    });
  });

  it("rejects an unknown verification token", async () => {
    EmailVerificationToken.findOne.mockResolvedValue(null);

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ message: "Invalid or expired token" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("deletes an expired verification token", async () => {
    const verificationToken = {
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    EmailVerificationToken.findOne.mockResolvedValue(verificationToken);

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(410);
    expect(response.body).toEqual({ message: "Invalid or expired token" });
    expect(verificationToken.destroy).toHaveBeenCalledTimes(1);
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("returns success when the token was already used", async () => {
    EmailVerificationToken.findOne.mockResolvedValue({
      usedAt: new Date(),
    });

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "email already verified" });
    expect(User.findByPk).not.toHaveBeenCalled();
  });
});

describe("POST /resend verification", () => {
  it("resends a verification email for an unverified user", async () => {
    User.findOne.mockResolvedValue({
      id: 12,
      username: "test-user",
      email: "test@example.com",
      emailVerified: false,
    });
    const verificationToken = {
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    EmailVerificationToken.findOne.mockResolvedValue(verificationToken);

    const response = await postJson("/resend", {
      username: "test-user",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "new verification email sent" });
    expect(verificationToken.destroy).toHaveBeenCalledTimes(1);
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      userId: 12,
    });
  });

  it("does not resend when the user is already verified", async () => {
    User.findOne.mockResolvedValue({
      id: 12,
      emailVerified: true,
    });

    const response = await postJson("/resend", {
      username: "test-user",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      status: "EMAIL_ALREADY_VERIFIED",
      message: "Email is already verified.",
    });
    expect(EmailVerificationToken.findOne).not.toHaveBeenCalled();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
});
