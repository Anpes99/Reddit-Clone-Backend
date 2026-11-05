import type { AppServer, SocketUser } from "./types";
import type Subreddit from "../models/Subreddit";

type LastSeenAtInMs = number;

const subreddits = new Map<
  Subreddit["name"],
  Map<SocketUser["id"], LastSeenAtInMs>
>();

const ONLINE_TIMEOUT_MS = 60_000;

const refreshPresence = (
  userId: SocketUser["id"],
  subredditName: Subreddit["name"],
) => {
  if (!subreddits.has(subredditName)) {
    subreddits.set(subredditName, new Map());
  }

  subreddits.get(subredditName)!.set(userId, Date.now());
};

const leaveSubreddit = (
  userId: SocketUser["id"] | undefined,
  subredditName: Subreddit["name"],
) => {
  const users = subreddits.get(subredditName);
  if (!users) return;

  if (userId !== undefined) users.delete(userId);

  if (users.size === 0) {
    subreddits.delete(subredditName);
  }
};

export const getOnlineSubredditUserCount = (
  subredditName: Subreddit["name"],
) => {
  const users = subreddits.get(subredditName);
  if (!users) return 0;

  const now = Date.now();

  for (const [userId, lastSeen] of users) {
    if (now - lastSeen > ONLINE_TIMEOUT_MS) {
      users.delete(userId);
    }
  }

  if (users.size === 0) {
    subreddits.delete(subredditName);
    return 0;
  }

  return users.size;
};

const getTrackedSubredditNames = () => {
  return [...subreddits.keys()];
};

export const registerSubredditOnlineCountSocketHandlers = (io: AppServer) => {
  io.on("connection", (socket) => {
    const userId = socket.data?.user?.id;
    let currentSubredditName: Subreddit["name"] | null = null;

    const publishCount = async (subredditName: Subreddit["name"]) => {
      io.to(`subreddit:${subredditName}`).emit(
        "subreddit:online-count",
        getOnlineSubredditUserCount(subredditName),
      );
    };

    socket.on("subreddit:view", async ({ subredditName }) => {
      if (typeof subredditName !== "string" || !subredditName) return;

      if (currentSubredditName) {
        const previous = currentSubredditName;

        await socket.leave(`subreddit:${previous}`);
        leaveSubreddit(userId, previous);
        await publishCount(previous);
      }

      currentSubredditName = subredditName;

      await socket.join(`subreddit:${subredditName}`);
      if (userId) {
        refreshPresence(userId, subredditName);
      }

      await publishCount(subredditName);
    });

    socket.on("presence:refresh", async () => {
      if (!currentSubredditName || !userId) return;

      refreshPresence(userId, currentSubredditName);
    });

    socket.on("disconnect", async () => {
      if (!currentSubredditName) return;

      const subredditName = currentSubredditName;

      leaveSubreddit(userId, subredditName);
      await publishCount(subredditName);
    });
  });
};

export const startSubredditOnlineCountBroadcast = (io: AppServer) => {
  setInterval(() => {
    for (const subredditName of getTrackedSubredditNames()) {
      io.to(`subreddit:${subredditName}`).emit(
        "subreddit:online-count",
        getOnlineSubredditUserCount(subredditName),
      );
    }
  }, 5000);
};
