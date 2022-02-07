const subredditsRouter = require("express").Router();
const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("../models/index");

subredditsRouter.post("/:subredditId/user", async (req, res) => {
  try {
    console.log(
      req.user.id,
      req.params.subredditId,
      typeof req.user.id,
      typeof req.params.subredditId
    );
    const result = await UserSubreddits.create({
      userId: req.user.id,
      subredditId: req.params.subredditId,
    });
    console.log(result);
    return res.json("User successfully joined subreddit");
  } catch (e) {
    console.log(e);
    return res
      .status(500)
      .json("Something went wrong while saving saving subreddit member");
  }
});
subredditsRouter.delete("/:subredditId/user", async (req, res) => {
  console.log(req.user);
  try {
    console.log(
      req.user.id,
      req.params.subredditId,
      typeof req.user.id,
      typeof req.params.subredditId
    );

    const r = await UserSubreddits.destroy({
      where: {
        userId: req.user.id,
        subredditId: Number(req.params.subredditId),
      },
    });
    console.log(r, "resuöt");
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
  const options = {};
  if (name) options.where = { name };
  const subreddit = await Subreddit.findAll(options);
  return res.send(subreddit);
});

module.exports = subredditsRouter;
