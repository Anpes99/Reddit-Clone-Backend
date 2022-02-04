const commentRouter = require("express").Router();
const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("../models/index");

commentRouter.post("/", async (req, res) => {
  const { text, directReplyToPost, subredditId, userId, commentId, postId } =
    req.body;
  console.log(typeof directReplyToPost);
  if (
    !(
      text &&
      typeof directReplyToPost === "boolean" &&
      subredditId &&
      userId &&
      postId
    )
  ) {
    return res.status(400).json("Please include required information");
  }
  let newComment = await Comment.create({
    text,
    directReplyToPost,
    commentId,
    subredditId,
    userId,
    postId,
  }).catch((e) => {
    return res
      .status(500)
      .json("something went wrong while creating new comment");
  });

  return res.json("comment created");
});

commentRouter.post("/:id/like", async (req, res) => {
  const comment = await Comment.findByPk(req.params.id);
  const result = await comment.increment("upVotes", { by: 1 }).catch((e) => {
    return res.status(500).json("something went wrong when updating upVotes");
  });

  return res.json("like saved");
});

module.exports = commentRouter;
