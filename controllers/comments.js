const commentRouter = require("express").Router();
const { Comment, User } = require("../models/index");
const { validate, requireAuth } = require("../utils/middleware");
const { postNewPostCommentSchema } = require("../validators/comment.validator");

commentRouter.post(
  "/",
  requireAuth,
  validate(postNewPostCommentSchema),
  async (req, res) => {
    if (!req?.user?.id) {
      return res
        .status(401)
        .json({ error: "Authentication token expired or invalid." });
    }

    const { text, directReplyToPost, subredditId, userId, commentId, postId } =
      req.body;

    if (
      !(text && typeof directReplyToPost === "boolean" && subredditId && postId)
    ) {
      return res.status(400).json("Please include required information");
    }
    await Comment.create({
      text,
      directReplyToPost,
      commentId,
      subredditId,
      userId: req.user.id,
      postId,
    }).catch((e) => {
      return res
        .status(500)
        .json("something went wrong while creating new comment");
    });

    return res.json("comment created");
  },
);

commentRouter.get("/moreComments/:id", async (req, res) => {
  const id = req.params.id;
  const comments = await Comment.findAll({
    where: { commentId: id },
    include: [{ model: User, attributes: ["username"], required: true }],
  });
  return res.json(comments);
});

module.exports = commentRouter;
