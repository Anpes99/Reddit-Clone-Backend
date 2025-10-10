const { sequelize } = require("../models/Comment");
const { User, Post, Subreddit } = require("../models/index");

module.exports = function (io) {
  io.on("connection", (socket) => {
    socket.on(
      "fetch_more_posts",
      async ({ order, sortBy, offset, limit, subredditId, username }, cb) => {
        const totalCountOptions = {};
        if (username) {
          totalCountOptions.include = [
            {
              model: User,
              where: { username },
              required: true,
            },
          ];
        }

        if (subredditId)
          totalCountOptions.where = { subredditId: Number(subredditId) };
        const totalCount = await Post.count(totalCountOptions);

        const options = {
          order: [["createdAt", "DESC"]],
          offset,
          limit,
          include: [
            {
              model: User,
              attributes: ["username"],
              ...(username ? { where: { username }, required: true } : {}),
            },
            { model: Subreddit, attributes: ["name"] },
          ],
        };
        if (subredditId) options.where = { subredditId: Number(subredditId) };

        if (order && sortBy) options.order = [[sortBy, order]];

        const posts = await Post.findAll(options);
        cb({ posts, totalCount });
      }
    );

    socket.on(
      "fetch_top_posts",
      async ({ offset, subredditId, username }, cb) => {
        const totalCountOptions = {};
        if (username) {
          totalCountOptions.include = [
            {
              model: User,
              where: { username },
              required: true,
            },
          ];
        }
        if (subredditId)
          totalCountOptions.where = { subredditId: Number(subredditId) };
        const totalCount = await Post.count(totalCountOptions);

        const options = {
          offset,
          limit: 5,
          include: [
            {
              model: User,
              attributes: ["username"],
              ...(username ? { where: { username }, required: true } : {}),
            },
            { model: Subreddit, attributes: ["name", "id"] },
          ],
          order: [
            [sequelize.literal('"up_votes"-"down_votes"'), "desc"],
            ["createdAt", "DESC"],
          ],
        };

        if (subredditId) options.where = { subredditId: Number(subredditId) };

        const posts = await Post.findAll(options);

        cb({ posts, totalCount });
      }
    );
  });
};
