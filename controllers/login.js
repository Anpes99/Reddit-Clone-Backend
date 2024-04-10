const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const loginRouter = require("express").Router();
const { User, Subreddit, Post } = require("../models/index");

loginRouter.post("/", async (request, response) => {
  const { body } = request;
  try {
    const user = await User.findOne({
      where: { username: body.username },
      include: [
        {
          model: Subreddit,
          attributes: ["name", "id"],
          required: false,
        },
        {
          model: Post,
          as: "ratedPosts",
          attributes: ["id"],
          through: {
            attributes: ["rating"],
          },
          required: false,
        },
      ],
    });

    const passwordCorrect =
      user === null
        ? false
        : await bcrypt.compare(body.password, user.passwordHash);

    if (!(user && passwordCorrect)) {
      return response.status(401).json({
        error: "invalid username or password",
      });
    }
    const userForToken = {
      username: user.username,
      id: user.id,
    };

    const token = jwt.sign(userForToken, process.env.SECRET, {
      expiresIn: 60 * 60 * 24,
    });
    console.log(user.ratedPosts);
    response.status(200).send({
      token,
      username: user.username,
      id: user.id,
      subreddits: user.subreddits,
      ratedPosts: user.ratedPosts.map((post) => ({
        id: post.id,
        rating: post.UserRatedPosts.rating,
      })),
    });
  } catch (error) {
    console.log("error2:", error);
    response.status(401).json(error);
  }
});

module.exports = loginRouter;
