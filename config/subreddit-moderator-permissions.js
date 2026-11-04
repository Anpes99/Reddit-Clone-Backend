const {
  SUBREDDIT_MODERATOR_ROLE,
  SUBREDDIT_PERMISSIONS: P,
} = require("../constants/subreddit.constant.js");

const subredditRolePermissions = {
  [SUBREDDIT_MODERATOR_ROLE.OWNER]: Object.values(P),
  [SUBREDDIT_MODERATOR_ROLE.MODERATOR]: [
    P.POSTS_MANAGE,
    P.USERS_MANAGE,
    P.SETTINGS_MANAGE,
  ],
  [SUBREDDIT_MODERATOR_ROLE.MODERATOR_LIMITED]: [P.POSTS_MANAGE],
};

const hasSubredditPermission = (role, permission) => {
  return subredditRolePermissions[role]?.includes(permission) ?? false;
};

module.exports = {
  subredditRolePermissions,
  hasSubredditPermission,
};
