const postsRouter = require("express").Router();
const { AppError } = require("../errors");
const { User, Comment, Post, Subreddit } = require("../models/index");
const { sequelize } = require("../utils/db");
const { generateEmbedding } = require("../utils/embeddings");
const { validate, requireAuth } = require("../utils/middleware/middleware");
const {
  createPostRequestLimiter,
} = require("../utils/middleware/requestRateLimiters");
const {
  getPostSchema,
  postNewPostSchema,
} = require("../validators/post.validator");

postsRouter.get("/:id", validate(getPostSchema, "query"), async (req, res) => {
  const order = req.query.order;
  const sortBy = req.query.sortBy;

  const options = {
    include: [
      {
        model: Comment,
        where: { directReplyToPost: true },
        include: [
          {
            model: User,
            attributes: ["username", "avatarImageUrl"],
            required: true,
          },
        ],
        required: false,
      },
      { model: Subreddit, as: "subreddit", required: false },
      {
        model: User,
        attributes: ["username"],
        required: true,
      },
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

  const post = await Post.findByPk(req.params.id, options);
  if (!post) {
    throw new AppError({
      status: 404,
      code: "POST_NOT_FOUND",
      message: "post not found",
      details: {},
    });
  }
  return res.send({ post });
});

postsRouter.post(
  "/",
  requireAuth,
  createPostRequestLimiter,
  validate(postNewPostSchema),
  async (req, res) => {
    const { title, text, subredditName, imageUrl } = req.body;

    const subreddit = await Subreddit.findOne({
      where: { name: subredditName },
    });

    if (!subreddit) {
      throw new AppError({
        status: 404,
        code: "SUBREDDIT_NOT_FOUND",
        message: "subreddit not found",
        details: {},
      });
    }

    if (!title || !text) {
      throw new AppError({
        status: 400,
        code: "MISSING_INFORMATION",
        message:
          "missing information. Please include all required information.",
        details: {},
      });
    }

    const textForEmbedding = `${title}\n\n${text}`;

    const embedding = await generateEmbedding(textForEmbedding, "document");

    await Post.create({
      title: title,
      text: text,
      imageUrl,
      userId: req.user.id,
      subredditId: subreddit.id,
      embedding,
    });

    return res.status(201).json("New post created");
  },
);

module.exports = postsRouter;
