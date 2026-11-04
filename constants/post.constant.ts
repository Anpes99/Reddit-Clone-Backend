export const COMMENTS_SORT_BY = Object.freeze({
  CREATED_AT: "createdAt",
  UP_VOTES: "upVotes",
});
export type CommentsSortBy =
  (typeof COMMENTS_SORT_BY)[keyof typeof COMMENTS_SORT_BY];

export const POSTS_ORDER_TYPE = Object.freeze({
  TOP: "TOP",
  NEW: "NEW",
});
export type PostsOrderType =
  (typeof POSTS_ORDER_TYPE)[keyof typeof POSTS_ORDER_TYPE];

export const POST_MODERATION_STATUS = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REVIEW_REQUIRED: "review_required",
});
export type PostModerationStatus =
  (typeof POST_MODERATION_STATUS)[keyof typeof POST_MODERATION_STATUS];
