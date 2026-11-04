import {
  SUBREDDIT_MODERATOR_ROLE,
  SUBREDDIT_PERMISSIONS as P,
  type SubredditModeratorRole,
  type SubredditPermission,
} from "../constants/subreddit.constant.js";

export const subredditRolePermissions: Record<
  SubredditModeratorRole,
  SubredditPermission[]
> = {
  [SUBREDDIT_MODERATOR_ROLE.OWNER]: Object.values(P),
  [SUBREDDIT_MODERATOR_ROLE.MODERATOR]: [
    P.POSTS_MANAGE,
    P.USERS_MANAGE,
    P.SETTINGS_MANAGE,
  ],
  [SUBREDDIT_MODERATOR_ROLE.MODERATOR_LIMITED]: [P.POSTS_MANAGE],
};

export const hasSubredditPermission = (
  role: SubredditModeratorRole,
  permission: SubredditPermission,
): boolean => {
  return subredditRolePermissions[role]?.includes(permission) ?? false;
};
