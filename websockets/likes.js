const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
  UserRatedPosts,
} = require("../models/index");

function upsert(values, condition) {
  return UserRatedPosts.findOne({ where: condition }).then(function (obj) {
    // update
    if (obj) return obj.update(values);
    // insert
    return UserRatedPosts.create(values);
  });
}

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log(socket.id);

    socket.on("likePost", async (postId, userId, rating, pointsToAdd, cb) => {
      const post = await Post.findByPk(postId);

      if (rating === 0) {
        // cancel upvote

        try {
          const res = await UserRatedPosts.destroy({
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
        const result = await upsert(
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
            const res = await UserRatedPosts.destroy({
              where: { userId, postId },
            }).catch((e) => {
              console.log("delete result ", e);
              console.log(e);
            }); //destroy existing rating
            console.log("delete result ", res);
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
          const result = await upsert(
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

    socket.on("likeComment", async (commentId) => {
      try {
        const comment = await Comment.findByPk(commentId);
        const result = await comment.increment("upVotes", { by: 1 });

        io.emit("comment_received_likes", commentId);
      } catch (e) {
        console.log("something went wrong when updating upVotes");
      }
    });

    socket.on("dislikeComment", async (commentId) => {
      try {
        const comment = await Comment.findByPk(commentId);
        const result = await comment.increment("downVotes", { by: 1 });

        io.emit("comment_received_dislikes", commentId);
      } catch (e) {
        console.log("something went wrong when updating downVotes");
      }
    });
  });
};
