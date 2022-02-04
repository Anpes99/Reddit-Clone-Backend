const postsRouter = require("express").Router();
const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("../models/index");

postsRouter.get("/", async (req, res) => {
  const order = req.query.order;
  const sortBy = req.query.sortBy;
  const offset = req.query.offset || null;
  const limit = req.query.limit || 10;
  const totalCount = await Post.count({});

  const options = {
    order: [["createdAt", "DESC"]],
    offset,
    limit,
    include: [
      { model: User, attributes: ["username"] },
      { model: Subreddit, attributes: ["name"] },
    ],
  };

  if (order && sortBy) options.order = [[sortBy, order]];

  const posts = await Post.findAll(options);
  return res.send({ posts, totalCount });
});

//include:
// options.include.push({ model:Comment, include:{model:Comment}})

postsRouter.get("/:id", async (req, res) => {
  const a = { model: Comment, include: {} };
  a.include = { model: Comment, include: {} };
  a.include.include = { model: Comment, include: {} };
  a.include.include.include = { model: Comment, include: {} };
  a.include.include.include.include = { model: Comment, include: {} };
  a.include.include.include.include.include = { model: Comment };
  const includedCommentsTree = a;
  console.log("@@@@@@@@@@@@@@@@@@options: ii ", includedCommentsTree);

  const order = req.query.order;
  const sortBy = req.query.sortBy;

  const options = {
    include: {
      model: Comment,
      where: { directReplyToPost: true },
      include: includedCommentsTree,
      required: false,
    },
    order: [[Comment, sortBy || "upVotes", order || "DESC"]],
  };
  console.log("@@@@", order, sortBy);
  //if (order && sortBy) options.order = [];

  console.log("@@@@@@@@@@@@@@@@@@options:  ", options.include);

  // options.include.include =
  const post = await Post.findByPk(req.params.id, options).catch((e) =>
    console.log("error@@@@@@@@@@@", e)
  );
  return res.send(post);
});

postsRouter.post("/", async (req, res) => {
  console.log(req.user);
  const { title, text, subredditId } = req.body;

  if (!title || !text || !subredditId) {
    return res
      .status(400)
      .json("missing information. Please include all required information.");
  }
  if (req.user.id) {
    const post = await Post.create({
      title: title,
      text: text,
      userId: req.user.id,
      subredditId: subredditId,
    }).catch((e) => {
      console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ error:  ", e);
      return res.status(400).json("error when creating new post:");
    });

    return res.status(201).json("New post created");
  } else {
    return res.status(401).send("you have to be logged in to create new posts");
  }
});
/*
postsRouter.delete("/", async (req, res) => {
  res.json(done);
});*/
module.exports = postsRouter;
