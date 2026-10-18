const loggedInUserRouter = require("express").Router();
const { User, Subreddit, Post } = require("../models/index");
const { validate, requireAuth } = require("../utils/middleware");
const {
  getLoggedInUserSchema,
} = require("../validators/loggedInUser.validator");

loggedInUserRouter.get(
  "/",
  validate(getLoggedInUserSchema, "query"),
  requireAuth,
  async (request, response) => {
    const { query } = request;
    try {
      const user = await User.findOne({
        where: { username: query.username },
        include: [
          {
            model: Subreddit,
            attributes: ["name", "id"],
            as: "subreddits",
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

      response.status(200).send({
        username: user.username,
        id: user.id,
        subreddits: user.subreddits,
        ratedPosts: user.ratedPosts.map((post) => ({
          id: post.id,
          rating: post.UserRatedPosts.rating,
        })),
      });
    } catch (error) {
      response.status(401).json(error);
    }
  },
);
module.exports = loggedInUserRouter;
