import { Router, type Request } from "express";
import type { FindOptions, InferAttributes } from "sequelize";
import { POST_MODERATION_STATUS } from "../constants/post.constant";
import { AppError } from "../errors";
import { User, Comment, Post, Subreddit } from "../models/index";
import { moderationQueue } from "../queues/moderation.queue";
import { sequelize } from "../utils/db";
import { generateEmbedding } from "../utils/embeddings";
import { validate, requireAuth } from "../utils/middleware/middleware";
import { createPostRequestLimiter } from "../utils/middleware/requestRateLimiters";
import {
  getPostSchema,
  postNewPostSchema,
  updatePostSchema,
  type GetPostQuery,
  type PostNewPostBody,
  type UpdatePostBody,
} from "../validators/post.validator";

const postsRouter = Router();

postsRouter.get(
  "/:id",
  validate(getPostSchema, "query"),
  async (req: Request<{ id: string }, unknown, unknown, GetPostQuery>, res) => {
    const order = req.query.order;
    const sortBy = req.query.sortBy;

    const options: FindOptions<InferAttributes<Post>> = {
      where: { id: req.params.id, safe: true },
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

    const post = await Post.findOne(options);
    if (!post) {
      throw new AppError({
        status: 404,
        code: "POST_NOT_FOUND",
        message: "post not found",
        details: {},
      });
    }
    return res.send({ post });
  },
);

postsRouter.post(
  "/",
  requireAuth,
  createPostRequestLimiter,
  validate(postNewPostSchema),
  async (
    req: Request<Record<string, string>, unknown, PostNewPostBody>,
    res,
  ) => {
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

    const newPost = await Post.create({
      title: title,
      text: text,
      imageUrl,
      userId: req.user!.id,
      subredditId: subreddit.id,
      embedding,
      safe: imageUrl ? null : true,
      moderationStatus: imageUrl
        ? POST_MODERATION_STATUS.PENDING
        : POST_MODERATION_STATUS.COMPLETED,
    });

    if (imageUrl) {
      await moderationQueue.add("moderate-image", {
        postId: newPost.id,
        imageUrl,
      });
    }

    return res.status(201).json("New post created");
  },
);

postsRouter.patch(
  "/:id",
  requireAuth,
  validate(updatePostSchema),
  async (req: Request<{ id: string }, unknown, UpdatePostBody>, res) => {
    const { text } = req.body;

    const post = await Post.findByPk(req.params.id);
    if (!post) {
      throw new AppError({
        status: 404,
        code: "POST_NOT_FOUND",
        message: "post not found",
        details: {},
      });
    }

    if (post.userId !== req.user!.id) {
      throw new AppError({
        status: 403,
        code: "FORBIDDEN",
        message: "forbidden",
        details: {},
      });
    }

    const embedding = await generateEmbedding(
      `${post.title}\n\n${text}`,
      "document",
    );

    await post.update({ text, embedding });

    return res.json({
      post: { id: post.id, title: post.title, text: post.text },
    });
  },
);

export = postsRouter;
