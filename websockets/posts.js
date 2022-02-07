/*const io = require("socket.io")(3001, {
  cors: {
    origin: [
      "http://localhost:3001",
      "http://localhost:3000",
      "https://reddit1000.herokuapp.com/",
    ],
  },
});*/
const { sequelize } = require("../models/Comment");
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

    socket.on("fetch_top_posts", async (offset, subredditId, cb) => {
      const totalCountOptions = {};
      if (subredditId)
        totalCountOptions.where = { subredditId: Number(subredditId) };
      const totalCount = await Post.count(totalCountOptions);

      const options = {
        offset,
        limit: 5,
        include: [
          { model: User, attributes: ["username"] },
          { model: Subreddit, attributes: ["name", "id"] },
        ],
        order: [[sequelize.literal('"up_votes"-"down_votes"'), "desc"]],
      };
      console.log("subreditid", subredditId);
      if (subredditId) options.where = { subredditId: Number(subredditId) };
      console.log(options);
      console.log("getting more top posts");
      const posts = await Post.findAll(options);
      console.log(posts);
      cb({ posts, totalCount });
    });
  });
};
