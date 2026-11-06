import bcrypt from "bcrypt";
import { Router, type Request } from "express";
import { QueryTypes, type FindOptions, type InferAttributes } from "sequelize";
import {
  User,
  Post,
  Subreddit,
  Comment,
  UserSubreddits,
  PasswordResetToken,
} from "../models/index";
import { validate } from "../utils/middleware/middleware";
import {
  postNewUserSchema,
  getUserPostsAndCommentsFeedSchema,
  forgottenPasswordSchema,
  resetPasswordSchema,
  type ForgottenPasswordBody,
  type GetUserPostsAndCommentsFeedQuery,
  type PostNewUserBody,
  type ResetPasswordBody,
} from "../validators/user.validator";
import {
  USER_PAGE_CONTENT_TYPES,
  USER_PAGE_CONTENT_SORT_BY_TYPES,
} from "../constants/user.constant";
import { SORT_ORDER } from "../constants/sort-order.constant";
import { sequelize } from "../utils/db";
import {
  getUserPageOverviewPageFeedQuery,
  type OverviewFeedRow,
} from "../queries/user/getUserPageOverviewPageFeedQuery";
import {
  signUpLimiter,
  signUpPerDayLimiter,
} from "../utils/middleware/requestRateLimiters";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  hashPasswordResetToken,
} from "../utils/email";
import { AppError } from "../errors";

// totalcount is bigint, which pg returns as a string
type ContributionsCountRow = { totalcount: string };

const usersRouter = Router();

usersRouter.post(
  "/",
  signUpLimiter,
  signUpPerDayLimiter,
  validate(postNewUserSchema),
  async (
    request: Request<Record<string, string>, unknown, PostNewUserBody>,
    response,
  ) => {
    const { body } = request;

    const userFound = await User.findOne({
      where: { username: body.username },
    });
    if (userFound) {
      throw new AppError({
        status: 400,
        code: "USERNAME_ALREADY_TAKEN",
        message: "username already taken",
        details: {},
      });
    }

    const userWithEmailFound = await User.findOne({
      where: { email: body.email },
    });
    if (userWithEmailFound) {
      throw new AppError({
        status: 400,
        code: "USER_WITH_EMAIL_ALREADY_EXISTS",
        message: "user with that email already exists",
        details: {},
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    const newUser = await User.create({
      username: body.username,
      email: body.email,
      passwordHash,
      avatarImageUrl: `https://api.dicebear.com/10.x/voxel-art/svg?scale=1.25&seed=${encodeURIComponent(body.username)}`,
    });

    await sendVerificationEmail({
      email: body.email,
      userId: newUser.id,
    });
    response.status(200).json("new user created");
  },
);

usersRouter.get("/:username", async (request, response) => {
  const username = request.params.username;

  const user = await User.findOne({ where: { username } });
  if (!user) {
    throw new AppError({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "user not found",
      details: {},
    });
  }

  const subredditsJoinedCount = await UserSubreddits.count({
    where: { userId: user.id },
  });

  const contributionsCount = await sequelize.query<ContributionsCountRow>(
    `
          SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = :userId and safe = true) +
          (SELECT COUNT(*) FROM comments WHERE user_id = :userId)
          AS totalCount;
                  
          `,
    {
      replacements: { userId: user.id },
      type: QueryTypes.SELECT,
    },
  );

  await response.status(200).json({
    username: user.username,
    introduction: user.introduction,
    avatarImageUrl: user.avatarImageUrl,
    profilePageBackgroundImageUrl: user.profilePageBackgroundImageUrl,
    createdAt: user.createdAt,
    subredditsJoinedCount,
    contributionsCount: contributionsCount[0].totalcount,
    karma: user.karma,
  });
});

usersRouter.get(
  "/:username/feed",
  validate(getUserPostsAndCommentsFeedSchema, "query"),
  async (request: Request<{ username: string }>, response) => {
    const { username } = request.params;

    const { offset, contentType, sortByType, getTotalCount } =
      request.query as unknown as GetUserPostsAndCommentsFeedQuery;

    const user = await User.findOne({
      where: { username },
    });
    if (!user) {
      throw new AppError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "user not found",
        details: {},
      });
    }
    if (contentType === USER_PAGE_CONTENT_TYPES.POSTS) {
      const options: FindOptions<InferAttributes<Post>> = {
        where: { userId: user.id, safe: true },
        order:
          sortByType === USER_PAGE_CONTENT_SORT_BY_TYPES.TOP
            ? [
                [sequelize.literal('"up_votes"-"down_votes"'), "desc"],
                ["createdAt", "DESC"],
              ]
            : [["createdAt", SORT_ORDER.DESC]],
        offset,
        limit: 10,
        include: [
          {
            model: User,
            attributes: ["username"],
            where: { username },
            required: true,
          },
          {
            model: Subreddit,
            as: "subreddit",
            attributes: ["name", "iconUrl"],
          },
        ],
      };
      const posts = await Post.findAll(options);

      const totalCount = getTotalCount
        ? await Post.count({ where: options.where })
        : undefined;

      return response.send({
        feedItems: posts.map((post) => ({ data: post, type: "post" })),
        type: "post",
        totalCount,
      });
    }

    if (contentType === USER_PAGE_CONTENT_TYPES.COMMENTS) {
      const comments = await Comment.findAll({
        where: { userId: user.id },
        order:
          sortByType === USER_PAGE_CONTENT_SORT_BY_TYPES.TOP
            ? [
                [
                  sequelize.literal('comment."up_votes"-comment."down_votes"'),
                  "DESC",
                ],
                ["createdAt", "DESC"],
              ]
            : [["createdAt", SORT_ORDER.DESC]],
        offset,
        limit: 10,
        include: [
          {
            model: User,
            attributes: ["username"],
            required: true,
          },
          {
            model: Post,
            attributes: ["id", "title"],
            required: true,
            include: [
              {
                model: Subreddit,
                as: "subreddit",
                attributes: ["name", "iconUrl"],
              },
            ],
          },
          {
            model: Comment,
            attributes: ["id"],
            required: false,
            as: "parentComment",
            include: [
              {
                model: User,
                required: false,
                attributes: ["username"],
              },
            ],
          },
        ],
      });
      const totalCount = getTotalCount
        ? await Comment.count({ where: { userId: user.id } })
        : undefined;

      return response.send({
        feedItems: comments.map((comment) => {
          return {
            data: {
              ...comment.get({ plain: true }),
              subreddit: comment.post!.subreddit,
              post: comment.post,
            },
            type: "comment",
          };
        }),
        totalCount,
      });
    }

    if (contentType === USER_PAGE_CONTENT_TYPES.OVERVIEW) {
      const result = await sequelize.query<OverviewFeedRow>(
        getUserPageOverviewPageFeedQuery,
        {
          replacements: { userId: user.id, offset },
          type: QueryTypes.SELECT,
        },
      );

      const totalCount = getTotalCount
        ? await sequelize.query<ContributionsCountRow>(
            `
          SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = :userId and safe = true) +
          (SELECT COUNT(*) FROM comments WHERE user_id = :userId)
          AS totalCount;
                  
          `,
            {
              replacements: { userId: user.id },
              type: QueryTypes.SELECT,
            },
          )
        : undefined;

      return response.send({
        feedItems: result.map((item) => ({
          data: {
            ...item.data,
            subreddit: item.subreddit,
            user: item.user,
            post: item.post,
          },
          type: item.type,
        })),
        totalCount: totalCount?.[0]?.totalcount
          ? Number(totalCount[0].totalcount)
          : undefined,
      });
    }

    return response.json();
  },
);

usersRouter.post(
  "/forgotten-password",
  validate(forgottenPasswordSchema),
  async (
    request: Request<Record<string, string>, unknown, ForgottenPasswordBody>,
    response,
  ) => {
    const email = request.body.email;

    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "user not found",
        details: {},
      });
    }

    await sendPasswordResetEmail({ email: user.email, userId: user.id });

    await response.status(200).json({
      message: "forgotten password email sent",
    });
  },
);

usersRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (
    request: Request<Record<string, string>, unknown, ResetPasswordBody>,
    response,
  ) => {
    const { password, passwordResetToken } = request.body;

    const hashedPasswordResetToken = hashPasswordResetToken(passwordResetToken);
    const dbPasswordResetToken = await PasswordResetToken.findOne({
      where: { tokenHash: hashedPasswordResetToken },
    });

    if (!dbPasswordResetToken) {
      throw new AppError({
        status: 400,
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "Invalid or expired token",
        details: {},
      });
    }
    if (dbPasswordResetToken.expiresAt <= new Date()) {
      await dbPasswordResetToken.destroy();
      throw new AppError({
        status: 410,
        code: "EXPIRED_TOKEN",
        message: "expired token",
        details: {},
      });
    }

    const user = await User.findOne({
      where: { id: dbPasswordResetToken.userId },
    });
    if (!user) {
      throw new AppError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "user not found",
        details: {},
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await user.update({ passwordHash });
    await dbPasswordResetToken.destroy();
    await response.status(200).json({
      message: "user password changed",
    });
  },
);

export = usersRouter;
