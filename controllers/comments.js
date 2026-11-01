const commentRouter = require("express").Router();
const { AppError } = require("../errors");
const { Comment, User } = require("../models/index");
const { validate, requireAuth } = require("../utils/middleware/middleware");
const {
  createCommentRequestLimiter,
} = require("../utils/middleware/requestRateLimiters");
const { postNewPostCommentSchema } = require("../validators/comment.validator");

commentRouter.post(
  "/",
  requireAuth,
  createCommentRequestLimiter,
  validate(postNewPostCommentSchema),
  async (req, res) => {
    const { text, directReplyToPost, subredditId, commentId, postId } =
      req.body;

    if (!(
      text &&
      typeof directReplyToPost === "boolean" &&
      subredditId &&
      postId
    )) {
      throw new AppError({
        status: 400,
        code: "MISSING_INFORMATION",
        message: "Please include required information",
        details: {},
      });
    }

    if (commentId) {
      const parentComment = await Comment.findByPk(commentId);

      if (!parentComment) {
        throw new AppError({
          status: 404,
          code: "PARENT_COMMENT_NOT_FOUND",
          message: "Parent comment not found.",
          details: {},
        });
      }

      if (parentComment.postId !== postId) {
        throw new AppError({
          status: 400,
          code: "WRONG_COMMENT_POST",
          message: "Parent comment belongs to a different post.",
          details: {},
        });
      }
    }

    await Comment.create({
      text,
      directReplyToPost,
      commentId,
      subredditId,
      userId: req.user.id,
      postId,
    });

    return res.json("comment created");
  },
);

commentRouter.get("/moreComments/:id", async (req, res) => {
  const id = req.params.id;
  const comments = await Comment.findAll({
    where: { commentId: id },
    include: [
      {
        model: User,
        attributes: ["username", "avatarImageUrl"],
        required: true,
      },
    ],
  });
  return res.json(comments);
});

module.exports = commentRouter;
