// Fills a local database with demo users, communities, posts, comments and
// votes. Run in Docker with: docker compose exec app npm run seed
// Every seeded user logs in with the password "password".
import "dotenv/config";

import bcrypt from "bcrypt";
import moment from "moment";
import type { Transaction } from "sequelize";
import { disableQueryLogging, sequelize } from "../utils/db";
import {
  User,
  Subreddit,
  SubredditModerators,
  UserSubreddits,
  Post,
  Comment,
  UserRatedPosts,
  UserRatedComments,
  SubredditLeaderboard,
  SubredditLeaderboardSubreddit,
} from "../models/index";
import type CommentModel from "../models/Comment";
import type PostModel from "../models/Post";
import type SubredditModel from "../models/Subreddit";
import type UserModel from "../models/User";
import { SUBREDDIT_MODERATOR_ROLE } from "../constants/subreddit.constant";

const LOCAL_DATABASE_HOSTS = ["localhost", "127.0.0.1", "db"];
const PASSWORD = "password";

// Deterministic random numbers so every seed run produces the same data.
const createRandom = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const random = createRandom(42);
const randomInt = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(random() * items.length)];

const LOREM_WORDS =
  `lorem ipsum dolor sit amet consectetur adipiscing elit sed do
eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam
quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat
duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla
pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia
deserunt mollit anim id est laborum`.split(/\s+/);

const loremWords = (count: number) => {
  const words = Array.from({ length: count }, () => pick(LOREM_WORDS));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const loremSentences = (count: number) =>
  Array.from({ length: count }, () => `${loremWords(randomInt(6, 14))}.`).join(
    " ",
  );

const USER_COUNT = 6;
const SUBREDDIT_COUNT = 5;
const POSTS_PER_SUBREDDIT = 3;

const USERS = Array.from({ length: USER_COUNT }, (_, index) => ({
  username: `demo_user${index + 1}`,
  introduction: loremSentences(1),
}));

// demo_userN creates demo_communityN. Earlier communities get more members so
// the top communities list has a clear order. demo_user2 also moderates
// demo_community1.
const SUBREDDITS = Array.from({ length: SUBREDDIT_COUNT }, (_, index) => {
  const creator = USERS[index].username;
  const others = USERS.map((u) => u.username).filter((u) => u !== creator);

  return {
    name: `demo_community${index + 1}`,
    description: loremSentences(1),
    creator,
    moderator: index === 0 ? USERS[1].username : undefined,
    members: others.slice(0, USER_COUNT - 1 - index),
  };
});

// Comments are [author, text, replies], nested up to two replies deep.
type SeedComment = [author: string, text: string, replies: SeedComment[]];

const createLoremComments = (
  authors: string[],
  depth: number,
): SeedComment[] => {
  const count = depth === 0 ? randomInt(0, 3) : randomInt(0, 2);

  return Array.from({ length: count }, () => [
    pick(authors),
    loremSentences(randomInt(1, 3)),
    depth < 2 ? createLoremComments(authors, depth + 1) : [],
  ]);
};

const POSTS = SUBREDDITS.flatMap(({ name, creator, members }) =>
  Array.from({ length: POSTS_PER_SUBREDDIT }, () => ({
    subreddit: name,
    author: pick([creator, ...members]),
    title: loremWords(randomInt(4, 9)),
    text: loremSentences(randomInt(2, 6)),
    comments: createLoremComments([creator, ...members], 0),
  })),
);

// Lorem ipsum has no meaning to search for, so posts get random unit vectors
// instead of real embeddings and the seed needs no API key. Not all zeros:
// cosine distance to a zero vector is undefined.
const createRandomEmbedding = () => {
  const values = Array.from({ length: 512 }, () => random() - 0.5);
  const length = Math.hypot(...values);
  return values.map((value) => value / length);
};

const assertLocalDatabase = () => {
  const host = new URL(process.env.DATABASE_URI as string).hostname;

  if (!LOCAL_DATABASE_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DATABASE_URI points to "${host}", not a local database.`,
    );
  }
};

// Backdate rows so the feed spans the past week instead of the last second.
const setCreatedAt = async (
  table: string,
  id: number,
  createdAt: Date,
  transaction: Transaction,
) => {
  await sequelize.query(
    `UPDATE ${table} SET created_at = :createdAt, updated_at = :createdAt WHERE id = :id`,
    { replacements: { createdAt, id }, transaction },
  );
};

// Each user other than the author votes with some probability, mostly up.
// Returns the vote totals for the post or comment.
const createVotes = async ({
  createVote,
  authorId,
  users,
}: {
  createVote: (userId: number, rating: number) => Promise<unknown>;
  authorId: number | null;
  users: UserModel[];
}) => {
  let upVotes = 0;
  let downVotes = 0;

  for (const user of users) {
    if (user.id === authorId || random() < 0.35) continue;

    const rating = random() < 0.85 ? 1 : -1;
    if (rating === 1) upVotes++;
    else downVotes++;

    await createVote(user.id, rating);
  }

  return { upVotes, downVotes };
};

type CreateCommentsContext = {
  post: PostModel;
  parentComment: CommentModel | null;
  createdAt: Date;
  usersByName: Record<string, UserModel>;
  users: UserModel[];
};

const createComments = async (
  comments: SeedComment[],
  { post, parentComment, createdAt, usersByName, users }: CreateCommentsContext,
  transaction: Transaction,
) => {
  for (const [author, text, replies] of comments) {
    const commentCreatedAt = moment(createdAt)
      .add(Math.ceil(random() * 90), "minutes")
      .toDate();
    const comment = await Comment.create(
      {
        postId: post.id,
        userId: usersByName[author].id,
        commentId: parentComment ? parentComment.id : null,
        directReplyToPost: !parentComment,
        text,
      },
      { transaction },
    );
    await setCreatedAt("comments", comment.id, commentCreatedAt, transaction);

    const votes = await createVotes({
      createVote: (userId, rating) =>
        UserRatedComments.create(
          { userId, commentId: comment.id, rating },
          { transaction },
        ),
      authorId: comment.userId,
      users,
    });
    await comment.update(votes, { transaction, silent: true });

    await createComments(
      replies,
      {
        post,
        parentComment: comment,
        createdAt: commentCreatedAt,
        usersByName,
        users,
      },
      transaction,
    );
  }
};

// Replaces any leaderboard the hourly job already made for this date.
const createLeaderboard = async (
  date: string,
  subreddits: SubredditModel[],
  transaction: Transaction,
) => {
  await SubredditLeaderboard.destroy({ where: { date }, transaction });

  const leaderboard = await SubredditLeaderboard.create(
    { date },
    { transaction },
  );

  for (const [index, subreddit] of subreddits.entries()) {
    await SubredditLeaderboardSubreddit.create(
      {
        subredditLeaderboardId: leaderboard.id,
        subredditId: subreddit.id,
        rank: index + 1,
      },
      { transaction },
    );
  }
};

const seed = async () => {
  assertLocalDatabase();
  disableQueryLogging();

  if (await User.findOne({ where: { username: USERS[0].username } })) {
    console.log(
      "Database is already seeded. To start over, run: docker compose down -v",
    );
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await sequelize.transaction(async (transaction) => {
    const users: UserModel[] = [];
    for (const { username, introduction } of USERS) {
      users.push(
        await User.create(
          {
            username,
            introduction,
            email: `${username}@example.com`,
            emailVerified: true,
            passwordHash,
          },
          { transaction },
        ),
      );
    }
    const usersByName = Object.fromEntries(users.map((u) => [u.username, u]));

    const subredditsByName: Record<string, SubredditModel> = {};
    for (const {
      name,
      description,
      creator,
      moderator,
      members,
    } of SUBREDDITS) {
      const subreddit = await Subreddit.create(
        { name, description, creatorId: usersByName[creator].id },
        { transaction },
      );
      subredditsByName[name] = subreddit;

      await SubredditModerators.create(
        {
          userId: usersByName[creator].id,
          subredditId: subreddit.id,
          role: SUBREDDIT_MODERATOR_ROLE.OWNER,
        },
        { transaction },
      );
      if (moderator) {
        await SubredditModerators.create(
          {
            userId: usersByName[moderator].id,
            subredditId: subreddit.id,
            role: SUBREDDIT_MODERATOR_ROLE.MODERATOR,
          },
          { transaction },
        );
      }

      for (const member of [creator, ...members]) {
        await UserSubreddits.create(
          { userId: usersByName[member].id, subredditId: subreddit.id },
          { transaction },
        );
      }
    }

    // Spread posts over the past week, newest last in the list.
    for (const [index, postData] of POSTS.entries()) {
      const createdAt = moment()
        .subtract((POSTS.length - index) * 11, "hours")
        .toDate();
      const post = await Post.create(
        {
          title: postData.title,
          text: postData.text,
          userId: usersByName[postData.author].id,
          subredditId: subredditsByName[postData.subreddit].id,
          embedding: createRandomEmbedding(),
        },
        { transaction },
      );
      await setCreatedAt("posts", post.id, createdAt, transaction);

      const votes = await createVotes({
        createVote: (userId, rating) =>
          UserRatedPosts.create(
            { userId, postId: post.id, rating },
            { transaction },
          ),
        authorId: post.userId,
        users,
      });
      await post.update(votes, { transaction, silent: true });

      await createComments(
        postData.comments,
        { post, parentComment: null, createdAt, usersByName, users },
        transaction,
      );
    }

    // Today's ranking by member count, and last week's with the top two
    // swapped so the sidebar shows rank changes.
    const ranked = await Subreddit.findAll({
      order: [
        ["memberCount", "DESC"],
        ["id", "ASC"],
      ],
      transaction,
    });
    const lastWeek = [ranked[1], ranked[0], ...ranked.slice(2)];
    await createLeaderboard(
      moment().subtract(7, "days").format("YYYY-MM-DD"),
      lastWeek,
      transaction,
    );
    await createLeaderboard(moment().format("YYYY-MM-DD"), ranked, transaction);
  });

  console.log(
    `Seeded ${USERS.length} users, ${SUBREDDITS.length} communities and ${POSTS.length} posts.`,
  );
  console.log(
    `Log in as any of: ${USERS.map((u) => u.username).join(", ")} (password: "${PASSWORD}")`,
  );
};

seed()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
