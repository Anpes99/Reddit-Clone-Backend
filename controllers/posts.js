const postsRouter = require("express").Router();
const { User, Comment, Post, Subreddit } = require("../models/index");
const { sequelize } = require("../utils/db");
const { generateEmbedding } = require("../utils/embeddings");
const { validate, requireAuth } = require("../utils/middleware/middleware");
const {
  getPostSchema,
  postNewPostSchema,
} = require("../validators/post.validator");

// postsRouter.get("/", async (req, res) => {
//   const order = req.query.order;
//   const sortBy = req.query.sortBy;
//   const offset = req.query.offset || null;
//   const limit = req.query.limit || 10;
//   const subredditName = req.query.subredditName;
//   let subredditId;
//   if (subredditName) {
//     const subreddit = await Subreddit.findOne({
//       where: { name: subredditName },
//     });
//     subredditId = subreddit.id;
//   }

//   const totalCount = await Post.count({});

//   const options = {
//     order: [["createdAt", "DESC"]],
//     offset,
//     limit,
//     include: [
//       { model: User, attributes: ["username"] },
//       { model: Subreddit, attributes: ["name"] },
//     ],
//   };

//   if (subredditId) options.where = { subredditId: subredditId };

//   if (order && sortBy) options.order = [[sortBy, order]];

//   const posts = await Post.findAll(options);
//   return res.send({ posts, totalCount });
// });

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

  const post = await Post.findByPk(req.params.id, options).catch((e) =>
    console.log(e),
  );

  return res.send({ post });
});

postsRouter.post(
  "/",
  requireAuth,
  validate(postNewPostSchema),
  async (req, res) => {
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

    const textForEmbedding = `${title}\n\n${text}`;

    const embedding = await generateEmbedding(textForEmbedding, "document");

    if (req.user.id) {
      await Post.create({
        title: title,
        text: text,
        imageUrl,
        userId: req.user.id,
        subredditId: subreddit.id,
        embedding,
      }).catch((e) => {
        console.log(e);
        return res.status(400).json("error when creating new post:");
      });

      return res.status(201).json("New post created");
    } else {
      return res
        .status(401)
        .send("you have to be logged in to create new posts");
    }
  },
);

module.exports = postsRouter;
