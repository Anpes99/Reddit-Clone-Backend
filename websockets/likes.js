const UserRatedComments = require("../models/UserRatedComments");
const { Comment, Post, UserRatedPosts } = require("../models/index");
const {
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
} = require("./utils");

module.exports = function (io) {
  io.on("connection", (socket) => {
    socket.on("likePost", async ({ postId, userId }, cb) => {
      try {
        const post = await Post.findByPk(postId);

        if (!post) {
          throw new Error("post not found for given postId");
        }

        const dbExistingPostVoteByUser = await UserRatedPosts.findOne({
          where: { postId, userId },
        });
        if (dbExistingPostVoteByUser) {
          if (dbExistingPostVoteByUser.rating === 1) {
            await cancelPostUpvote({
              dbPost: post,
              dbExistingPostVoteByUser,
              postId,
              io,
            });

            return cb({
              success: true,
              newRating: 0,
            });
          }
          if (dbExistingPostVoteByUser.rating === -1) {
            await turnPostDownvoteIntoUpvote({
              dbPost: post,
              dbExistingPostVoteByUser,
              postId,
              io,
            });

            return cb({
              success: true,
              newRating: 1,
            });
          }
        } else {
          await createNewPostUpvote({
            dbPost: post,
            postId,
            userId,
            io,
          });

          return cb({
            success: true,
            newRating: 1,
          });
        }
      } catch (e) {
        console.log(e);
        return cb({ success: false });
      }
    });
    socket.on("dislikePost", async ({ postId, userId }, cb) => {
      try {
        const post = await Post.findByPk(postId);
        if (!post) {
          throw new Error("post not found for given postId");
        }

        const dbExistingPostVoteByUser = await UserRatedPosts.findOne({
          where: { postId, userId },
        });
        if (dbExistingPostVoteByUser) {
          if (dbExistingPostVoteByUser.rating === 1) {
            await turnPostUpvoteIntoDownvote({
              dbPost: post,
              postId,
              dbExistingPostVoteByUser,
              io,
            });

            return cb({ success: true, newRating: -1 });
          }
          if (dbExistingPostVoteByUser.rating === -1) {
            await cancelPostDownvote({ dbPost: post, userId, postId, io });

            return cb({ success: true, newRating: 0 });
          }
        } else {
          await createNewPostDownvote({ dbPost: post, postId, userId, io });

          return cb({ success: true, newRating: -1 });
        }
      } catch (e) {
        console.log(e);
        return cb({ success: false });
      }
    });

    socket.on("likeComment", async ({ commentId, userId }) => {
      try {
        if (!commentId || !userId) {
          throw new Error("Missing commentId or userId");
        }
        const comment = await Comment.findByPk(commentId);
        if (!comment) {
          throw new Error("Comment with the given commentId not found");
        }
        const existingVoteByUser = await UserRatedComments.findOne({
          where: { commentId, userId },
        });
        if (existingVoteByUser) {
          if (existingVoteByUser.rating === 1) {
            await cancelCommentUpvote({
              dbComment: comment,
              dbExistingVoteByUser: existingVoteByUser,
              io,
            });
          } else if (existingVoteByUser.rating === -1) {
            await turnCommentDownvoteIntoUpvote({
              dbComment: comment,
              dbExistingVoteByUser: existingVoteByUser,
              io,
            });
          }
        } else {
          await createNewUpvoteForComment({ dbComment: comment, userId, io });
        }
      } catch (e) {
        console.log("something went wrong when updating upVotes", e);
      }
    });

    socket.on("dislikeComment", async ({ commentId, userId }) => {
      try {
        if (!commentId || !userId) {
          throw new Error("Missing commentId or userId");
        }

        const comment = await Comment.findByPk(commentId);

        if (!comment) {
          throw new Error("Comment with the given commentId not found");
        }

        const existingVoteByUser = await UserRatedComments.findOne({
          where: { commentId, userId },
        });

        if (existingVoteByUser) {
          if (existingVoteByUser.rating === 1) {
            await turnCommentUpvoteIntoDownvote({
              dbComment: comment,
              dbExistingVoteByUser: existingVoteByUser,
              io,
            });
          } else if (existingVoteByUser.rating === -1) {
            await cancelCommentDownvote({
              dbComment: comment,
              dbExistingVoteByUser: existingVoteByUser,
              io,
            });
          }
        } else {
          await createNewDownvoteForComment({ dbComment: comment, userId, io });
        }
      } catch (e) {
        console.log("something went wrong when updating downVotes", e);
      }
    });
  });
};
