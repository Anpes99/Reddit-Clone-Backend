import { Router, type Request } from "express";
import {
  Op,
  QueryTypes,
  type CountOptions,
  type FindOptions,
  type InferAttributes,
} from "sequelize";
import { Subreddit, Post, User } from "../models/index";
import { sequelize } from "../utils/db";
import { validate } from "../utils/middleware/middleware";
import {
  searchSuggestionsSchema,
  searchPostsSchema,
  searchSubredditsSchema,
  type SearchPostsQuery,
  type SearchSubredditsQuery,
  type SearchSuggestionsQuery,
} from "../validators/search.validator";
import { POSTS_ORDER_TYPE } from "../constants/post.constant";
import { generateEmbedding } from "../utils/embeddings";
import { getOnlineSubredditUserCount } from "../websockets/onlineCount";

type VectorSearchPostRow = {
  id: number;
  title: string;
  up_votes: number;
  down_votes: number;
  image_url: string | null;
  comment_count: number;
  created_at: Date;
  subreddit_name: string | null;
  subreddit_icon_url: string | null;
  // COUNT(*) is a bigint, which pg returns as a string
  total_count: string;
};

const searchRouter = Router();

searchRouter.post(
  "/suggestions",
  validate(searchSuggestionsSchema),
  async (
    req: Request<Record<string, string>, unknown, SearchSuggestionsQuery>,
    res,
  ) => {
    const searchWord = req.body.searchWord;
    const result = await Subreddit.findAll({
      where: {
        name: {
          [Op.iLike]: `%${searchWord}%`,
        },
      },
      attributes: ["id", "name"],
      limit: 10,
    });
    return res.send({ result });
  },
);

searchRouter.post(
  "/posts",
  validate(searchPostsSchema),
  async (
    req: Request<Record<string, string>, unknown, SearchPostsQuery>,
    res,
  ) => {
    const { searchQuery, offset, limit, orderType, prevSearchWordEmbedding } =
      req.body;

    if (orderType !== POSTS_ORDER_TYPE.TOP) {
      const options: FindOptions<InferAttributes<Post>> = {
        where: {
          safe: true,
          [Op.or]: [
            { title: { [Op.iLike]: `%${String(searchQuery)}%` } },
            sequelize.where(
              sequelize.fn(
                "word_similarity",
                String(searchQuery),
                sequelize.col("title"),
              ),
              { [Op.gte]: 0.4 },
            ),
            sequelize.where(
              sequelize.fn(
                "word_similarity",
                String(searchQuery),
                sequelize.col("text"),
              ),
              { [Op.gte]: 0.4 },
            ),
            sequelize.where(
              sequelize.fn(
                "word_similarity",
                String(searchQuery),
                sequelize.col("subreddit.name"),
              ),
              { [Op.gte]: 0.4 },
            ),
          ],
        },
        offset,
        limit,
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            attributes: ["username"],
          },
          { model: Subreddit, attributes: ["name", "iconUrl"] },
        ],
      };

      const countOptions: CountOptions<InferAttributes<Post>> = {
        where: options.where,
        include: [{ model: Subreddit, attributes: [] }],
      };
      const totalCount = await Post.count(countOptions);
      const posts = await Post.findAll(options);
      return res.send({ posts, totalCount });
    } else {
      const searchWord = String(searchQuery).toLowerCase();
      const escapedSearchWord = sequelize.escape(searchWord);

      let vectorValue: string;

      if (prevSearchWordEmbedding) vectorValue = prevSearchWordEmbedding;
      else {
        const searchWordEmbedding = await generateEmbedding(
          escapedSearchWord,
          "query",
        );

        vectorValue = `[${searchWordEmbedding.join(",")}]`;
      }

      const posts = await sequelize.query<VectorSearchPostRow>(
        `SELECT
          posts.id,
          posts.title,
          posts.up_votes,
          posts.down_votes,
          posts.image_url,
          posts.comment_count,
          posts.created_at,
          subreddits.name AS subreddit_name,
          subreddits.icon_url AS subreddit_icon_url,
          COUNT(*) OVER() AS total_count
        FROM posts
        LEFT JOIN subreddits ON posts.subreddit_id = subreddits.id
        WHERE posts.embedding IS NOT NULL and posts.safe = true
        ORDER BY posts.embedding <=> CAST(:searchWordEmbedding AS vector)
        LIMIT :limit OFFSET :offset;`,
        {
          replacements: { searchWordEmbedding: vectorValue, limit, offset },
          type: QueryTypes.SELECT,
        },
      );

      const resultPosts = posts.map((post) => ({
        id: post.id,
        title: post.title,
        upVotes: post.up_votes,
        downVotes: post.down_votes,
        imageUrl: post.image_url,
        commentCount: post.comment_count,
        createdAt: post.created_at,
        subreddit: {
          name: post.subreddit_name,
          iconUrl: post.subreddit_icon_url,
        },
      }));
      return res.send({
        posts: resultPosts,
        totalCount: Number(posts[0]?.total_count ?? 0),
        searchWordEmbedding: vectorValue,
      });

      //    search functionality option using only postgres
      //
      //
      // CREATE EXTENSION IF NOT EXISTS pg_trgm;

      // CREATE INDEX posts_title_trgm_idx
      // ON posts USING GIN (title gin_trgm_ops);

      // CREATE INDEX posts_text_trgm_idx
      // ON posts USING GIN (text gin_trgm_ops);

      //  const titleScore = sequelize.fn(
      //       "similarity",
      //       sequelize.col("title"),
      //       searchWord,
      //     );

      //     const textScore = sequelize.fn(
      //       "similarity",
      //       sequelize.col("text"),
      //       searchWord,
      //     );

      //     const wordScore = sequelize.fn(
      //       "word_similarity",
      //       searchWord,
      //       sequelize.col("title"),
      //     );

      //     const wordScoreSubredditName = sequelize.fn(
      //       "word_similarity",
      //       searchWord,
      //       sequelize.col("subreddit.name"),
      //     );

      //     const overallScore = sequelize.literal(`
      //   GREATEST(
      //     similarity("post"."title", ${escapedSearchWord}),
      //     similarity("post"."text", ${escapedSearchWord}),
      //     word_similarity(${escapedSearchWord}, "post"."title"),
      //     word_similarity(${escapedSearchWord}, "subreddit"."name")
      //   )
      // `);

      //     const options = {
      //       offset,
      //       limit: 50,

      //       attributes: {
      //         include: [
      //           [titleScore, "title_score"],
      //           [textScore, "text_score"],
      //           [wordScore, "word_score"],
      //           [wordScoreSubredditName, "word_score_subreddit_name"],
      //           [overallScore, "overall_score"],
      //         ],
      //       },

      //       where: sequelize.where(overallScore, {
      //         [Op.gte]: 0.2,
      //       }),

      //       order: [
      //         [
      //           sequelize.literal(`
      //         CASE
      //           WHEN word_similarity(
      //             ${escapedSearchWord},
      //             "post"."title"
      //           ) >= 0.6
      //           THEN 1 ELSE 0
      //         END
      //       `),
      //           "DESC",
      //         ],
      //         [
      //           sequelize.literal(`
      //         CASE
      //           WHEN ${overallScore.val} >= 0.6
      //           THEN 1 ELSE 0
      //         END
      //       `),
      //           "DESC",
      //         ],
      //         [wordScore, "DESC"],
      //         [wordScoreSubredditName, "DESC"],
      //         [titleScore, "DESC"],
      //         [textScore, "DESC"],
      //       ],

      //       include: [
      //         {
      //           model: User,
      //           attributes: ["username"],
      //         },
      //         {
      //           model: Subreddit,
      //           attributes: ["name", "iconUrl"],
      //         },
      //       ],
      //     };

      //     const posts = await Post.findAll(options).catch((e) => {
      //       console.error(e);
      //     });
      //  const { limit, offset: offset1, ...countOptions } = options;
      //  const posts = await Post.findAll(options);
      //
      //   return res.send({ posts, totalCount });
      //
    }
  },
);

searchRouter.post(
  "/subreddits",
  validate(searchSubredditsSchema),
  async (
    req: Request<Record<string, string>, unknown, SearchSubredditsQuery>,
    res,
  ) => {
    const { searchQuery, offset, limit } = req.body;
    const searchWord = String(searchQuery).toLowerCase();
    const escapedSearchWord = sequelize.escape(searchWord);
    const similarityScore = sequelize.fn(
      "word_similarity",
      escapedSearchWord,
      sequelize.col("name"),
    );

    const where = sequelize.where(similarityScore, {
      [Op.gte]: 0.2,
    });

    const options: FindOptions<InferAttributes<Subreddit>> = {
      offset,
      limit,
      where,
      attributes: ["id", "name", "description", "memberCount", "iconUrl"],
      order: [
        [similarityScore, "DESC"],
        ["member_count", "DESC"],
      ],
    };

    const totalCount = await Subreddit.count({ where });
    const subreddits = await Subreddit.findAll(options);
    const onlineUserCounts: Record<string, number> = {};
    for (const subreddit of subreddits) {
      const onlineUserCount = getOnlineSubredditUserCount(subreddit.name);
      onlineUserCounts[subreddit.name] = onlineUserCount;
    }

    return res.send({
      subreddits: subreddits.map((subreddit) => ({
        ...subreddit.dataValues,
        onlineUserCount: onlineUserCounts[subreddit.name],
      })),
      totalCount,
    });
  },
);

export = searchRouter;
