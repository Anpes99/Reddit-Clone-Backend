const http = require("node:http");
const express = require("express");

jest.mock("../enums/subreddit.enum.js", () => ({
  SUBREDDIT_ORDER_BY_TYPES: {
    MEMBER_COUNT: "MEMBER_COUNT",
  },
  SubredditModeratorRole: {
    OWNER: "owner",
    MODERATOR: "moderator",
    MODERATOR_LIMITED: "moderator_limited",
  },
  SubredditPermissions: {
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
    requireAuth: (req, res, next) => {
      if (!req.get("authorization")) {
        return res.status(401).json({ error: "Authentication required" });
      }

      req.user = { id: 12 };
      next();
    },
  };
});

const { Subreddit, UserSubreddits, SubredditModerators } = require("../models");
const { sequelize } = require("../utils/db");
const subredditsRouter = require("../controllers/subreddits");

const app = express();
app.use(express.json());
app.use("/subreddits", subredditsRouter);

let server;

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

describe("subreddit membership", () => {
  it("allows an authenticated user to join a subreddit", async () => {
    const response = await request(
      "POST",
      "/subreddits/34/user",
      undefined,
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("User successfully joined subreddit");
    expect(UserSubreddits.create).toHaveBeenCalledWith({
      userId: 12,
      subredditId: "34",
    });
  });

  it("allows an authenticated user to leave a subreddit", async () => {
    const response = await request(
      "DELETE",
      "/subreddits/34/user",
      undefined,
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(204);
    expect(UserSubreddits.destroy).toHaveBeenCalledWith({
      where: { userId: 12, subredditId: 34 },
    });
  });

  it("returns 409 when the user has already joined the subreddit", async () => {
    const duplicateMembership = new Error("Validation error");
    duplicateMembership.name = "SequelizeUniqueConstraintError";
    UserSubreddits.create.mockRejectedValue(duplicateMembership);

    const response = await request(
      "POST",
      "/subreddits/34/user",
      undefined,
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(409);
    expect(response.body).toBe("User is already a member of this subreddit");
  });

  it("returns 204 when leaving a subreddit the user never joined", async () => {
    UserSubreddits.destroy.mockResolvedValue(0);

    const response = await request(
      "DELETE",
      "/subreddits/34/user",
      undefined,
      { Authorization: "Bearer test-token" },
    );

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
    Subreddit.findOne.mockResolvedValue(null);
    Subreddit.create.mockResolvedValue(createdSubreddit);

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

    expect(response.statusCode).toBe(200);
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
  });

  it("rejects creation when the community name is already taken", async () => {
    Subreddit.findOne.mockResolvedValue({ id: 99 });

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
    expect(response.body).toBe("A subreddit with this name already exists.");
    expect(Subreddit.create).not.toHaveBeenCalled();
    expect(SubredditModerators.create).not.toHaveBeenCalled();
  });
});

describe("moderated subreddit settings", () => {
  it("allows a moderator with settings permission to update settings", async () => {
    const subreddit = {
      update: jest.fn().mockImplementation(async (values) => {
        Object.assign(subreddit, values);
      }),
    };
    SubredditModerators.findOne.mockResolvedValue({ role: "moderator" });
    Subreddit.findByPk.mockResolvedValue(subreddit);

    const response = await request(
      "PATCH",
      "/subreddits/34/settings",
      {
        description: "Updated community description",
        subredditIconUrl: "https://example.test/new-icon.png",
        subredditPageBackgroundImageUrl:
          "https://example.test/background.png",
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
      subredditPageBackgroundImageUrl:
        "https://example.test/background.png",
    });
  });

  it.each([
    ["limited moderator", "moderator_limited"],
    ["non-moderator", null],
  ])("denies settings changes to a %s", async (_label, role) => {
    SubredditModerators.findOne.mockResolvedValue(
      role ? { role } : null,
    );

    const response = await request(
      "PATCH",
      "/subreddits/34/settings",
      { description: "Unauthorized update" },
      { Authorization: "Bearer test-token" },
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "Forbidden" });
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
