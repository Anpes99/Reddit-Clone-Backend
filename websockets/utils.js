const { UserRatedPosts } = require("../models");
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

const cancelPostUpvote = async ({
  dbPost,
  dbExistingPostVoteByUser,
  postId,
  io,
}) => {
  await dbPost.decrement("upVotes", { by: 1 });
  await UserRatedPosts.destroy({
    where: { id: dbExistingPostVoteByUser.id },
  });
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -1 });
};

const turnPostDownvoteIntoUpvote = async ({
  dbPost,
  dbExistingPostVoteByUser,
  postId,
  io,
}) => {
  await dbPost.decrement("downVotes", { by: 1 });
  await dbPost.increment("upVotes", { by: 1 });
  await dbExistingPostVoteByUser.update({ rating: 1 });
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 2 });
};

const createNewPostUpvote = async ({ dbPost, postId, userId, io }) => {
  await dbPost.increment("upVotes", { by: 1 });
  await UserRatedPosts.create({ userId, postId, rating: 1 });

  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 1 });
};

const turnPostUpvoteIntoDownvote = async ({
  dbPost,
  postId,
  dbExistingPostVoteByUser,
  io,
}) => {
  await dbPost.decrement("upVotes", { by: 1 });
  await dbPost.increment("downVotes", { by: 1 });

  await dbExistingPostVoteByUser.update({ rating: -1 });
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -2 });
};

const cancelPostDownvote = async ({ dbPost, userId, postId, io }) => {
  await dbPost.decrement("downVotes", { by: 1 });
  await UserRatedPosts.destroy({ where: { userId, postId } });
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 1 });
};

const createNewPostDownvote = async ({ dbPost, postId, userId, io }) => {
  await dbPost.increment("downVotes", { by: 1 });
  await UserRatedPosts.create({ userId, postId, rating: -1 });
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -1 });
};

module.exports = {
  cancelCommentUpvote,
  cancelCommentDownvote,
  turnCommentDownvoteIntoUpvote,
  turnCommentUpvoteIntoDownvote,
  createNewUpvoteForComment,
  createNewDownvoteForComment,
  cancelPostUpvote,
  turnPostDownvoteIntoUpvote,
  createNewPostUpvote,
  turnPostUpvoteIntoDownvote,
  cancelPostDownvote,
  createNewPostDownvote,
};
