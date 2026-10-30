const crypto = require("node:crypto");

jest.mock("pgvector/sequelize", () => {
  const { DataTypes } = jest.requireActual("sequelize");
  DataTypes.VECTOR = () => DataTypes.STRING;
  return {};
});

jest.mock("../enums/subreddit.enum", () => ({
  SubredditModeratorRole: {
    OWNER: "owner",
    MODERATOR: "moderator",
    MODERATOR_LIMITED: "moderator_limited",
  },
}));

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../utils/db");
const {
  Comment,
  Post,
  UserRatedComments,
  UserRatedPosts,
} = require("../models");
const registerLikeHandlers = require("../websockets/likes");

sequelize.options.logging = false;

let authorId;
let voterId;
let subredditId;
let postId;
let commentId;
let socketHandlers;
let io;

const createSocketHarness = () => {
  const handlers = {};
  const socket = {
    on: (eventName, handler) => {
      handlers[eventName] = handler;
    },
  };
  const socketServer = {
    emit: jest.fn(),
    on: (eventName, handler) => {
      if (eventName === "connection") {
        handler(socket);
      }
    },
  };

  registerLikeHandlers(socketServer);
  return { handlers, socketServer };
};

const insertFixtureUser = async (username) => {
  const [user] = await sequelize.query(
    `INSERT INTO public.users
      (username, password_hash, email, email_verified, created_at, updated_at)
     VALUES
      (:username, 'voting-test-password-hash', :email, true, NOW(), NOW())
     RETURNING id;`,
    {
      replacements: {
        username,
        email: `${username}@example.test`,
      },
      type: QueryTypes.SELECT,
    },
  );
  return user.id;
};

const getVoteState = async (tableName, resourceIdColumn, resourceId) => {
  const [state] = await sequelize.query(
    `SELECT
        resource.up_votes,
        resource.down_votes,
        users.karma,
        COALESCE(vote.rating, 0) AS rating
      FROM public.${tableName === "user_rated_posts" ? "posts" : "comments"} AS resource
      JOIN public.users ON users.id = :authorId
      LEFT JOIN public.${tableName} AS vote
        ON vote.${resourceIdColumn} = resource.id
        AND vote.user_id = :voterId
      WHERE resource.id = :resourceId;`,
    {
      replacements: { authorId, voterId, resourceId },
      type: QueryTypes.SELECT,
    },
  );
  return state;
};

beforeAll(async () => {
  if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URI) {
    throw new Error(
      "The voting integration test requires NODE_ENV=test and TEST_DATABASE_URI.",
    );
  }

  require("../scripts/verify-test-database");
  await sequelize.authenticate();

  const fixtureSuffix = crypto.randomUUID();
  authorId = await insertFixtureUser(`voting-author-${fixtureSuffix}`);
  voterId = await insertFixtureUser(`voting-user-${fixtureSuffix}`);

  const [subreddit] = await sequelize.query(
    `INSERT INTO public.subreddits
      (name, description, creator_id, created_at, updated_at)
     VALUES
      (:name, 'Voting integration test fixture', :authorId, NOW(), NOW())
     RETURNING id;`,
    {
      replacements: {
        name: `voting-test-${fixtureSuffix}`,
        authorId,
      },
      type: QueryTypes.SELECT,
    },
  );
  subredditId = subreddit.id;

  const [vectorExtensions] = await sequelize.query(`
    SELECT quote_ident(namespace.nspname) AS schema
    FROM pg_catalog.pg_extension extension
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'vector';
  `);
  const vectorExtension = vectorExtensions[0];
  if (!vectorExtension?.schema) {
    throw new Error("The vector extension schema could not be determined.");
  }

  const [post] = await sequelize.query(
    `INSERT INTO public.posts
      (title, text, user_id, subreddit_id, created_at, updated_at, embedding)
     VALUES
      ('Voting integration test post', 'Fixture', :authorId, :subredditId,
       NOW(), NOW(), CAST(:embedding AS ${vectorExtension.schema}.vector))
     RETURNING id;`,
    {
      replacements: {
        authorId,
        subredditId,
        embedding: `[${Array(512).fill(0).join(",")}]`,
      },
      type: QueryTypes.SELECT,
    },
  );
  postId = post.id;

  const [comment] = await sequelize.query(
    `INSERT INTO public.comments
      (text, direct_reply_to_post, user_id, post_id, created_at, updated_at)
     VALUES
      ('Voting integration test comment', true, :authorId, :postId,
       NOW(), NOW())
     RETURNING id;`,
    {
      replacements: { authorId, postId },
      type: QueryTypes.SELECT,
    },
  );
  commentId = comment.id;

  ({ handlers: socketHandlers, socketServer: io } = createSocketHarness());
});

beforeEach(() => {
  io.emit.mockClear();
});

afterAll(async () => {
  try {
    if (commentId) {
      await Comment.destroy({ where: { id: commentId } });
    }
    if (postId) {
      await Post.destroy({ where: { id: postId } });
    }
    if (subredditId) {
      await sequelize.query("DELETE FROM public.subreddits WHERE id = :id", {
        replacements: { id: subredditId },
      });
    }
    if (authorId) {
      await sequelize.query("DELETE FROM public.users WHERE id = :id", {
        replacements: { id: authorId },
      });
    }
    if (voterId) {
      await sequelize.query("DELETE FROM public.users WHERE id = :id", {
        replacements: { id: voterId },
      });
    }
  } finally {
    await sequelize.close();
  }
});

test("post vote changes persist scores and update author karma", async () => {
  const upvoteResult = jest.fn();
  await socketHandlers.likePost({ postId, userId: voterId }, upvoteResult);

  expect(upvoteResult).toHaveBeenCalledWith({ success: true, newRating: 1 });
  expect(await getVoteState("user_rated_posts", "post_id", postId)).toMatchObject({
    up_votes: 1,
    down_votes: 0,
    karma: 1,
    rating: 1,
  });
  expect(await UserRatedPosts.count({ where: { postId, userId: voterId } })).toBe(
    1,
  );

  const downvoteResult = jest.fn();
  await socketHandlers.dislikePost(
    { postId, userId: voterId },
    downvoteResult,
  );

  expect(downvoteResult).toHaveBeenCalledWith({
    success: true,
    newRating: -1,
  });
  expect(await getVoteState("user_rated_posts", "post_id", postId)).toMatchObject({
    up_votes: 0,
    down_votes: 1,
    karma: -1,
    rating: -1,
  });

  const removeVoteResult = jest.fn();
  await socketHandlers.dislikePost(
    { postId, userId: voterId },
    removeVoteResult,
  );

  expect(removeVoteResult).toHaveBeenCalledWith({
    success: true,
    newRating: 0,
  });
  expect(await getVoteState("user_rated_posts", "post_id", postId)).toMatchObject({
    up_votes: 0,
    down_votes: 0,
    karma: 0,
    rating: 0,
  });
  expect(await UserRatedPosts.count({ where: { postId, userId: voterId } })).toBe(
    0,
  );
  expect(io.emit).toHaveBeenCalledTimes(3);
});

test("comment vote changes persist scores and update author karma", async () => {
  await socketHandlers.likeComment({ commentId, userId: voterId });

  expect(
    await getVoteState("user_rated_comments", "comment_id", commentId),
  ).toMatchObject({
    up_votes: 1,
    down_votes: 0,
    karma: 1,
    rating: 1,
  });
  expect(
    await UserRatedComments.count({ where: { commentId, userId: voterId } }),
  ).toBe(1);

  await socketHandlers.dislikeComment({ commentId, userId: voterId });

  expect(
    await getVoteState("user_rated_comments", "comment_id", commentId),
  ).toMatchObject({
    up_votes: 0,
    down_votes: 1,
    karma: -1,
    rating: -1,
  });

  await socketHandlers.dislikeComment({ commentId, userId: voterId });

  expect(
    await getVoteState("user_rated_comments", "comment_id", commentId),
  ).toMatchObject({
    up_votes: 0,
    down_votes: 0,
    karma: 0,
    rating: 0,
  });
  expect(
    await UserRatedComments.count({ where: { commentId, userId: voterId } }),
  ).toBe(0);
  expect(io.emit).toHaveBeenCalledTimes(3);
});
