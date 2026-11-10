import { Router, type Request } from "express";
import { hasSubredditPermission } from "../config/subreddit-moderator-permissions";
import { DELETED_COMMENT_TEXT } from "../constants/comment.constant";
import { SUBREDDIT_PERMISSIONS } from "../constants/subreddit.constant";
import { AppError } from "../errors";
import { Comment, Post, SubredditModerators, User } from "../models/index";
import { validate, requireAuth } from "../utils/middleware/middleware";
import { createCommentRequestLimiter } from "../utils/middleware/requestRateLimiters";
import {
  postNewPostCommentSchema,
  updateCommentSchema,
  type PostNewPostCommentBody,
  type UpdateCommentBody,
} from "../validators/comment.validator";

const commentRouter = Router();

commentRouter.post(
  "/",
  requireAuth,
  createCommentRequestLimiter,
  validate(postNewPostCommentSchema),
  async (
    req: Request<Record<string, string>, unknown, PostNewPostCommentBody>,
    res,
  ) => {
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
      userId: req.user!.id,
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

commentRouter.patch(
  "/:id",
  requireAuth,
  validate(updateCommentSchema),
  async (req: Request<{ id: string }, unknown, UpdateCommentBody>, res) => {
    const { text } = req.body;

    const comment = await Comment.findByPk(req.params.id);
    if (!comment) {
      throw new AppError({
        status: 404,
        code: "COMMENT_NOT_FOUND",
        message: "comment not found",
        details: {},
      });
    }

    if (comment.userId !== req.user!.id) {
      throw new AppError({
        status: 403,
        code: "FORBIDDEN",
        message: "forbidden",
        details: {},
      });
    }

    if (comment.isDeleted) {
      throw new AppError({
        status: 409,
        code: "COMMENT_DELETED",
        message: "deleted comments can't be edited",
        details: {},
      });
    }

    await comment.update({ text });

    return res.json({ comment: { id: comment.id, text: comment.text } });
  },
);

commentRouter.delete(
  "/:id",
  requireAuth,
  async (req: Request<{ id: string }>, res) => {
    const userId = req.user!.id;

    const comment = await Comment.findByPk(req.params.id, {
      include: [{ model: Post, attributes: ["subredditId"] }],
    });
    if (!comment) {
      throw new AppError({
        status: 404,
        code: "COMMENT_NOT_FOUND",
        message: "comment not found",
        details: {},
      });
    }

    if (comment.userId !== userId) {
      const moderator = await SubredditModerators.findOne({
        where: { subredditId: comment.post!.subredditId, userId },
        attributes: ["role"],
      });

      if (
        !moderator ||
        !hasSubredditPermission(
          moderator.role,
          SUBREDDIT_PERMISSIONS.POSTS_MANAGE,
        )
      ) {
        throw new AppError({
          status: 403,
          code: "FORBIDDEN",
          message: "forbidden",
          details: {},
        });
      }
    }

    await comment.update({ isDeleted: true, text: DELETED_COMMENT_TEXT });

    return res.status(204).end();
  },
);

export = commentRouter;
