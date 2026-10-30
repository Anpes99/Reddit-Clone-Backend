const Joi = require("joi");

jest.mock("../enums/subreddit.enum.js", () => ({
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
  SubredditModerators: { findOne: jest.fn() },
}));

const jwt = require("jsonwebtoken");
const {
  csrfProtection,
  errorHandler,
  requireAuth,
  requireSubredditPermission,
  tokenExtractor,
  userExtractor,
  validate,
} = require("../utils/middleware/middleware");
const { SubredditModerators } = require("../models/index");
const {
  hasSubredditPermission,
} = require("../config/subreddit-moderator-permissions");

const createResponse = () => {
  const response = {};
  response.status = jest.fn((statusCode) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = jest.fn((body) => {
    response.body = body;
    return response;
  });
  response.send = response.json;
  return response;
};

const TEST_SECRET = "middleware-test-secret";

const createAuthRequest = (authorization) => ({
  get: jest.fn((header) =>
    header.toLowerCase() === "authorization" ? authorization : undefined,
  ),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CLIENT_URL = "https://client.example.test";
});

describe("validate", () => {
  const schema = Joi.object({ username: Joi.string().trim().required() });

  it("replaces the request body with validated values", () => {
    const request = { body: { username: "  test-user  " } };
    const response = createResponse();
    const next = jest.fn();

    validate(schema)(request, response, next);

    expect(request.body).toEqual({ username: "test-user" });
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns 400 and stops the chain for invalid input", () => {
    const request = { body: { username: "" } };
    const response = createResponse();
    const next = jest.fn();

    validate(schema)(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.body).toMatchObject({ message: "Validation failed" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("requireAuth", () => {
  it("returns 401 when the request has no authenticated user", () => {
    const response = createResponse();
    const next = jest.fn();

    requireAuth({}, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.body).toEqual({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when the request has an authenticated user", () => {
    const next = jest.fn();

    requireAuth({ user: { id: 12 } }, createResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("tokenExtractor", () => {
  it("stores the token from a Bearer authorization header", () => {
    const request = createAuthRequest("Bearer abc.def.ghi");
    const next = jest.fn();

    tokenExtractor(request, createResponse(), next);

    expect(request.token).toBe("abc.def.ghi");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("ignores an authorization header that is not a Bearer token", () => {
    const request = createAuthRequest("Basic dXNlcjpwYXNz");
    const next = jest.fn();

    tokenExtractor(request, createResponse(), next);

    expect(request.token).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("userExtractor", () => {
  const originalSecret = process.env.SECRET;

  beforeEach(() => {
    process.env.SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.SECRET = originalSecret;
  });

  it("sets req.user from a valid token", () => {
    const token = jwt.sign({ username: "test-user", id: 12 }, TEST_SECRET);
    const request = createAuthRequest(`Bearer ${token}`);
    const next = jest.fn();

    userExtractor(request, createResponse(), next);

    expect(request.user).toEqual({ username: "test-user", id: 12 });
    expect(next).toHaveBeenCalledWith();
  });

  it("leaves req.user unset when there is no authorization header", () => {
    const request = createAuthRequest(undefined);
    const next = jest.fn();

    userExtractor(request, createResponse(), next);

    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("ignores an authorization header that is not a Bearer token", () => {
    const request = createAuthRequest("Basic dXNlcjpwYXNz");
    const next = jest.fn();

    userExtractor(request, createResponse(), next);

    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    [
      "signed with a different secret",
      () => jwt.sign({ username: "test-user", id: 12 }, "attacker-secret"),
    ],
    [
      "with a tampered payload",
      () => {
        const [header, , signature] = jwt
          .sign({ username: "test-user", id: 12 }, TEST_SECRET)
          .split(".");
        const payload = Buffer.from(
          JSON.stringify({ username: "admin", id: 1 }),
        ).toString("base64url");
        return `${header}.${payload}.${signature}`;
      },
    ],
  ])("passes a JsonWebTokenError for a token %s", (description, createToken) => {
    const request = createAuthRequest(`Bearer ${createToken()}`);
    const next = jest.fn();

    userExtractor(request, createResponse(), next);

    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].name).toBe("JsonWebTokenError");
  });

  it("passes a TokenExpiredError for an expired token", () => {
    const token = jwt.sign(
      {
        username: "test-user",
        id: 12,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      TEST_SECRET,
    );
    const request = createAuthRequest(`Bearer ${token}`);
    const next = jest.fn();

    userExtractor(request, createResponse(), next);

    expect(request.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].name).toBe("TokenExpiredError");
  });
});

describe("errorHandler", () => {
  const createError = (name, message = `${name} message`) => {
    const error = new Error(message);
    error.name = name;
    return error;
  };

  it.each([
    ["ValidationError", 400],
    ["TokenExpiredError", 401],
    ["JsonWebTokenError", 401],
    ["TypeError", 500],
    ["CastError", 400],
  ])("maps %s to status %i", (name, statusCode) => {
    const response = createResponse();
    const next = jest.fn();

    errorHandler(createError(name), {}, response, next);

    expect(response.status).toHaveBeenCalledWith(statusCode);
    expect(response.body).toEqual({
      error: { message: `${name} message`, name },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes unknown errors on to the next handler", () => {
    const error = createError("SomethingElse");
    const response = createResponse();
    const next = jest.fn();

    errorHandler(error, {}, response, next);

    expect(response.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("requireSubredditPermission", () => {
  const checkPermission = requireSubredditPermission("settings.manage");

  it("returns 401 when the request has no user", async () => {
    const response = createResponse();
    const next = jest.fn();

    await checkPermission({ params: { subredditId: "5" } }, response, next);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(SubredditModerators.findOne).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when the user's moderator role has the permission", async () => {
    const request = { user: { id: 12 }, params: { subredditId: "5" } };
    const next = jest.fn();
    SubredditModerators.findOne.mockResolvedValue({ role: "owner" });

    await checkPermission(request, createResponse(), next);

    expect(SubredditModerators.findOne).toHaveBeenCalledWith({
      where: { subredditId: "5", userId: 12 },
      attributes: ["role"],
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("returns 403 when the user has no moderator permission", async () => {
    const response = createResponse();
    const next = jest.fn();
    SubredditModerators.findOne.mockResolvedValue({
      role: "moderator_limited",
    });

    await checkPermission(
      { user: { id: 12 }, params: { subredditId: "5" } },
      response,
      next,
    );

    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.body).toEqual({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("denies a moderator the owner-only moderators.manage action", async () => {
    const response = createResponse();
    const next = jest.fn();
    const checkOwnerPermission =
      requireSubredditPermission("moderators.manage");
    SubredditModerators.findOne.mockResolvedValue({ role: "moderator" });

    await checkOwnerPermission(
      { user: { id: 12 }, params: { subredditId: "5" } },
      response,
      next,
    );

    expect(hasSubredditPermission("moderator", "moderators.manage")).toBe(
      false,
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.body).toEqual({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });

  it("denies a limited moderator the moderator-level users.manage action", async () => {
    const response = createResponse();
    const next = jest.fn();
    const checkModeratorPermission = requireSubredditPermission("users.manage");
    SubredditModerators.findOne.mockResolvedValue({
      role: "moderator_limited",
    });

    await checkModeratorPermission(
      { user: { id: 12 }, params: { subredditId: "5" } },
      response,
      next,
    );

    expect(hasSubredditPermission("moderator_limited", "users.manage")).toBe(
      false,
    );
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.body).toEqual({ error: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
  });
});

describe("csrfProtection", () => {
  it.each(["GET", "HEAD", "OPTIONS"])(
    "allows safe %s requests without checking Origin",
    (method) => {
      const request = { method, get: jest.fn() };
      const next = jest.fn();

      csrfProtection(request, createResponse(), next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(request.get).not.toHaveBeenCalled();
    },
  );

  it("allows an unsafe request from the configured origin", () => {
    const request = {
      method: "POST",
      get: jest.fn().mockReturnValue("https://client.example.test"),
    };
    const response = createResponse();
    const next = jest.fn();

    csrfProtection(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each(["https://attacker.example.test", undefined])(
    "rejects an unsafe request with disallowed Origin %s",
    (origin) => {
      const request = {
        method: "POST",
        get: jest.fn().mockReturnValue(origin),
      };
      const response = createResponse();
      const next = jest.fn();

      csrfProtection(request, response, next);

      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.body).toEqual({
        error: {
          message: "Invalid request origin",
          name: "CsrfError",
        },
      });
      expect(next).not.toHaveBeenCalled();
    },
  );
});
