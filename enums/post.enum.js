const commentsSortBy = Object.freeze({
  CREATED_AT: "createdAt",
  UP_VOTES: "upVotes",
});

const postsOrderType = Object.freeze({
  TOP: "TOP",
  NEW: "NEW",
});

const postModerationStatus = Object.freeze({
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REVIEW_REQUIRED: "review_required",
});

module.exports = {
  commentsSortBy,
  postsOrderType,
  postModerationStatus,
};
