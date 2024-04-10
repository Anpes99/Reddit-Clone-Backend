const subredditsRouter = require("express").Router();
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
  const name = req.query.name;

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
