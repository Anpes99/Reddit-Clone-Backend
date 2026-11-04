export const SUBREDDIT_ORDER_BY_TYPES = Object.freeze({
  MEMBER_COUNT: "MEMBER_COUNT",
});
export type SubredditOrderByType =
  (typeof SUBREDDIT_ORDER_BY_TYPES)[keyof typeof SUBREDDIT_ORDER_BY_TYPES];

export const SUBREDDIT_MODERATOR_ROLE = Object.freeze({
  OWNER: "owner",
  MODERATOR: "moderator",
  MODERATOR_LIMITED: "moderator_limited",
});
export type SubredditModeratorRole =
  (typeof SUBREDDIT_MODERATOR_ROLE)[keyof typeof SUBREDDIT_MODERATOR_ROLE];

export const SUBREDDIT_PERMISSIONS = Object.freeze({
  POSTS_MANAGE: "posts.manage",
  USERS_MANAGE: "users.manage",
  SETTINGS_MANAGE: "settings.manage",
  MODERATORS_MANAGE: "moderators.manage",
});
export type SubredditPermission =
  (typeof SUBREDDIT_PERMISSIONS)[keyof typeof SUBREDDIT_PERMISSIONS];
