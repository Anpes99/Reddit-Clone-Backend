import type { CountOptions, FindOptions, InferAttributes } from "sequelize";
import { SORT_ORDER } from "../constants/sort-order.constant";
import { User, Post, Subreddit } from "../models/index";
import { sequelize } from "../utils/db";
import type { AppServer } from "./types";

type PostOptions = FindOptions<InferAttributes<Post>>;
type PostCountOptions = CountOptions<InferAttributes<Post>>;

const FEED_PAGE_SIZE = 5;

const FEED_POST_ATTRIBUTES = [
  "id",
  "title",
  "imageUrl",
  "upVotes",
  "downVotes",
  "commentCount",
  "createdAt",
] as const;

export = function (io: AppServer) {
  io.on("connection", (socket) => {
    socket.on(
      "fetch_more_posts",
      async ({ order, sortBy, offset, subredditId }, cb) => {
        const totalCountOptions: PostCountOptions = { where: { safe: true } };

        if (subredditId)
          totalCountOptions.where = {
            ...totalCountOptions.where,
            subredditId: Number(subredditId),
          };
        const totalCount = await Post.count(totalCountOptions);

        const options: PostOptions = {
          where: { safe: true },
          attributes: [...FEED_POST_ATTRIBUTES],
          order: [["createdAt", SORT_ORDER.DESC]],
          offset,
          limit: FEED_PAGE_SIZE,
          include: [
            {
              model: User,
              attributes: ["username"],
            },
            {
              model: Subreddit,
              as: "subreddit",
              attributes: ["name", "iconUrl"],
            },
          ],
        };
        if (subredditId)
          options.where = {
            ...options.where,
            subredditId: Number(subredditId),
          };

        if (order && sortBy) options.order = [[sortBy, order]];

        const posts = await Post.findAll(options);
        cb({ posts, totalCount });
      },
    );

    socket.on("fetch_top_posts", async ({ offset, subredditId }, cb) => {
      const totalCountOptions: PostCountOptions = { where: { safe: true } };
      if (subredditId)
        totalCountOptions.where = {
          ...totalCountOptions.where,
          subredditId: Number(subredditId),
        };
      const totalCount = await Post.count(totalCountOptions);

      const options: PostOptions = {
        where: { safe: true },
        attributes: [...FEED_POST_ATTRIBUTES],
        offset,
        limit: FEED_PAGE_SIZE,
        include: [
          {
            model: User,
            attributes: ["username"],
          },
          {
            model: Subreddit,
            as: "subreddit",
            attributes: ["name", "iconUrl"],
          },
        ],
        order: [
          [sequelize.literal('"up_votes"-"down_votes"'), "desc"],
          ["createdAt", "DESC"],
        ],
      };

      if (subredditId)
        options.where = {
          ...options.where,
          subredditId: Number(subredditId),
        };

      const posts = await Post.findAll(options);

      cb({ posts, totalCount });
    });
  });
};
