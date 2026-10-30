const subredditsRouter = require("express").Router();
const {
  SUBREDDIT_ORDER_BY_TYPES,
  SubredditModeratorRole,
  SubredditPermissions,
} = require("../enums/subreddit.enum");
const {
  Subreddit,
  UserSubreddits,
  SubredditModerators,
} = require("../models/index");

const { sequelize } = require("../utils/db");
const {
  validate,
  requireAuth,
  requireSubredditPermission,
} = require("../utils/middleware/middleware");
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
    if (e.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json("User is already a member of this subreddit");
    }
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
        order: [["member_count", order || "DESC"]],
        group: ["subreddit.id"],
      });

      return res.send(result);
    }

    const subreddits = await sequelize
      .query(
        `
    SELECT subreddits.*
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
      let subredditAlreadyExists = false;

      await sequelize.transaction(async (t) => {
        const existingSubreddit = await Subreddit.findOne({
          where: { name: communityName },
        });
        if (existingSubreddit) {
          subredditAlreadyExists = true;
          return;
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

      if (subredditAlreadyExists) {
        return res
          .status(409)
          .json("A subreddit with this name already exists.");
      }

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

subredditsRouter.get("/leaderboards/top-subreddits", async (req, res) => {
  const [subredditLeaderboardSubreddits] = await sequelize.query(`
  WITH latest AS (
    SELECT id, date
    FROM subreddit_leaderboards
    ORDER BY date DESC
    LIMIT 1
  ),
  previous AS (
    SELECT id, date
    FROM subreddit_leaderboards
    WHERE date < (SELECT date FROM latest)
    ORDER BY date DESC
    LIMIT 1
  )
  SELECT
    current_entry.subreddit_id AS "id",
    current_entry.subreddit_leaderboard_id AS "subredditLeaderboardId",
    current_entry.rank AS "rank",
    current_entry.created_at AS "createdAt",
    current_entry.updated_at AS "updatedAt",
    s.name AS "name",
    s.icon_url AS "iconUrl",
    previous_entry.rank AS "previousRank",
    previous.date AS "previousLeaderboardDate",
    previous_entry.rank - current_entry.rank AS "rankChange"
  FROM latest
  JOIN subreddit_leaderboard_subreddits AS current_entry
    ON current_entry.subreddit_leaderboard_id = latest.id
  JOIN subreddits AS s
    ON s.id = current_entry.subreddit_id
  LEFT JOIN previous
    ON TRUE
  LEFT JOIN subreddit_leaderboard_subreddits AS previous_entry
    ON previous_entry.subreddit_leaderboard_id = previous.id
    AND previous_entry.subreddit_id = current_entry.subreddit_id
  ORDER BY current_entry.rank ASC;
`);

  return res.send(subredditLeaderboardSubreddits);
});

module.exports = subredditsRouter;
