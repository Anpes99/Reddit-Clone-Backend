const loggedInUserRouter = require("express").Router();
const { AppError } = require("../errors");
const { User, Subreddit, Post, UserNotifications } = require("../models/index");
const { validate, requireAuth } = require("../utils/middleware/middleware");
const {
  updateLoggedInUserSchema,
} = require("../validators/loggedInUser.validator");

loggedInUserRouter.get("/", requireAuth, async (request, response) => {
  const user = await User.findOne({
    where: { username: request.user.username },
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
      {
        model: UserNotifications,
        attributes: ["id", "title", "message", "type"],
        where: { delivered_at: null },
        as: "notifications",
        required: false,
        limit: 5,
        order: [["createdAt", "asc"]],
      },
    ],
  });

  if (!user) {
    throw new AppError({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "user not found",
      details: {},
    });
  }

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
    notifications: user.notifications,
  });
});

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
      throw new AppError({
        status: 404,
        code: "USER_NOT_FOUND",
        message: "user not found",
        details: {},
      });
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
