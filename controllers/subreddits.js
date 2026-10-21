const subredditsRouter = require("express").Router();
const {
  SUBREDDIT_ORDER_BY_TYPES,
  SubredditModeratorRole,
  SubredditPermissions,
} = require("../enums/subreddit.enum");
const { Subreddit, UserSubreddits } = require("../models/index");
const SubredditModerators = require("../models/SubredditModerators");
const { sequelize } = require("../utils/db");
const {
  validate,
  requireAuth,
  requireSubredditPermission,
} = require("../utils/middleware");
const {
  getSubredditsSchema,
  getSubredditSchema,
  postNewSubredditSchema,
  updateSubredditSchema,
} = require("../validators/subreddit.validator");

subredditsRouter.post("/:subredditId/user", requireAuth, async (req, res) => {
  try {
    await UserSubreddits.create({
      userId: req.user.id,
      subredditId: req.params.subredditId,
    });
    return res.json("User successfully joined subreddit");
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json("Something went wrong while saving saving subreddit member");
  }
});
subredditsRouter.delete("/:subredditId/user", requireAuth, async (req, res) => {
  try {
    await UserSubreddits.destroy({
      where: {
        userId: req.user.id,
        subredditId: Number(req.params.subredditId),
      },
    });

    return res.status(204).json("User successfully removed from subreddit");
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json("Something went wrong while removing user from subreddit");
  }
});

subredditsRouter.get(
  "/",
  validate(getSubredditsSchema, "query"),
  async (req, res) => {
    const { limit, sortBy, order } = req.query;

    if (sortBy === SUBREDDIT_ORDER_BY_TYPES.MEMBER_COUNT) {
      const result = await Subreddit.findAll({
        limit: limit || 10,
        attributes: {
          include: [
            [
              sequelize.literal(
                `(SELECT COUNT(*) FROM "user_subreddits" WHERE "subreddit"."id" = "user_subreddits"."subreddit_id")`,
              ),
              "memberCount",
            ],
          ],
        },
        order: [[sequelize.literal('"memberCount"'), order || "DESC"]],
        group: ["subreddit.id"],
      });

      return res.send(result);
    }

    const subreddits = await sequelize
      .query(
        `
    SELECT subreddits.*, COUNT((select 1 from user_subreddits us where us.subreddit_id = subreddits.id)) AS memberCount
    FROM subreddits
    GROUP BY subreddits.id;
  `,
      )
      .catch((e) => console.log(e));

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
    });
    const userSubredditModerator = req.user
      ? await SubredditModerators.findOne({
          where: { userId: req.user.id, subredditId: result.dataValues.id },
        })
      : undefined;
    if (!result) {
      return res.status(404).json({
        error: "Subreddit not found",
      });
    }

    const subreddit = {
      ...result.dataValues,
      currentUserRole: userSubredditModerator?.dataValues?.role || "",
    };

    return res.send({ ...subreddit });
  },
);

subredditsRouter.post(
  "/",
  requireAuth,
  validate(postNewSubredditSchema),
  async (req, res) => {
    try {
      const { communityName, description, subredditIconUrl } = req.body;
      await sequelize.transaction(async (t) => {
        const subredditAlreadyExists = await Subreddit.findOne({
          where: { name: communityName },
        });
        if (subredditAlreadyExists) {
          return res
            .status(409)
            .json("A subreddit with this name already exists.");
        }
        const createdSubreddit = await Subreddit.create(
          {
            name: communityName,
            description,
            creatorId: req.user.id,
            iconUrl: subredditIconUrl,
          },
          { transaction: t },
        );
        await SubredditModerators.create(
          {
            userId: req.user.id,
            subredditId: createdSubreddit.id,
            role: SubredditModeratorRole.OWNER,
          },
          { transaction: t },
        );
      });

      return res.json("Successfully created new subreddit");
    } catch (e) {
      console.log(e);
      return res
        .status(500)
        .json("Something went wrong while creating new subreddit");
    }
  },
);

subredditsRouter.patch(
  "/:subredditId/settings",
  requireAuth,
  requireSubredditPermission(SubredditPermissions.SETTINGS_MANAGE),
  validate(updateSubredditSchema),
  async (req, res) => {
    try {
      const { subredditIconUrl, description, subredditPageBackgroundImageUrl } =
        req.body;
      const subredditId = req.params.subredditId;

      const subredditToUpdate = await Subreddit.findByPk(subredditId);

      await subredditToUpdate.update({
        iconUrl: subredditIconUrl,
        description,
        subredditPageBackgroundImageUrl,
      });
      return res.json(subredditToUpdate);
    } catch (e) {
      console.log(e);
      return res
        .status(500)
        .json("Something went wrong while creating new subreddit");
    }
  },
);

module.exports = subredditsRouter;
