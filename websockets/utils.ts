import type { Transaction } from "sequelize";
import { UserRatedComments, UserRatedPosts } from "../models/index";
import type Comment from "../models/Comment";
import type Post from "../models/Post";
import { sequelize } from "../utils/db";
import type { AppServer } from "./types";

type CommentVoteChangeArgs = {
  dbComment: Comment;
  dbExistingVoteByUser: UserRatedComments;
  io: AppServer;
};

type NewCommentVoteArgs = {
  dbComment: Comment;
  userId: number;
  io: AppServer;
};

type PostVoteChangeArgs = {
  dbPost: Post;
  dbExistingPostVoteByUser: UserRatedPosts;
  postId: number;
  io: AppServer;
};

type NewPostVoteArgs = {
  dbPost: Post;
  postId: number;
  userId: number;
  io: AppServer;
};

const applyVoteChange = async (
  writeVoteRow: (transaction: Transaction) => Promise<unknown>,
  updateCounters: (transaction: Transaction) => Promise<unknown>,
) => {
  await sequelize.transaction(async (transaction) => {
    const affectedRows = await writeVoteRow(transaction);
    if (!affectedRows) {
      throw new Error("vote was changed by another request");
    }
    await updateCounters(transaction);
  });
};

const cancelCommentUpvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}: CommentVoteChangeArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedComments.destroy({
        where: { id: dbExistingVoteByUser.id, rating: 1 },
        transaction,
      }),
    (transaction) => dbComment.decrement("upVotes", { by: 1, transaction }),
  );
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: -1,
  });
};

const cancelCommentDownvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}: CommentVoteChangeArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedComments.destroy({
        where: { id: dbExistingVoteByUser.id, rating: -1 },
        transaction,
      }),
    (transaction) => dbComment.decrement("downVotes", { by: 1, transaction }),
  );
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 1,
  });
};

const turnCommentDownvoteIntoUpvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}: CommentVoteChangeArgs) => {
  await applyVoteChange(
    async (transaction) => {
      const [updatedRows] = await UserRatedComments.update(
        { rating: 1 },
        { where: { id: dbExistingVoteByUser.id, rating: -1 }, transaction },
      );
      return updatedRows;
    },
    async (transaction) => {
      await dbComment.decrement("downVotes", { by: 1, transaction });
      await dbComment.increment("upVotes", { by: 1, transaction });
    },
  );
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 2,
  });
};

const turnCommentUpvoteIntoDownvote = async ({
  dbComment,
  dbExistingVoteByUser,
  io,
}: CommentVoteChangeArgs) => {
  await applyVoteChange(
    async (transaction) => {
      const [updatedRows] = await UserRatedComments.update(
        { rating: -1 },
        { where: { id: dbExistingVoteByUser.id, rating: 1 }, transaction },
      );
      return updatedRows;
    },
    async (transaction) => {
      await dbComment.decrement("upVotes", { by: 1, transaction });
      await dbComment.increment("downVotes", { by: 1, transaction });
    },
  );
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: -2,
  });
};

const createNewUpvoteForComment = async ({
  dbComment,
  userId,
  io,
}: NewCommentVoteArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedComments.create(
        { commentId: dbComment.id, userId, rating: 1 },
        { transaction },
      ),
    (transaction) => dbComment.increment("upVotes", { by: 1, transaction }),
  );
  io.emit("comment_likes_changed", {
    commentId: dbComment.id,
    ratingToPlusOrMinus: 1,
  });
};

const createNewDownvoteForComment = async ({
  dbComment,
  userId,
  io,
}: NewCommentVoteArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedComments.create(
        { commentId: dbComment.id, userId, rating: -1 },
        { transaction },
      ),
    (transaction) => dbComment.increment("downVotes", { by: 1, transaction }),
  );
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
}: PostVoteChangeArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedPosts.destroy({
        where: { id: dbExistingPostVoteByUser.id, rating: 1 },
        transaction,
      }),
    (transaction) => dbPost.decrement("upVotes", { by: 1, transaction }),
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -1 });
};

const turnPostDownvoteIntoUpvote = async ({
  dbPost,
  dbExistingPostVoteByUser,
  postId,
  io,
}: PostVoteChangeArgs) => {
  await applyVoteChange(
    async (transaction) => {
      const [updatedRows] = await UserRatedPosts.update(
        { rating: 1 },
        { where: { id: dbExistingPostVoteByUser.id, rating: -1 }, transaction },
      );
      return updatedRows;
    },
    async (transaction) => {
      await dbPost.decrement("downVotes", { by: 1, transaction });
      await dbPost.increment("upVotes", { by: 1, transaction });
    },
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 2 });
};

const createNewPostUpvote = async ({
  dbPost,
  postId,
  userId,
  io,
}: NewPostVoteArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedPosts.create({ userId, postId, rating: 1 }, { transaction }),
    (transaction) => dbPost.increment("upVotes", { by: 1, transaction }),
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 1 });
};

const turnPostUpvoteIntoDownvote = async ({
  dbPost,
  postId,
  dbExistingPostVoteByUser,
  io,
}: PostVoteChangeArgs) => {
  await applyVoteChange(
    async (transaction) => {
      const [updatedRows] = await UserRatedPosts.update(
        { rating: -1 },
        { where: { id: dbExistingPostVoteByUser.id, rating: 1 }, transaction },
      );
      return updatedRows;
    },
    async (transaction) => {
      await dbPost.decrement("upVotes", { by: 1, transaction });
      await dbPost.increment("downVotes", { by: 1, transaction });
    },
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -2 });
};

const cancelPostDownvote = async ({
  dbPost,
  userId,
  postId,
  io,
}: NewPostVoteArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedPosts.destroy({
        where: { userId, postId, rating: -1 },
        transaction,
      }),
    (transaction) => dbPost.decrement("downVotes", { by: 1, transaction }),
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: 1 });
};

const createNewPostDownvote = async ({
  dbPost,
  postId,
  userId,
  io,
}: NewPostVoteArgs) => {
  await applyVoteChange(
    (transaction) =>
      UserRatedPosts.create({ userId, postId, rating: -1 }, { transaction }),
    (transaction) => dbPost.increment("downVotes", { by: 1, transaction }),
  );
  io.emit("post_likes_changed", { postId, pointsToAddOrMinus: -1 });
};

export {
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
