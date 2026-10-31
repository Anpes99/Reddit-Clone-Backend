const postsRouter = require("express").Router();
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
  try {
    const post = await Post.findByPk(req.params.id, options);
    if (!post) {
      return res.status(404).json("post not found");
    }
    return res.send({ post });
  } catch (e) {
    console.error(e);
    return res
      .status(500)
      .json("Something went wrong when trying to find post");
  }
});

postsRouter.post(
  "/",
  createPostRequestLimiter,
  requireAuth,
  validate(postNewPostSchema),
  async (req, res) => {
    const { title, text, subredditName, imageUrl } = req.body;

    const subreddit = await Subreddit.findOne({
      where: { name: subredditName },
    });

    if (!subreddit) {
      return res.status(404).json("subreddit not found");
    }

    if (!title || !text) {
      return res
        .status(400)
        .json("missing information. Please include all required information.");
    }

    const textForEmbedding = `${title}\n\n${text}`;

    const embedding = await generateEmbedding(textForEmbedding, "document");

    try {
      await Post.create({
        title: title,
        text: text,
        imageUrl,
        userId: req.user.id,
        subredditId: subreddit.id,
        embedding,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json("error when creating new post");
    }

    return res.status(201).json("New post created");
  },
);

module.exports = postsRouter;
