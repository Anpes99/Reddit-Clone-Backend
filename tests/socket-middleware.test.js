jest.mock("../models/index", () => ({}));
jest.mock("../utils/db", () => ({ sequelize: {} }));
jest.mock("../utils/redis", () => ({ redisClient: { set: jest.fn() } }));

const { redisClient } = require("../utils/redis");
const registerLikeHandlers = require("../websockets/likes");

// Registers the vote handlers on a fake socket and returns the middleware
// functions they added with socket.use, in order.
const getMiddlewares = (user) => {
  const middlewares = [];
  const socket = {
    data: { user },
    use: (middleware) => middlewares.push(middleware),
    on: () => {},
  };
  registerLikeHandlers({
    on: (eventName, handler) => {
      if (eventName === "connection") handler(socket);
    },
  });
  return middlewares;
};

// Runs a packet through the middlewares the way Socket.IO does. A middleware
// that returns without calling next() blocks the event, which leaves the
// client waiting for a reply forever.
const runMiddlewares = async (middlewares, packet) => {
  for (const middleware of middlewares) {
    const outcome = await new Promise((resolve) => {
      const result = middleware(packet, (error) =>
        resolve({ calledNext: true, error }),
      );
      Promise.resolve(result).then(() =>
        setImmediate(() => resolve({ calledNext: false })),
      );
    });
    if (!outcome.calledNext) return { blocked: true };
    if (outcome.error) return { error: outcome.error.message };
  }
  return { passed: true };
};

beforeEach(() => {
  redisClient.set.mockReset().mockResolvedValue("OK");
});

describe.each([
  ["a logged-out socket", null],
  ["a logged-in socket", { id: 8 }],
])("socket middleware for %s", (_, user) => {
  it.each([
    ["fetch_more_posts", { offset: 0, limit: 5 }],
    ["fetch_top_posts", { offset: 0 }],
    ["subreddit:view", { subredditName: "javascript" }],
  ])("lets %s through", async (event, payload) => {
    await expect(
      runMiddlewares(getMiddlewares(user), [event, payload]),
    ).resolves.toEqual({ passed: true });
  });
});

describe("vote events", () => {
  it.each(["likePost", "dislikePost"])(
    "rejects %s from a logged-out socket",
    async (event) => {
      await expect(
        runMiddlewares(getMiddlewares(null), [event, { postId: 1 }]),
      ).resolves.toEqual({ error: "Not authenticated" });
      expect(redisClient.set).not.toHaveBeenCalled();
    },
  );

  it.each(["likeComment", "dislikeComment"])(
    "rejects %s from a logged-out socket",
    async (event) => {
      await expect(
        runMiddlewares(getMiddlewares(null), [event, { commentId: 1 }]),
      ).resolves.toEqual({ error: "Not authenticated" });
    },
  );

  it("lets a logged-in user's vote through", async () => {
    await expect(
      runMiddlewares(getMiddlewares({ id: 8 }), ["likePost", { postId: 1 }]),
    ).resolves.toEqual({ passed: true });
    expect(redisClient.set).toHaveBeenCalledWith("rl:vote:post:8:1", "1", {
      PX: 3000,
      NX: true,
    });
  });

  it("rejects a repeated vote inside the throttle window", async () => {
    redisClient.set.mockResolvedValue(null);

    await expect(
      runMiddlewares(getMiddlewares({ id: 8 }), [
        "likeComment",
        { commentId: 4 },
      ]),
    ).resolves.toEqual({ error: "Rate limit exceeded" });
  });
});
