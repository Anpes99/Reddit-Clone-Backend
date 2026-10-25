const searchRouter = require("express").Router();
const { Op } = require("sequelize");
const { Subreddit, Post, User } = require("../models/index");
const { sequelize } = require("../utils/db");
const { validate } = require("../utils/middleware");
const {
  searchSuggestionsSchema,
  searchPostsSchema,
  searchSubredditsSchema,
} = require("../validators/search.validator");
const { postsOrderType } = require("../enums/post.enum");
const { QueryTypes } = require("sequelize");
const { generateEmbedding } = require("../utils/embeddings");
const { getOnlineSubredditUserCount } = require("../websockets/onlineCount");

searchRouter.post(
  "/suggestions",
  validate(searchSuggestionsSchema),
  async (req, res) => {
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

searchRouter.post("/posts", validate(searchPostsSchema), async (req, res) => {
  const { searchQuery, offset, limit, orderType, prevSearchWordEmbedding } =
    req.body;

  if (orderType !== postsOrderType.TOP) {
    const options = {
      where: {
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

    const countOptions = {
      where: options.where,
      include: [{ model: Subreddit, attributes: [] }],
    };
    const totalCount = await Post.count(countOptions);
    const posts = await Post.findAll(options);
    return res.send({ posts, totalCount });
  } else {
    const searchWord = String(searchQuery).toLowerCase();
    const escapedSearchWord = sequelize.escape(searchWord);

    let vectorValue;

    if (prevSearchWordEmbedding) vectorValue = prevSearchWordEmbedding;
    else {
      const searchWordEmbedding = await generateEmbedding(
        escapedSearchWord,
        "query",
      );

      vectorValue = `[${searchWordEmbedding.join(",")}]`;
    }

    const posts = await sequelize.query(
      `SELECT
          posts.*,
          subreddits.name AS subreddit_name,
          subreddits.icon_url AS subreddit_icon_url,
          1 - (posts.embedding <=> CAST(:searchWordEmbedding AS vector)) AS similarity,
          COUNT(*) OVER() AS total_count
        FROM posts
        LEFT JOIN subreddits ON posts.subreddit_id = subreddits.id
        WHERE posts.embedding IS NOT NULL
        ORDER BY posts.embedding <=> CAST(:searchWordEmbedding AS vector)
        LIMIT :limit OFFSET :offset;`,
      {
        replacements: { searchWordEmbedding: vectorValue, limit, offset },
        type: QueryTypes.SELECT,
      },
    );

    const resultPosts = posts.map(
      ({
        user_id,
        subreddit_id,
        up_votes,
        down_votes,
        image_url,
        comment_count,
        created_at,
        updated_at,
        total_count,
        subreddit_name,
        subreddit_icon_url,
        embedding,
        ...post
      }) => ({
        ...post,
        userId: user_id,
        subredditId: subreddit_id,
        upVotes: up_votes,
        downVotes: down_votes,
        imageUrl: image_url,
        commentCount: comment_count,
        createdAt: created_at,
        updatedAt: updated_at,
        totalCount: total_count,
        subreddit: { name: subreddit_name, iconUrl: subreddit_icon_url },
      }),
    );
    return res.send({
      posts: resultPosts,
      totalCount: resultPosts[0].totalCount,
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
});

searchRouter.post(
  "/subreddits",
  validate(searchSubredditsSchema),
  async (req, res) => {
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

    const options = {
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
    const onlineUserCounts = {};
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

module.exports = searchRouter;
