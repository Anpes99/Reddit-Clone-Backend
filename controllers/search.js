const searchRouter = require("express").Router();
const { Op } = require("sequelize");
const { Subreddit, Post, User } = require("../models/index");
const { sequelize } = require("../utils/db");
const { validate } = require("../utils/middleware");
const {
  searchSuggestionsSchema,
  searchPostsSchema,
  searchSubredditsSchema,
} = require("../validators/search.validator");
const { postsOrderType } = require("../enums/post.enum");

searchRouter.post(
  "/suggestions",
  validate(searchSuggestionsSchema),
  async (req, res) => {
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
  },
);

searchRouter.post("/posts", validate(searchPostsSchema), async (req, res) => {
  const { searchQuery, offset, limit, orderType } = req.body;

  if (orderType !== postsOrderType.TOP) {
    const options = {
      where: {
        title: {
          [Op.iLike]: `%${String(searchQuery).toLowerCase()}%`,
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
        { model: Subreddit, attributes: ["name", "iconUrl"] },
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
          [Op.iLike]: `%${String(searchQuery).toLowerCase()}%`,
        },
      },
      offset,
      limit,
      include: [
        {
          model: User,
          attributes: ["username"],
        },
        { model: Subreddit, attributes: ["name", "iconUrl"] },
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

searchRouter.post(
  "/subreddits",
  validate(searchSubredditsSchema),
  async (req, res) => {
    const { searchQuery, offset, limit } = req.body;

    const options = {
      offset,
      limit,
      where: {
        name: {
          [Op.iLike]: `%${searchQuery}%`,
        },
      },
      attributes: ["id", "name", "description", "memberCount", "iconUrl"],
    };
    const countOptions = { where: options.where };
    const totalCount = await Subreddit.count(countOptions);
    const subreddits = await Subreddit.findAll(options);
    return res.send({ subreddits, totalCount });
  },
);

module.exports = searchRouter;
