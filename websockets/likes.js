const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("../models/index");

module.exports = function (io) {
  io.on("connection", (socket) => {
    console.log(socket.id);

    socket.on("likePost", async (postId) => {
      const post = await Post.findByPk(postId);
      const result = await post.increment("upVotes", { by: 1 }).catch((e) => {
        return res
          .status(500)
          .json("something went wrong when updating upVotes");
      });
      io.emit("post_received_likes", postId);
    });
    socket.on("dislikePost", async (postId) => {
      const post = await Post.findByPk(postId);
      const result = await post.increment("downVotes", { by: 1 }).catch((e) => {
        return res
          .status(500)
          .json("something went wrong when updating upVotes");
      });
      io.emit("post_received_dislikes", postId);
    });

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
