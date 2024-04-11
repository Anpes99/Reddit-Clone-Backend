const UserRatedComments = require("../models/UserRatedComments");

const cancelCommentUpvote = async ({ dbComment, dbExistingVoteByUser, io }) => {
  await dbComment.decrement("upVotes", { by: 1 });
  await UserRatedComments.destroy({
    where: { id: dbExistingVoteByUser.id },
  });
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: -1,
  });
};

const cancelCommentDownvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}) => {
  await dbComment.decrement("downVotes", { by: 1 });

  await UserRatedComments.destroy({
    where: { id: dbExistingVoteByUser.id },
  });
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 1,
  });
};

const turnCommentDownvoteIntoUpvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}) => {
  await dbComment.decrement("downVotes", { by: 1 });
  await dbComment.increment("upVotes", { by: 1 });

  await dbExistingVoteByUser.update({
    rating: 1,
  });
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 2,
  });
};

const turnCommentUpvoteIntoDownvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}) => {
  await dbComment.decrement("upVotes", { by: 1 });
  await dbComment.increment("downVotes", { by: 1 });

  await dbExistingVoteByUser.update({
    rating: -1,
  });

  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: -2,
  });
};

const createNewUpvoteForComment = async ({ dbComment, userId, io }) => {
  await dbComment.increment("upVotes", { by: 1 });
  await UserRatedComments.create({
    commentId: dbComment.id,
    userId,
    rating: 1,
  });

  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 1,
  });
};

const createNewDownvoteForComment = async ({ dbComment, userId, io }) => {
  await dbComment.increment("downVotes", { by: 1 });
  await UserRatedComments.create({
    commentId: dbComment.id,
    userId,
    rating: -1,
  });

  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: -1,
  });
};

module.exports = {
  cancelCommentUpvote,
  cancelCommentDownvote,
  turnCommentDownvoteIntoUpvote,
  turnCommentUpvoteIntoDownvote,
  createNewUpvoteForComment,
  createNewDownvoteForComment,
};
