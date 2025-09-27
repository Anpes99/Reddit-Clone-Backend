const postsRouter = require("express").Router();
const { User, Comment, Post, Subreddit } = require("../models/index");
const { sequelize } = require("../utils/db");

postsRouter.get("/", async (req, res) => {
  const order = req.query.order;
  const sortBy = req.query.sortBy;
  const offset = req.query.offset || null;
  const limit = req.query.limit || 10;
  const subredditName = req.query.subredditName;
  let subredditId;
  if (subredditName) {
    const subreddit = await Subreddit.findOne({
      where: { name: subredditName },
    });
    subredditId = subreddit.id;
  }

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

  if (subredditId) options.where = { subredditId: subredditId };

  if (order && sortBy) options.order = [[sortBy, order]];

  const posts = await Post.findAll(options);
  return res.send({ posts, totalCount });
});

postsRouter.get("/:id", async (req, res) => {
  const a = { model: Comment, include: {} };
  a.include = { model: Comment, include: {} };
  a.include.include = { model: Comment, include: {} };
  a.include.include.include = { model: Comment, include: {} };
  a.include.include.include.include = { model: Comment, include: {} };
  a.include.include.include.include.include = { model: Comment };
  const includedCommentsTree = a;

  const order = req.query.order;
  const sortBy = req.query.sortBy;

  const options = {
    include: [
      {
        model: Comment,
        where: { directReplyToPost: true },
        include: includedCommentsTree,
        required: false,
      },
      { model: Subreddit, required: false },
      { model: User, attributes: ["username"], required: true },
    ],
    order:
      sortBy === "upVotes" || !sortBy
        ? [
            [
              sequelize.literal('comments."up_votes"-comments."down_votes"'),
              order || "DESC",
            ],
          ]
        : [[Comment, sortBy, order || "DESC"]],
  };

  const post = await Post.findByPk(req.params.id, options).catch((e) =>
    console.log(e)
  );

  const totalComments = await Comment.count({
    where: { postId: req.params.id },
  });

  return res.send({ post, totalComments });
});

postsRouter.post("/", async (req, res) => {
  const { title, text, subredditName, imageUrl } = req.body;

  const subreddit = await Subreddit.findOne({
    where: { name: subredditName },
    required: true,
  });

  if (!title || !text || !subreddit?.id) {
    return res
      .status(400)
      .json("missing information. Please include all required information.");
  }

  if (req.user.id) {
    await Post.create({
      title: title,
      text: text,
      imageUrl,
      userId: req.user.id,
      subredditId: subreddit.id,
    }).catch((e) => {
      console.log(e);
      return res.status(400).json("error when creating new post:");
    });

    return res.status(201).json("New post created");
  } else {
    return res.status(401).send("you have to be logged in to create new posts");
  }
});

module.exports = postsRouter;
