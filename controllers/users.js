const bcrypt = require("bcrypt");
const usersRouter = require("express").Router();
const {
  User,
  Post,
  Subreddit,
  Comment,
  UserSubreddits,
} = require("../models/index");
const { validate } = require("../utils/middleware");
const {
  postNewUserSchema,
  getUserPostsAndCommentsFeedSchema,
} = require("../validators/user.validator");
const {
  USER_PAGE_CONTENT_TYPES,
  USER_PAGE_CONTENT_SORT_BY_TYPES,
} = require("../enums/user.enum");
const { SortOrder } = require("../enums/sort-order.enum");
const { sequelize } = require("../utils/db");
const { QueryTypes } = require("sequelize");
const {
  getUserPageOverviewPageFeedQuery,
} = require("../queries/user/getUserPageOverviewPageFeedQuery");

require("express-async-errors");

usersRouter.post(
  "/",
  validate(postNewUserSchema),
  async (request, response) => {
    const { body } = request;

    const userFound = await User.findOne({
      where: { username: body.username },
    });
    if (userFound) {
      return response.status(400).json({ error: "username already taken" });
    }

    if (!(body.username && body.password)) {
      return response
        .status(400)
        .json({ error: "username or password missing" });
    }
    if (!(body.username.length > 2 && body.password.length > 2)) {
      return response
        .status(400)
        .json({ error: "username or password is too short" });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(body.password, saltRounds);

    await User.create({
      username: body.username,
      passwordHash,
      avatarImageUrl: `https://api.dicebear.com/10.x/voxel-art/svg?scale=1.25&seed=${encodeURIComponent(body.username)}`,
    }).catch((e) => {
      return response.status(400).json("error when creating user");
    });

    response.status(200).json("new user created");
  },
);

usersRouter.get("/:username", async (request, response) => {
  const username = request.params.username;

  const user = await User.findOne({ where: { username } });
  if (!user) {
    return response.status(404).json({ error: "user not found" });
  }

  const subredditsJoinedCount = await UserSubreddits.count({
    where: { userId: user.id },
  });

  const contributionsCount = await sequelize.query(
    `
          SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = :userId) +
          (SELECT COUNT(*) FROM comments WHERE user_id = :userId)
          AS totalCount;
                  
          `,
    {
      replacements: { userId: user.id },
      type: QueryTypes.SELECT,
    },
  );

  await response.status(200).json({
    username: user.username,
    introduction: user.introduction,
    avatarImageUrl: user.avatarImageUrl,
    profilePageBackgroundImageUrl: user.profilePageBackgroundImageUrl,
    createdAt: user.createdAt,
    subredditsJoinedCount,
    contributionsCount: contributionsCount[0].totalcount,
    karma: user.karma,
  });
});

usersRouter.get(
  "/:username/feed",
  validate(getUserPostsAndCommentsFeedSchema, "query"),
  async (request, response) => {
    const { username } = request.params;
    const { offset, contentType, sortByType, getTotalCount } = request.query;

    const user = await User.findOne({
      where: { username },
    });
    if (!user) {
      return response.status(404).json({ error: "user not found" });
    }
    if (contentType === USER_PAGE_CONTENT_TYPES.POSTS) {
      const posts = await Post.findAll({
        where: { userId: user.id },
        order:
          sortByType === USER_PAGE_CONTENT_SORT_BY_TYPES.TOP
            ? [
                [sequelize.literal('"up_votes"-"down_votes"'), "desc"],
                ["createdAt", "DESC"],
              ]
            : [["createdAt", SortOrder.DESC]],
        offset,
        limit: 5,
        include: [
          {
            model: User,
            attributes: ["username"],
            where: { username },
            required: true,
          },
          {
            model: Subreddit,
            as: "subreddit",
            attributes: ["name", "iconUrl"],
          },
        ],
      });

      const totalCount = getTotalCount
        ? await Post.count({ where: { userId: user.id } })
        : undefined;

      return response.send({
        feedItems: posts.map((post) => ({ data: post, type: "post" })),
        type: "post",
        totalCount,
      });
    }

    if (contentType === USER_PAGE_CONTENT_TYPES.COMMENTS) {
      const comments = await Comment.findAll({
        where: { userId: user.id },
        order:
          sortByType === USER_PAGE_CONTENT_SORT_BY_TYPES.TOP
            ? [
                [
                  sequelize.literal('comment."up_votes"-comment."down_votes"'),
                  "DESC",
                ],
                ["createdAt", "DESC"],
              ]
            : [["createdAt", SortOrder.DESC]],
        offset,
        limit: 5,
        include: [
          {
            model: User,
            attributes: ["username"],
            required: true,
          },
          {
            model: Post,
            attributes: ["id", "title"],
            required: true,
            include: [
              {
                model: Subreddit,
                as: "subreddit",
                attributes: ["name", "iconUrl"],
              },
            ],
          },
          {
            model: Comment,
            attributes: ["id"],
            required: false,
            as: "parentComment",
            include: [
              {
                model: User,
                required: false,
                attributes: ["username"],
              },
            ],
          },
        ],
      });
      const totalCount = getTotalCount
        ? await Comment.count({ where: { userId: user.id } })
        : undefined;

      return response.send({
        feedItems: comments.map((comment) => {
          return {
            data: {
              ...comment.get({ plain: true }),
              subreddit: comment.post.subreddit,
              post: comment.post,
              comment: comment.comment,
            },
            type: "comment",
          };
        }),
        totalCount,
      });
    }

    if (contentType === USER_PAGE_CONTENT_TYPES.OVERVIEW) {
      try {
        const result = await sequelize.query(getUserPageOverviewPageFeedQuery, {
          replacements: { userId: user.id, offset },
          type: QueryTypes.SELECT,
        });

        const totalCount = getTotalCount
          ? await sequelize.query(
              `
          SELECT
          (SELECT COUNT(*) FROM posts WHERE user_id = :userId) +
          (SELECT COUNT(*) FROM comments WHERE user_id = :userId)
          AS totalCount;
                  
          `,
              {
                replacements: { userId: user.id },
                type: QueryTypes.SELECT,
              },
            )
          : undefined;

        return response.send({
          feedItems: result.map(({ total_count, ...item }) => ({
            data: {
              ...item.data,
              subreddit: item.subreddit,
              user: item.user,
              post: item.post,
            },
            type: item.type,
          })),
          totalCount: totalCount?.[0]?.totalcount
            ? Number(totalCount[0].totalcount)
            : undefined,
        });
      } catch (e) {
        console.log(e);
      }
    }

    return response.json();
  },
);

module.exports = usersRouter;
