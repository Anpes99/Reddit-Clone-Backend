const io = require("socket.io")(4000, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"],
  },
});
const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("../models/index");

io.on("connection", (socket) => {
  console.log(socket.id);
  socket.on("fetch_more_posts", async (order, sortBy, offset, limit, cb) => {
    const totalCount = await Post.count({});

    const options = {
      order: [["createdAt", "DESC"]],
      offset,
      limit,
      include: [
        { model: User, attributes: ["username"] },
        { model: Subreddit, attributes: ["name"] },
      ],
    };

    if (order && sortBy) options.order = [[sortBy, order]];
    console.log("getting more posts");
    const posts = await Post.findAll(options);
    cb({ posts, totalCount });
  });

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
});

module.exports = io;
