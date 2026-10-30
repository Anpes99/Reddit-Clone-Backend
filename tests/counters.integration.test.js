const crypto = require("node:crypto");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../utils/db");

sequelize.options.logging = false;

let authorId;
let memberId;
let subredditId;
let postId;

const insertReturningId = async (sql, replacements) => {
  const [row] = await sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
  });
  return row.id;
};

const insertFixtureUser = (username) =>
  insertReturningId(
    `INSERT INTO public.users
      (username, password_hash, email, email_verified, created_at, updated_at)
     VALUES
      (:username, 'counters-test-password-hash', :email, true, NOW(), NOW())
     RETURNING id;`,
    { username, email: `${username}@example.test` },
  );

const insertComment = (parentCommentId) =>
  insertReturningId(
    `INSERT INTO public.comments
      (text, direct_reply_to_post, user_id, post_id, comment_id,
       created_at, updated_at)
     VALUES
      ('Counters integration test comment', :directReplyToPost, :authorId,
       :postId, :parentCommentId, NOW(), NOW())
     RETURNING id;`,
    {
      directReplyToPost: parentCommentId === null,
      authorId,
      postId,
      parentCommentId,
    },
  );

const deleteComment = (id) =>
  sequelize.query("DELETE FROM public.comments WHERE id = :id", {
    replacements: { id },
  });

const getDescendantCounts = async (ids) => {
  const rows = await sequelize.query(
    "SELECT id, descendant_count FROM public.comments WHERE id IN (:ids)",
    { replacements: { ids }, type: QueryTypes.SELECT },
  );
  return ids.map((id) => rows.find((row) => row.id === id).descendant_count);
};

const getPostCommentCount = async () => {
  const [post] = await sequelize.query(
    "SELECT comment_count FROM public.posts WHERE id = :postId",
    { replacements: { postId }, type: QueryTypes.SELECT },
  );
  return post.comment_count;
};

const getSubredditMemberCount = async () => {
  const [subreddit] = await sequelize.query(
    "SELECT member_count FROM public.subreddits WHERE id = :subredditId",
    { replacements: { subredditId }, type: QueryTypes.SELECT },
  );
  return subreddit.member_count;
};

const joinSubreddit = (userId) =>
  sequelize.query(
    `INSERT INTO public.user_subreddits (user_id, subreddit_id)
     VALUES (:userId, :subredditId);`,
    { replacements: { userId, subredditId } },
  );

const leaveSubreddit = (userId) =>
  sequelize.query(
    `DELETE FROM public.user_subreddits
     WHERE user_id = :userId AND subreddit_id = :subredditId;`,
    { replacements: { userId, subredditId } },
  );

beforeAll(async () => {
  if (process.env.NODE_ENV !== "test" || !process.env.TEST_DATABASE_URI) {
    throw new Error(
      "The counters integration test requires NODE_ENV=test and TEST_DATABASE_URI.",
    );
  }

  require("../scripts/verify-test-database");
  await sequelize.authenticate();

  const fixtureSuffix = crypto.randomUUID();
  authorId = await insertFixtureUser(`counters-author-${fixtureSuffix}`);
  memberId = await insertFixtureUser(`counters-member-${fixtureSuffix}`);

  subredditId = await insertReturningId(
    `INSERT INTO public.subreddits
      (name, description, creator_id, created_at, updated_at)
     VALUES
      (:name, 'Counters integration test fixture', :authorId, NOW(), NOW())
     RETURNING id;`,
    { name: `counters-test-${fixtureSuffix}`, authorId },
  );

  const [vectorExtensions] = await sequelize.query(`
    SELECT quote_ident(namespace.nspname) AS schema
    FROM pg_catalog.pg_extension extension
    JOIN pg_catalog.pg_namespace namespace
      ON namespace.oid = extension.extnamespace
    WHERE extension.extname = 'vector';
  `);
  const vectorSchema = vectorExtensions[0]?.schema;
  if (!vectorSchema) {
    throw new Error("The vector extension schema could not be determined.");
  }

  postId = await insertReturningId(
    `INSERT INTO public.posts
      (title, text, user_id, subreddit_id, created_at, updated_at, embedding)
     VALUES
      ('Counters integration test post', 'Fixture', :authorId, :subredditId,
       NOW(), NOW(), CAST(:embedding AS ${vectorSchema}.vector))
     RETURNING id;`,
    {
      authorId,
      subredditId,
      embedding: `[${Array(512).fill(0).join(",")}]`,
    },
  );
});

afterAll(async () => {
  try {
    if (postId) {
      await sequelize.query("DELETE FROM public.posts WHERE id = :id", {
        replacements: { id: postId },
      });
    }
    if (subredditId) {
      await sequelize.query(
        "DELETE FROM public.user_subreddits WHERE subreddit_id = :id",
        { replacements: { id: subredditId } },
      );
      await sequelize.query("DELETE FROM public.subreddits WHERE id = :id", {
        replacements: { id: subredditId },
      });
    }
    for (const id of [authorId, memberId].filter(Boolean)) {
      await sequelize.query("DELETE FROM public.users WHERE id = :id", {
        replacements: { id },
      });
    }
  } finally {
    await sequelize.close();
  }
});

test("comment inserts and deletes keep descendant and post comment counts in sync", async () => {
  const rootId = await insertComment(null);
  const replyId = await insertComment(rootId);
  const nestedReplyId = await insertComment(replyId);
  const siblingReplyId = await insertComment(rootId);

  expect(
    await getDescendantCounts([rootId, replyId, nestedReplyId, siblingReplyId]),
  ).toEqual([3, 1, 0, 0]);
  expect(await getPostCommentCount()).toBe(4);

  await deleteComment(nestedReplyId);

  expect(await getDescendantCounts([rootId, replyId, siblingReplyId])).toEqual(
    [2, 0, 0],
  );
  expect(await getPostCommentCount()).toBe(3);

  await deleteComment(siblingReplyId);
  await deleteComment(replyId);
  await deleteComment(rootId);

  expect(await getPostCommentCount()).toBe(0);
});

test("joining and leaving a subreddit keeps its member count in sync", async () => {
  expect(await getSubredditMemberCount()).toBe(0);

  await joinSubreddit(authorId);
  await joinSubreddit(memberId);
  expect(await getSubredditMemberCount()).toBe(2);

  await expect(joinSubreddit(memberId)).rejects.toMatchObject({
    name: "SequelizeUniqueConstraintError",
  });
  expect(await getSubredditMemberCount()).toBe(2);

  await leaveSubreddit(memberId);
  expect(await getSubredditMemberCount()).toBe(1);

  await leaveSubreddit(memberId);
  expect(await getSubredditMemberCount()).toBe(1);

  await leaveSubreddit(authorId);
  expect(await getSubredditMemberCount()).toBe(0);
});
