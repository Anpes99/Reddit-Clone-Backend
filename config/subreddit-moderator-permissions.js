const {
  SubredditModeratorRole,
  SubredditPermissions: P,
} = require("../enums/subreddit.enum.js");

const subredditRolePermissions = {
  [SubredditModeratorRole.OWNER]: Object.values(P),
  [SubredditModeratorRole.MODERATOR]: [
    P.POSTS_MANAGE,
    P.USERS_MANAGE,
    P.SETTINGS_MANAGE,
  ],
  [SubredditModeratorRole.MODERATOR_LIMITED]: [P.POSTS_MANAGE],
};

const hasSubredditPermission = (role, permission) => {
  return subredditRolePermissions[role]?.includes(permission) ?? false;
};

module.exports = {
  subredditRolePermissions,
  hasSubredditPermission,
};
