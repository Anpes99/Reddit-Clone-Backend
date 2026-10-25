const loggedInUserRouter = require("express").Router();
const { User, Subreddit, Post } = require("../models/index");
const { validate, requireAuth } = require("../utils/middleware/middleware");
const {
  getLoggedInUserSchema,
  updateLoggedInUserSchema,
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
        avatarImageUrl: user.avatarImageUrl,
        profilePageBackgroundImageUrl: user.profilePageBackgroundImageUrl,
      });
    } catch (error) {
      response.status(401).json(error);
    }
  },
);

loggedInUserRouter.patch(
  "/",
  validate(updateLoggedInUserSchema),
  requireAuth,
  async (request, response) => {
    const { introduction, userAvatarImageUrl, profilePageBackgroundImageUrl } =
      request.body;
    const userId = request.user.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return response.status(404).json({ error: "user not found" });
    }

    await user.update({
      introduction,
      avatarImageUrl: userAvatarImageUrl,
      profilePageBackgroundImageUrl,
    });

    response.status(200).json("user succesfully updated");
  },
);

module.exports = loggedInUserRouter;
