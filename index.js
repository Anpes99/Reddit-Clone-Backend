const http = require("http");
const app = require("./app");
const config = require("./utils/config");

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("./models/index");

io.on("connection", (socket) => {
  console.log(socket.id);
  socket.on(
    "fetch_more_posts",
    async (order, sortBy, offset, limit, subredditId, cb) => {
      const totalCountOptions = {};
      if (subredditId)
        totalCountOptions.where = { subredditId: Number(subredditId) };
      const totalCount = await Post.count(totalCountOptions);

      const options = {
        order: [["createdAt", "DESC"]],
        offset,
        limit,
        include: [
          { model: User, attributes: ["username"] },
          { model: Subreddit, attributes: ["name"] },
        ],
      };
      console.log("subreditid", subredditId);
      if (subredditId) options.where = { subredditId: Number(subredditId) };
      console.log(options);
      if (order && sortBy) options.order = [[sortBy, order]];
      console.log("getting more posts");
      const posts = await Post.findAll(options);
      cb({ posts, totalCount });
    }
  );

  socket.on("likePost", async (postId) => {
    const post = await Post.findByPk(postId);
    const result = await post.increment("upVotes", { by: 1 }).catch((e) => {
      return res.status(500).json("something went wrong when updating upVotes");
    });
    io.emit("post_received_likes", postId);
  });
  socket.on("dislikePost", async (postId) => {
    const post = await Post.findByPk(postId);
    const result = await post.increment("downVotes", { by: 1 }).catch((e) => {
      return res.status(500).json("something went wrong when updating upVotes");
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

const PORT = config.PORT || 3001;
server.listen(config.PORT);
console.log("server running on port " + config.PORT);

module.exports = { io };
