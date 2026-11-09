import { Router, type Request } from "express";
import { AppError } from "../errors";
import { User, Subreddit, Post, UserNotifications } from "../models/index";
import { validate, requireAuth } from "../utils/middleware/middleware";
import {
  updateLoggedInUserSchema,
  type UpdateLoggedInUserBody,
} from "../validators/loggedInUser.validator";

const loggedInUserRouter = Router();

loggedInUserRouter.get("/", requireAuth, async (request, response) => {
  const user = await User.findOne({
    where: { username: request.user!.username },
    include: [
      {
        model: Subreddit,
        attributes: ["name", "id", "iconUrl"],
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
        model: Subreddit,
        as: "subredditsModerated",
        attributes: ["name"],
        through: { attributes: ["role"] },
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
    ratedPosts: user.ratedPosts!.map((post) => ({
      id: post.id,
      rating: post.UserRatedPosts.rating,
    })),
    avatarImageUrl: user.avatarImageUrl,
    profilePageBackgroundImageUrl: user.profilePageBackgroundImageUrl,
    notifications: user.notifications,
    moderatedSubreddits: (user.subredditsModerated ?? []).map((subreddit) => ({
      name: subreddit.name,
      role: subreddit.subredditModerators.role,
    })),
  });
});

loggedInUserRouter.patch(
  "/",
  validate(updateLoggedInUserSchema),
  requireAuth,
  async (
    request: Request<Record<string, string>, unknown, UpdateLoggedInUserBody>,
    response,
  ) => {
    const { introduction, userAvatarImageUrl, profilePageBackgroundImageUrl } =
      request.body;
    const userId = request.user!.id;

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

export = loggedInUserRouter;
