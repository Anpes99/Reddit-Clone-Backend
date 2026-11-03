const USER_PAGE_CONTENT_TYPES = Object.freeze({
  POSTS: "posts",
  COMMENTS: "comments",
  OVERVIEW: "overview",
});
const USER_PAGE_CONTENT_SORT_BY_TYPES = Object.freeze({
  NEW: "new",
  TOP: "top",
});

const USER_NOTIFICATION_TYPES = Object.freeze({
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

module.exports = {
  USER_PAGE_CONTENT_TYPES,
  USER_PAGE_CONTENT_SORT_BY_TYPES,
  USER_NOTIFICATION_TYPES,
};
