import { Router, type Request } from "express";
import {
  SUBREDDIT_ORDER_BY_TYPES,
  SUBREDDIT_MODERATOR_ROLE,
  SUBREDDIT_PERMISSIONS,
} from "../constants/subreddit.constant";
import { USER_NOTIFICATION_TYPES } from "../constants/user.constant";
import { AppError } from "../errors";
import logger from "../utils/logger";
import {
  Subreddit,
  User,
  UserSubreddits,
  SubredditModerators,
  UserNotifications,
} from "../models/index";

import { QueryTypes } from "sequelize";
import { sequelize } from "../utils/db";
import {
  validate,
  requireAuth,
  requireSubredditPermission,
} from "../utils/middleware/middleware";
import {
  getSubredditsSchema,
  getSubredditSchema,
  postNewSubredditSchema,
  updateSubredditSchema,
  type GetSubredditsQuery,
  type PostNewSubredditBody,
  type UpdateSubredditBody,
} from "../validators/subreddit.validator";
import {
  getTopSubredditsLeaderboardQuery,
  type TopSubredditsLeaderboardRow,
} from "../queries/subreddit/getTopSubredditsLeaderboardQuery";

const subredditsRouter = Router();

subredditsRouter.post(
  "/:subredditId/user",
  requireAuth,
  async (req, res, next) => {
    try {
      await UserSubreddits.create({
        userId: req.user!.id,
        subredditId: Number(req.params.subredditId),
      });
      return res.json("User successfully joined subreddit");
    } catch (e) {
      if ((e as Error).name === "SequelizeUniqueConstraintError") {
        return next(
          new AppError({
            status: 409,
            code: "USER_ALREADY_SUBREDDIT_MEMBER",
            message: "User is already a member of this subreddit",
            details: {},
          }),
        );
      }
      next(e);
    }
  },
);
subredditsRouter.delete("/:subredditId/user", requireAuth, async (req, res) => {
  await UserSubreddits.destroy({
    where: {
      userId: req.user!.id,
      subredditId: Number(req.params.subredditId),
    },
  });

  return res.status(204).json("User successfully removed from subreddit");
});

subredditsRouter.get(
  "/",
  validate(getSubredditsSchema, "query"),
  async (
    req: Request<Record<string, string>, unknown, unknown, GetSubredditsQuery>,
    res,
  ) => {
    const { limit, sortBy, order } = req.query;

    if (sortBy === SUBREDDIT_ORDER_BY_TYPES.MEMBER_COUNT) {
      const result = await Subreddit.findAll({
        limit: limit || 10,
        order: [["member_count", order || "DESC"]],
        group: ["subreddit.id"],
      });

      return res.send(result);
    }

    const subreddits = await sequelize.query(
      `
    SELECT subreddits.*
    FROM subreddits
    GROUP BY subreddits.id;
  `,
    );

    return res.send(subreddits[0]);
  },
);

subredditsRouter.get(
  "/:name",
  validate(getSubredditSchema, "params"),
  async (req, res) => {
    const name = req.params.name;
    const result = await Subreddit.findOne({
      where: { name },
      include: [
        {
          model: User,
          as: "moderators",
          attributes: ["username", "avatarImageUrl"],
          through: { attributes: ["role"] },
          required: false,
        },
      ],
    });
    if (!result) {
      throw new AppError({
        status: 404,
        code: "SUBREDDIT_NOT_FOUND",
        message: "Subreddit not found",
        details: {},
      });
    }
    const userSubredditModerator = req.user
      ? await SubredditModerators.findOne({
          where: { userId: req.user.id, subredditId: result.dataValues.id },
        })
      : undefined;

    const subredditData: Record<string, unknown> = { ...result.dataValues };
    delete subredditData.moderators;
    const roleOrder: string[] = Object.values(SUBREDDIT_MODERATOR_ROLE);

    const subreddit = {
      ...subredditData,
      currentUserRole: userSubredditModerator?.dataValues?.role || "",
      moderators: (result.moderators ?? [])
        .map((moderator) => ({
          username: moderator.username,
          avatarImageUrl: moderator.avatarImageUrl,
          role: moderator.subredditModerators.role,
        }))
        .sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)),
    };

    return res.send({ ...subreddit });
  },
);

subredditsRouter.post(
  "/",
  requireAuth,
  validate(postNewSubredditSchema),
  async (
    req: Request<Record<string, string>, unknown, PostNewSubredditBody>,
    res,
  ) => {
    const { communityName, description, subredditIconUrl } = req.body;
    const userId = req.user!.id;

    const existingSubreddit = await Subreddit.findOne({
      where: { name: communityName },
    });

    if (existingSubreddit) {
      throw new AppError({
        status: 409,
        code: "SUBREDDIT_ALREADY_EXISTS",
        message: "A subreddit with this name already exists.",
        details: {},
      });
    }

    await sequelize.transaction(async (t) => {
      const createdSubreddit = await Subreddit.create(
        {
          name: communityName,
          description,
          creatorId: userId,
          iconUrl: subredditIconUrl,
        },
        { transaction: t },
      );
      await SubredditModerators.create(
        {
          userId,
          subredditId: createdSubreddit.id,
          role: SUBREDDIT_MODERATOR_ROLE.OWNER,
        },
        { transaction: t },
      );
    });

    try {
      await UserNotifications.create({
        userId,
        type: USER_NOTIFICATION_TYPES.COMMUNITY_CREATED,
        title: "Community created successfully",
        message:
          "Your community is ready. You can now customize it, invite members, and start sharing posts.",
      });
    } catch (err) {
      logger.error({ err }, "Failed to create community_created notification");
    }

    return res.status(201).json("Successfully created new subreddit");
  },
);

subredditsRouter.patch(
  "/:subredditId/settings",
  requireAuth,
  requireSubredditPermission(SUBREDDIT_PERMISSIONS.SETTINGS_MANAGE),
  validate(updateSubredditSchema),
  async (
    req: Request<{ subredditId: string }, unknown, UpdateSubredditBody>,
    res,
  ) => {
    const { subredditIconUrl, description, subredditPageBackgroundImageUrl } =
      req.body;
    const subredditId = req.params.subredditId;

    const subredditToUpdate = await Subreddit.findByPk(subredditId);
    if (!subredditToUpdate) {
      throw new AppError({
        status: 404,
        code: "SUBREDDIT_NOT_FOUND",
        message: "Subreddit not found",
        details: {},
      });
    }

    await subredditToUpdate.update({
      iconUrl: subredditIconUrl,
      description,
      subredditPageBackgroundImageUrl,
    });
    return res.json(subredditToUpdate);
  },
);

subredditsRouter.get("/leaderboards/top-subreddits", async (req, res) => {
  const subredditLeaderboardSubreddits =
    await sequelize.query<TopSubredditsLeaderboardRow>(
      getTopSubredditsLeaderboardQuery,
      { type: QueryTypes.SELECT },
    );

  return res.send(subredditLeaderboardSubreddits);
});

export = subredditsRouter;
