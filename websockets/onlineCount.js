const subreddits = new Map();

const ONLINE_TIMEOUT = 60_000;

const refreshPresence = (userId, subredditName) => {
  if (!subreddits.has(subredditName)) {
    subreddits.set(subredditName, new Map());
  }

  subreddits.get(subredditName).set(userId, Date.now());
};

const leaveSubreddit = (userId, subredditName) => {
  const users = subreddits.get(subredditName);
  if (!users) return;

  users.delete(userId);

  if (users.size === 0) {
    subreddits.delete(subredditName);
  }
};

const getOnlineSubredditUserCount = (subredditName) => {
  const users = subreddits.get(subredditName);
  if (!users) return 0;

  const now = Date.now();

  for (const [userId, lastSeen] of users) {
    if (now - lastSeen > ONLINE_TIMEOUT) {
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

const registerSubredditOnlineCountSocketHandlers = (io) => {
  io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    let currentSubredditName = null;

    const publishCount = async (subredditName) => {
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

const startSubredditOnlineCountBroadcast = (io) => {
  setInterval(() => {
    for (const subredditName of getTrackedSubredditNames()) {
      io.to(`subreddit:${subredditName}`).emit(
        "subreddit:online-count",
        getOnlineSubredditUserCount(subredditName),
      );
    }
  }, 5000);
};

module.exports = {
  registerSubredditOnlineCountSocketHandlers,
  startSubredditOnlineCountBroadcast,
  getOnlineSubredditUserCount,
};
