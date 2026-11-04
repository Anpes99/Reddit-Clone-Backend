export const USER_PAGE_CONTENT_TYPES = Object.freeze({
  POSTS: "posts",
  COMMENTS: "comments",
  OVERVIEW: "overview",
});
export type UserPageContentType =
  (typeof USER_PAGE_CONTENT_TYPES)[keyof typeof USER_PAGE_CONTENT_TYPES];
export const USER_PAGE_CONTENT_SORT_BY_TYPES = Object.freeze({
  NEW: "new",
  TOP: "top",
});
export type UserPageContentSortByType =
  (typeof USER_PAGE_CONTENT_SORT_BY_TYPES)[keyof typeof USER_PAGE_CONTENT_SORT_BY_TYPES];

export const USER_NOTIFICATION_TYPES = Object.freeze({
  POST_REMOVED: "post_removed",
  IMAGE_REMOVED: "image_removed",
  POST_APPROVED: "post_approved",
  POST_REJECTED: "post_rejected",

  COMMUNITY_CREATED: "community_created",

  COMMENT_REPLY: "comment_reply",
  COMMENT_REMOVED: "comment_removed",

  NEW_FOLLOWER: "new_follower",
  POST_UPVOTE: "post_upvote",
  COMMENT_UPVOTE: "comment_upvote",

  MODERATION_WARNING: "moderation_warning",
  MODERATION_UPDATE: "moderation_update",

  SYSTEM: "system",
});
export type UserNotificationType =
  (typeof USER_NOTIFICATION_TYPES)[keyof typeof USER_NOTIFICATION_TYPES];
