const searchRouter = require("express").Router();
const { Op } = require("sequelize");
const { Subreddit, Post, User } = require("../models/index");
const { sequelize } = require("../utils/db");

searchRouter.post("/", async (req, res) => {
  const searchWord = req.body.searchWord;
  const result = await Subreddit.findAll({
    where: {
      name: {
        [Op.iLike]: `%${searchWord}%`,
      },
    },
    attributes: ["id", "name"],
    limit: 10,
  });
  return res.send({ result });
});

searchRouter.post("/posts", async (req, res) => {
  const { searchQuery, offset, limit, order, sortBy, orderType } = req.body;

  if (orderType !== "top") {
    const options = {
      where: {
        title: {
          [Op.iLike]: `%${searchQuery}%`,
        },
      },
      offset,
      limit,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: User,
          attributes: ["username"],
        },
        { model: Subreddit, attributes: ["name"] },
      ],
    };

    const countOptions = { where: options.where };
    const totalCount = await Post.count(countOptions);
    const posts = await Post.findAll(options);
    return res.send({ posts, totalCount });
  } else {
    const options = {
      where: {
        title: {
          [Op.iLike]: `%${searchQuery}%`,
        },
      },
      offset,
      limit,
      include: [
        {
          model: User,
          attributes: ["username"],
        },
        { model: Subreddit, attributes: ["name"] },
      ],
      order: [
        [sequelize.literal('"up_votes"-"down_votes"'), "desc"],
        ["createdAt", "DESC"],
      ],
    };

    const countOptions = { where: options.where };
    const totalCount = await Post.count(countOptions);

    const posts = await Post.findAll(options);

    return res.send({ posts, totalCount });
  }
});

searchRouter.post("/subreddits", async (req, res) => {
  const { searchQuery, offset, limit } = req.body;

  const options = {
    offset,
    limit,
    where: {
      name: {
        [Op.iLike]: `%${searchQuery}%`,
      },
    },
    attributes: ["id", "name", "description"],
  };
  const countOptions = { where: options.where };
  const totalCount = await Subreddit.count(countOptions);
  const subreddits = await Subreddit.findAll(options);
  return res.send({ subreddits, totalCount });
});

module.exports = searchRouter;
