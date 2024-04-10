const subredditsRouter = require("express").Router();
const { SUBREDDIT_ORDER_BY_TYPES } = require("../constants/subreddits");
const { Subreddit, UserSubreddits } = require("../models/index");
const { sequelize } = require("../utils/db");

subredditsRouter.post("/:subredditId/user", async (req, res) => {
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
subredditsRouter.delete("/:subredditId/user", async (req, res) => {
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

subredditsRouter.get("/", async (req, res) => {
  const { name, limit, sortBy, order } = req.query;

  if (sortBy === SUBREDDIT_ORDER_BY_TYPES.MEMBER_COUNT) {
    const result = await Subreddit.findAll({
      limit: limit || 10,
      attributes: {
        include: [
          [
            sequelize.literal(
              `(SELECT COUNT(*) FROM "user_subreddits" WHERE "subreddit"."id" = "user_subreddits"."subreddit_id")`
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

  if (name) {
    const result = await Subreddit.findOne({
      where: { name },
    });
    const subreddit = result.dataValues;
    if (!subreddit) return [];
    const memberCount = await UserSubreddits.count({
      where: { subredditId: subreddit.id },
    });

    return res.send([{ ...subreddit, memberCount }]);
  }

  const subreddits = await sequelize
    .query(
      `
    SELECT subreddits.*, COUNT((select 1 from user_subreddits us where us.subreddit_id = subreddits.id)) AS memberCount
    FROM subreddits
    GROUP BY subreddits.id;
  `
    )
    .catch((e) => console.log(e));

  return res.send(subreddits[0]);
});

module.exports = subredditsRouter;
