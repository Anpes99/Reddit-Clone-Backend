import "express-async-errors";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";

jest.mock("../models/index", () => ({
  SubredditModerators: { findOne: jest.fn() },
  User: { findOne: jest.fn(), findByPk: jest.fn() },
  EmailVerificationToken: { findOne: jest.fn(), destroy: jest.fn() },
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

import { User, EmailVerificationToken } from "../models/index";
import {
  sendVerificationEmail,
  hashEmailVerificationToken,
} from "../utils/email.js";
import verifyEmailRouter from "../controllers/verifyEmail";
import { errorHandler } from "../utils/middleware/middleware";

const asMock = (fn: unknown) => fn as jest.Mock;

const app = express();
app.use(express.json());
app.use("/", verifyEmailRouter);
app.use(errorHandler);

type TestResponse = {
  statusCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

let server: http.Server;
const rawVerificationToken = "a".repeat(64);

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
  asMock(sendVerificationEmail).mockResolvedValue(undefined);
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
    asMock(EmailVerificationToken.findOne).mockResolvedValue(verificationToken);
    asMock(User.findByPk).mockResolvedValue(user);

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
    asMock(EmailVerificationToken.findOne).mockResolvedValue(null);

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      code: "INVALID_OR_EXPIRED_TOKEN",
      message: "Invalid or expired token",
      details: {},
    });
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("deletes an expired verification token", async () => {
    const verificationToken = {
      usedAt: null,
      expiresAt: new Date(Date.now() - 60_000),
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    asMock(EmailVerificationToken.findOne).mockResolvedValue(verificationToken);

    const response = await postJson("/", { token: rawVerificationToken });

    expect(response.statusCode).toBe(410);
    expect(response.body).toEqual({
      code: "EXPIRED_TOKEN",
      message: "expired token",
      details: {},
    });
    expect(verificationToken.destroy).toHaveBeenCalledTimes(1);
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it("returns success when the token was already used", async () => {
    asMock(EmailVerificationToken.findOne).mockResolvedValue({
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
    asMock(User.findOne).mockResolvedValue({
      id: 12,
      username: "test-user",
      email: "test@example.com",
      emailVerified: false,
    });
    asMock(EmailVerificationToken.destroy).mockResolvedValue(1);

    const response = await postJson("/resend", {
      username: "test-user",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ message: "new verification email sent" });
    expect(EmailVerificationToken.destroy).toHaveBeenCalledWith({
      where: { userId: 12 },
    });
    expect(sendVerificationEmail).toHaveBeenCalledWith({
      email: "test@example.com",
      userId: 12,
    });
  });

  it("does not resend when the user is already verified", async () => {
    asMock(User.findOne).mockResolvedValue({
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
