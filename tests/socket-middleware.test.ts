jest.mock("../models/index", () => ({}));
jest.mock("../utils/db", () => ({ sequelize: {} }));
jest.mock("../utils/redis", () => ({ redisClient: { set: jest.fn() } }));

import { redisClient } from "../utils/redis";
import registerLikeHandlers from "../websockets/likes";
import type { AppServer, SocketUser } from "../websockets/types";

type Packet = [event: string, ...args: unknown[]];
type Middleware = (packet: Packet, next: (error?: Error) => void) => unknown;
type Outcome = { calledNext: true; error?: Error } | { calledNext: false };

const asMock = (fn: unknown) => fn as jest.Mock;

// Registers the vote handlers on a fake socket and returns the middleware
// functions they added with socket.use, in order.
const getMiddlewares = (user: Pick<SocketUser, "id"> | null) => {
  const middlewares: Middleware[] = [];
  const socket = {
    data: { user },
    use: (middleware: Middleware) => middlewares.push(middleware),
    on: () => {},
  };
  registerLikeHandlers({
    on: (eventName: string, handler: (s: typeof socket) => void) => {
      if (eventName === "connection") handler(socket);
    },
  } as unknown as AppServer);
  return middlewares;
};

// Runs a packet through the middlewares the way Socket.IO does. A middleware
// that returns without calling next() blocks the event, which leaves the
// client waiting for a reply forever.
const runMiddlewares = async (middlewares: Middleware[], packet: Packet) => {
  for (const middleware of middlewares) {
    const outcome = await new Promise<Outcome>((resolve) => {
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
  asMock(redisClient.set).mockReset().mockResolvedValue("OK");
});

describe.each<[string, Pick<SocketUser, "id"> | null]>([
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
    asMock(redisClient.set).mockResolvedValue(null);

    await expect(
      runMiddlewares(getMiddlewares({ id: 8 }), [
        "likeComment",
        { commentId: 4 },
      ]),
    ).resolves.toEqual({ error: "Rate limit exceeded" });
  });
});
