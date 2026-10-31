const {
  Comment,
  Post,
  UserRatedPosts,
  UserRatedComments,
} = require("../models/index");
const { redisClient } = require("../utils/redis");
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

const throttlePostLikes =
  (socket) =>
  async ([event, ...args], next) => {
    const throttledEvents = ["likePost", "dislikePost"];
    if (!throttledEvents.includes(event)) {
      return next();
    }

    const userId = socket.data.user.id;
    const postId = args[0]?.postId;

    if (!postId) {
      return next(new Error("Post ID is required"));
    }

    const key = `rl:vote:post:${userId}:${postId}`;

    try {
      const ok = await redisClient.set(key, "1", { PX: 3000, NX: true });
      if (!ok) return next(new Error("Rate limit exceeded"));
      next();
    } catch (e) {
      console.error("rate limit check failed", e);
      next(); // allow the vote through if Redis fails
    }
  };

const throttleCommentLikes =
  (socket) =>
  async ([event, ...args], next) => {
    const throttledEvents = ["likeComment", "dislikeComment"];
    if (!throttledEvents.includes(event)) {
      return next();
    }

    const userId = socket.data.user.id;
    const commentId = args[0]?.commentId;

    if (!commentId) {
      return next(new Error("Comment ID is required"));
    }

    const key = `rl:vote:comment:${userId}:${commentId}`;

    try {
      const ok = await redisClient.set(key, "1", { PX: 3000, NX: true });
      if (!ok) return next(new Error("Rate limit exceeded"));
      next();
    } catch (e) {
      console.error("rate limit check failed", e);
      next(); // allow the vote through if Redis fails
    }
  };

const requireAuth =
  (socket) =>
  ([event], next) => {
    const protectedEvents = [
      "likePost",
      "dislikePost",
      "likeComment",
      "dislikeComment",
    ];
    if (!protectedEvents.includes(event)) {
      return next();
    }
    if (!socket.data?.user?.id) {
      return next(new Error("Not authenticated"));
    }
    return next();
  };

module.exports = function (io) {
  io.on("connection", (socket) => {
    socket.use(requireAuth(socket));

    socket.use(throttlePostLikes(socket));

    socket.use(throttleCommentLikes(socket));

    socket.on("likePost", async ({ postId }, cb) => {
      if (!socket.data?.user) {
        return;
      }
      const userId = socket.data.user.id;

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
    socket.on("dislikePost", async ({ postId }, cb) => {
      if (!socket.data?.user) {
        return;
      }
      const userId = socket.data.user.id;
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

    socket.on("likeComment", async ({ commentId }) => {
      if (!socket.data?.user) {
        return;
      }
      const userId = socket.data.user.id;
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

    socket.on("dislikeComment", async ({ commentId }) => {
      if (!socket.data?.user) {
        return;
      }
      const userId = socket.data.user.id;
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
