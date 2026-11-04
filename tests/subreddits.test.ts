import "express-async-errors";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { NextFunction, Request, Response } from "express";

jest.mock("../constants/subreddit.constant.js", () => ({
  SUBREDDIT_ORDER_BY_TYPES: {
    MEMBER_COUNT: "MEMBER_COUNT",
  },
  SUBREDDIT_MODERATOR_ROLE: {
    OWNER: "owner",
    MODERATOR: "moderator",
    MODERATOR_LIMITED: "moderator_limited",
  },
  SUBREDDIT_PERMISSIONS: {
    POSTS_MANAGE: "posts.manage",
    USERS_MANAGE: "users.manage",
    SETTINGS_MANAGE: "settings.manage",
    MODERATORS_MANAGE: "moderators.manage",
  },
}));

jest.mock("../models/index", () => ({
  Subreddit: {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    create: jest.fn(),
  },
  UserSubreddits: {
    create: jest.fn(),
    destroy: jest.fn(),
  },
  SubredditModerators: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  UserNotifications: {
    create: jest.fn(),
  },
}));

jest.mock("../utils/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback({ id: "test-transaction" })),
  },
}));

jest.mock("../utils/middleware/middleware", () => {
  const actual = jest.requireActual("../utils/middleware/middleware");
  return {
    ...actual,
    requireAuth: (req: Request, res: Response, next: NextFunction) => {
      if (!req.get("authorization")) {
        return res.status(401).json({ error: "Authentication required" });
      }

      req.user = { id: 12, username: "test-user" };
      next();
    },
  };
});

import {
  Subreddit,
  UserSubreddits,
  SubredditModerators,
  UserNotifications,
} from "../models";
import { sequelize } from "../utils/db";
import subredditsRouter from "../controllers/subreddits";
import { errorHandler } from "../utils/middleware/middleware";

const asMock = (fn: unknown) => fn as jest.Mock;

const app = express();
app.use(express.json());
app.use("/subreddits", subredditsRouter);
app.use(errorHandler);

type TestResponse = {
  statusCode?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
};

let server: http.Server;

const request = (
  method: string,
  path: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  new Promise<TestResponse>((resolve, reject) => {
    const body = payload === undefined ? "" : JSON.stringify(payload);
    const httpRequest = http.request(
      {
        host: "127.0.0.1",
        port: (server.address() as AddressInfo).port,
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

    httpRequest.on("error", reject);
    httpRequest.end(body);
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

describe("subreddit membership", () => {
  it("allows an authenticated user to join a subreddit", async () => {
    const response = await request("POST", "/subreddits/34/user", undefined, {
      Authorization: "Bearer test-token",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("User successfully joined subreddit");
    expect(UserSubreddits.create).toHaveBeenCalledWith({
      userId: 12,
      subredditId: 34,
    });
  });

  it("allows an authenticated user to leave a subreddit", async () => {
    const response = await request("DELETE", "/subreddits/34/user", undefined, {
      Authorization: "Bearer test-token",
    });

    expect(response.statusCode).toBe(204);
    expect(UserSubreddits.destroy).toHaveBeenCalledWith({
      where: { userId: 12, subredditId: 34 },
    });
  });

  it("returns 409 when the user has already joined the subreddit", async () => {
    const duplicateMembership = new Error("Validation error");
    duplicateMembership.name = "SequelizeUniqueConstraintError";
    asMock(UserSubreddits.create).mockRejectedValue(duplicateMembership);

    const response = await request("POST", "/subreddits/34/user", undefined, {
      Authorization: "Bearer test-token",
    });

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      code: "USER_ALREADY_SUBREDDIT_MEMBER",
      message: "User is already a member of this subreddit",
      details: {},
    });
  });

  it("returns 204 when leaving a subreddit the user never joined", async () => {
    asMock(UserSubreddits.destroy).mockResolvedValue(0);

    const response = await request("DELETE", "/subreddits/34/user", undefined, {
      Authorization: "Bearer test-token",
    });

    expect(response.statusCode).toBe(204);
  });

  it.each(["POST", "DELETE"])(
    "requires authentication to %s subreddit membership",
    async (method) => {
      const response = await request(method, "/subreddits/34/user");

      expect(response.statusCode).toBe(401);
      expect(UserSubreddits.create).not.toHaveBeenCalled();
      expect(UserSubreddits.destroy).not.toHaveBeenCalled();
    },
  );
});

describe("subreddit creation and ownership", () => {
  it("creates a subreddit and assigns its creator as owner transactionally", async () => {
    const createdSubreddit = { id: 34 };
    asMock(Subreddit.findOne).mockResolvedValue(null);
    asMock(Subreddit.create).mockResolvedValue(createdSubreddit);

    const response = await request(
      "POST",
      "/subreddits",
      {
        communityName: "testing",
        description: "A place for testing",
        subredditIconUrl: "https://example.test/icon.png",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(201);
    expect(response.body).toBe("Successfully created new subreddit");
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(Subreddit.create).toHaveBeenCalledWith(
      {
        name: "testing",
        description: "A place for testing",
        creatorId: 12,
        iconUrl: "https://example.test/icon.png",
      },
      { transaction: { id: "test-transaction" } },
    );
    expect(SubredditModerators.create).toHaveBeenCalledWith(
      {
        userId: 12,
        subredditId: 34,
        role: "owner",
      },
      { transaction: { id: "test-transaction" } },
    );
    expect(UserNotifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 12,
        type: "community_created",
      }),
    );
  });

  it("still creates the subreddit when the notification fails", async () => {
    asMock(Subreddit.findOne).mockResolvedValue(null);
    asMock(Subreddit.create).mockResolvedValue({ id: 34 });
    asMock(UserNotifications.create).mockRejectedValue(new Error("db down"));

    const response = await request(
      "POST",
      "/subreddits",
      {
        communityName: "testing",
        description: "A place for testing",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(201);
    expect(Subreddit.create).toHaveBeenCalled();
    expect(SubredditModerators.create).toHaveBeenCalled();
  });

  it("rejects creation when the community name is already taken", async () => {
    asMock(Subreddit.findOne).mockResolvedValue({ id: 99 });

    const response = await request(
      "POST",
      "/subreddits",
      {
        communityName: "testing",
        description: "A place for testing",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toEqual({
      code: "SUBREDDIT_ALREADY_EXISTS",
      message: "A subreddit with this name already exists.",
      details: {},
    });
    expect(Subreddit.create).not.toHaveBeenCalled();
    expect(SubredditModerators.create).not.toHaveBeenCalled();
    expect(UserNotifications.create).not.toHaveBeenCalled();
  });
});

describe("moderated subreddit settings", () => {
  it("allows a moderator with settings permission to update settings", async () => {
    const subreddit = {
      update: jest.fn().mockImplementation(async (values) => {
        Object.assign(subreddit, values);
      }),
    };
    asMock(SubredditModerators.findOne).mockResolvedValue({
      role: "moderator",
    });
    asMock(Subreddit.findByPk).mockResolvedValue(subreddit);

    const response = await request(
      "PATCH",
      "/subreddits/34/settings",
      {
        description: "Updated community description",
        subredditIconUrl: "https://example.test/new-icon.png",
        subredditPageBackgroundImageUrl: "https://example.test/background.png",
      },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(200);
    expect(SubredditModerators.findOne).toHaveBeenCalledWith({
      where: { subredditId: "34", userId: 12 },
      attributes: ["role"],
    });
    expect(Subreddit.findByPk).toHaveBeenCalledWith("34");
    expect(subreddit.update).toHaveBeenCalledWith({
      iconUrl: "https://example.test/new-icon.png",
      description: "Updated community description",
      subredditPageBackgroundImageUrl: "https://example.test/background.png",
    });
  });

  it.each([
    ["limited moderator", "moderator_limited"],
    ["non-moderator", null],
  ])("denies settings changes to a %s", async (_label, role) => {
    asMock(SubredditModerators.findOne).mockResolvedValue(
      role ? { role } : null,
    );

    const response = await request(
      "PATCH",
      "/subreddits/34/settings",
      { description: "Unauthorized update" },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      code: "FORBIDDEN",
      message: "Forbidden",
      details: {},
    });
    expect(Subreddit.findByPk).not.toHaveBeenCalled();
  });

  it("requires authentication to update settings", async () => {
    const response = await request("PATCH", "/subreddits/34/settings", {
      description: "Unauthenticated update",
    });

    expect(response.statusCode).toBe(401);
    expect(SubredditModerators.findOne).not.toHaveBeenCalled();
    expect(Subreddit.findByPk).not.toHaveBeenCalled();
  });
});
