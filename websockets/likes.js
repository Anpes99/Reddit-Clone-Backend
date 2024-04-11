const UserRatedComments = require("../models/UserRatedComments");
const { Comment, Post, UserRatedPosts } = require("../models/index");
const {
  cancelCommentUpvote,
  cancelCommentDownvote,
  turnCommentDownvoteIntoUpvote,
  turnCommentUpvoteIntoDownvote,
  createNewUpvoteForComment,
  createNewDownvoteForComment,
} = require("./utils");

function createOrUpdatePostRatingByUser(values, condition) {
  return UserRatedPosts.findOne({ where: condition }).then(function (obj) {
    // update
    if (obj) return obj.update(values);
    // insert
    return UserRatedPosts.create(values);
  });
}

module.exports = function (io) {
  io.on("connection", (socket) => {
    socket.on("likePost", async (postId, userId, rating, pointsToAdd, cb) => {
      const post = await Post.findByPk(postId);

      if (rating === 0) {
        // cancel upvote

        try {
          await UserRatedPosts.destroy({
            where: { userId, postId },
          }); //destroy

          await post.decrement("upVotes", { by: 1 }).catch((e) => {
            // decrement
            console.log("something went wrong when updating upVotes", e);
          });
          io.emit("post_received_likes", postId, pointsToAdd);
          return cb({ success: true });
        } catch (e) {
          return cb({ success: false });
        }
      }

      try {
        if (pointsToAdd === 2) {
          // turn downvote to an upvote
          await post.decrement("downVotes", { by: 1 }).catch((e) => {
            console.log("something went wrong when updating upVotes", e);
          });
        }
        await post.increment("upVotes", { by: 1 }).catch((e) => {
          console.log("something went wrong when updating upVotes", e);
        });
        await createOrUpdatePostRatingByUser(
          { userId, postId, rating },
          { userId, postId }
        );

        io.emit("post_received_likes", postId, pointsToAdd);

        return cb({ success: true });
      } catch (e) {
        return cb({ success: false });
      }
    });
    socket.on(
      "dislikePost",
      async (postId, userId, rating, pointsToAdd, cb) => {
        const post = await Post.findByPk(postId);

        if (rating === 0) {
          // cancel downvote
          try {
            await UserRatedPosts.destroy({
              where: { userId, postId },
            }).catch((e) => {
              console.log(e);
            }); //destroy existing rating
            await post.decrement("downVotes", { by: 1 }).catch((e) => {
              // decrement
              console.log("something went wrong when updating upVotes", e);
            });
            io.emit("post_received_dislikes", postId, pointsToAdd);
            return cb({ success: true });
          } catch (e) {
            return cb({ success: false });
          }
        }
        try {
          if (pointsToAdd === -2) {
            // turn downvote to an upvote  // cancel upvote
            await post.decrement("upVotes", { by: 1 }).catch((e) => {
              console.log("something went wrong when updating upVotes", e);
            });
          }
          await post.increment("downVotes", { by: 1 }).catch((e) => {
            console.log("something went wrong when updating upVotes", e);
          });
          await createOrUpdatePostRatingByUser(
            // create or update existing rating
            { userId, postId, rating },
            { userId, postId }
          );

          io.emit("post_received_dislikes", postId, pointsToAdd);

          return cb({ success: true });
        } catch (e) {
          return cb({ success: false });
        }
      }
    );

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
