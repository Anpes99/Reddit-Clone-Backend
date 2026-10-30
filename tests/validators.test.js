const { postNewPostCommentSchema } = require("../validators/comment.validator");
const {
  updateLoggedInUserSchema,
} = require("../validators/loggedInUser.validator");
const { loginSchema } = require("../validators/login.validator");
const {
  getPostSchema,
  postNewPostSchema,
} = require("../validators/post.validator");
const {
  searchPostsSchema,
  searchSubredditsSchema,
  searchSuggestionsSchema,
} = require("../validators/search.validator");
const {
  getSubredditsSchema,
  postNewSubredditSchema,
  updateSubredditSchema,
} = require("../validators/subreddit.validator");
const {
  forgottenPasswordSchema,
  getUserPostsAndCommentsFeedSchema,
  postNewUserSchema,
  resetPasswordSchema,
} = require("../validators/user.validator");
const {
  resendVerifyEmailEmailSchema,
  verifyEmailSchema,
} = require("../validators/verify-email-validator");

const validationOptions = { abortEarly: true, allowUnknown: false };

const expectValid = (schema, input) => {
  const { error, value } = schema.validate(input, validationOptions);
  expect(error).toBeUndefined();
  return value;
};

const expectInvalid = (schema, input, path) => {
  const { error } = schema.validate(input, validationOptions);
  expect(error).toBeDefined();
  expect(error.details[0].path).toEqual(path);
};

const HEX_TOKEN = "a".repeat(64);

describe("postNewPostCommentSchema", () => {
  const comment = {
    text: "A comment",
    directReplyToPost: false,
    commentId: 4,
    subredditId: 3,
    postId: 17,
  };

  it("accepts a reply and converts numeric strings", () => {
    expect(
      expectValid(postNewPostCommentSchema, { ...comment, postId: "17" }),
    ).toMatchObject({ postId: 17 });
  });

  it.each([
    ["missing text", { text: undefined }, ["text"]],
    ["empty text", { text: "" }, ["text"]],
    ["text over 10000 characters", { text: "a".repeat(10001) }, ["text"]],
    ["non-integer postId", { postId: 1.5 }, ["postId"]],
    ["a client-supplied userId", { userId: 99 }, ["userId"]],
  ])("rejects %s", (description, overrides, path) => {
    expectInvalid(postNewPostCommentSchema, { ...comment, ...overrides }, path);
  });
});

describe("updateLoggedInUserSchema", () => {
  it("accepts http(s) image URLs and empty values", () => {
    expectValid(updateLoggedInUserSchema, {
      introduction: "Hello",
      userAvatarImageUrl: "https://cdn.example.test/avatar.png",
      profilePageBackgroundImageUrl: "",
    });
    expectValid(updateLoggedInUserSchema, { userAvatarImageUrl: null });
  });

  it.each([
    [
      "a javascript: URL",
      { userAvatarImageUrl: "javascript:alert(1)" },
      ["userAvatarImageUrl"],
    ],
    [
      "a URL over 2048 characters",
      {
        profilePageBackgroundImageUrl: `https://example.test/${"a".repeat(2048)}`,
      },
      ["profilePageBackgroundImageUrl"],
    ],
    [
      "an introduction over 500 characters",
      { introduction: "a".repeat(501) },
      ["introduction"],
    ],
    ["unknown fields", { username: "someone-else" }, ["username"]],
  ])("rejects %s", (description, input, path) => {
    expectInvalid(updateLoggedInUserSchema, input, path);
  });
});

describe("loginSchema", () => {
  it("accepts a username and password", () => {
    expectValid(loginSchema, { username: "test-user", password: "secret" });
  });

  it.each([
    [
      "a username over 25 characters",
      { username: "a".repeat(26) },
      ["username"],
    ],
    ["a password under 4 characters", { password: "abc" }, ["password"]],
    [
      "a password over 128 characters",
      { password: "a".repeat(129) },
      ["password"],
    ],
  ])("rejects %s", (description, overrides, path) => {
    expectInvalid(
      loginSchema,
      { username: "test-user", password: "secret", ...overrides },
      path,
    );
  });
});

describe("post schemas", () => {
  it("accepts supported comment sort options", () => {
    expectValid(getPostSchema, { order: "ASC", sortBy: "upVotes" });
  });

  it.each([
    ["an unsupported order", { order: "SIDEWAYS" }, ["order"]],
    ["an unsupported sortBy column", { sortBy: "password_hash" }, ["sortBy"]],
  ])("rejects %s when fetching a post", (description, input, path) => {
    expectInvalid(getPostSchema, input, path);
  });

  it("accepts a new post with an image URL", () => {
    expectValid(postNewPostSchema, {
      title: "A post",
      imageUrl: "https://images.example.test/post.png",
      subredditName: "cats",
    });
  });

  it.each([
    ["a missing title", { title: undefined }, ["title"]],
    ["a title over 300 characters", { title: "a".repeat(301) }, ["title"]],
    [
      "a non-http image URL",
      { imageUrl: "ftp://example.test/a.png" },
      ["imageUrl"],
    ],
  ])("rejects a new post with %s", (description, overrides, path) => {
    expectInvalid(postNewPostSchema, { title: "A post", ...overrides }, path);
  });
});

describe("search schemas", () => {
  it("defaults the post search offset to 0", () => {
    expect(
      expectValid(searchPostsSchema, {
        searchQuery: "cats",
        limit: 10,
        orderType: "TOP",
      }),
    ).toMatchObject({ offset: 0 });
  });

  it.each([
    ["a limit over 100", { limit: 101 }, ["limit"]],
    ["a negative offset", { offset: -1 }, ["offset"]],
    ["an unknown order type", { orderType: "RANDOM" }, ["orderType"]],
    [
      "an oversized previous embedding",
      { prevSearchWordEmbedding: "a".repeat(10001) },
      ["prevSearchWordEmbedding"],
    ],
  ])("rejects a post search with %s", (description, overrides, path) => {
    expectInvalid(
      searchPostsSchema,
      { searchQuery: "cats", limit: 10, orderType: "TOP", ...overrides },
      path,
    );
  });

  it("rejects an empty search query", () => {
    expectInvalid(searchSubredditsSchema, { searchQuery: "" }, ["searchQuery"]);
    expectInvalid(searchSuggestionsSchema, { searchWord: "" }, ["searchWord"]);
  });
});

describe("subreddit schemas", () => {
  it("accepts a supported subreddit listing order", () => {
    expectValid(getSubredditsSchema, {
      limit: 10,
      order: "DESC",
      sortBy: "MEMBER_COUNT",
    });
  });

  it("rejects an unsupported subreddit listing sortBy", () => {
    expectInvalid(getSubredditsSchema, { sortBy: "creator_id" }, ["sortBy"]);
  });

  it.each([
    ["a name under 2 characters", { communityName: "a" }, ["communityName"]],
    [
      "a name over 21 characters",
      { communityName: "a".repeat(22) },
      ["communityName"],
    ],
    ["a missing description", { description: undefined }, ["description"]],
    [
      "a javascript: icon URL",
      { subredditIconUrl: "javascript:alert(1)" },
      ["subredditIconUrl"],
    ],
  ])("rejects a new subreddit with %s", (description, overrides, path) => {
    expectInvalid(
      postNewSubredditSchema,
      { communityName: "cats", description: "All about cats", ...overrides },
      path,
    );
  });

  it("rejects settings updates with unknown fields", () => {
    expectInvalid(updateSubredditSchema, { memberCount: 1000000 }, [
      "memberCount",
    ]);
  });
});

describe("user schemas", () => {
  it("trims and accepts a valid signup", () => {
    expect(
      expectValid(postNewUserSchema, {
        username: "  test_user-1  ",
        email: "test@example.com",
        password: "secret",
      }),
    ).toMatchObject({ username: "test_user-1" });
  });

  it.each([
    ["a username with spaces", { username: "test user" }, ["username"]],
    ["a username with markup", { username: "<script>" }, ["username"]],
    ["an invalid email", { email: "not-an-email" }, ["email"]],
  ])("rejects a signup with %s", (description, overrides, path) => {
    expectInvalid(
      postNewUserSchema,
      {
        username: "test-user",
        email: "test@example.com",
        password: "secret",
        ...overrides,
      },
      path,
    );
  });

  it("applies feed defaults and requires a content type", () => {
    expect(
      expectValid(getUserPostsAndCommentsFeedSchema, { contentType: "posts" }),
    ).toEqual({ contentType: "posts", offset: 0, getTotalCount: false });
    expectInvalid(getUserPostsAndCommentsFeedSchema, {}, ["contentType"]);
    expectInvalid(
      getUserPostsAndCommentsFeedSchema,
      { contentType: "messages" },
      ["contentType"],
    );
  });

  it("requires a valid email for a forgotten password", () => {
    expectInvalid(forgottenPasswordSchema, { email: "nope" }, ["email"]);
  });

  it.each([
    ["a short token", { passwordResetToken: "abc" }, ["passwordResetToken"]],
    [
      "a non-hex token",
      { passwordResetToken: "z".repeat(64) },
      ["passwordResetToken"],
    ],
    ["a short password", { password: "abc" }, ["password"]],
  ])("rejects a password reset with %s", (description, overrides, path) => {
    expectInvalid(
      resetPasswordSchema,
      { password: "secret", passwordResetToken: HEX_TOKEN, ...overrides },
      path,
    );
  });
});

describe("email verification schemas", () => {
  it("accepts a 64-character hex token", () => {
    expectValid(verifyEmailSchema, { token: HEX_TOKEN });
  });

  it.each([
    ["a short token", "abc"],
    ["a non-hex token", "z".repeat(64)],
  ])("rejects %s", (description, token) => {
    expectInvalid(verifyEmailSchema, { token }, ["token"]);
  });

  it("rejects a resend request with an invalid username", () => {
    expectInvalid(resendVerifyEmailEmailSchema, { username: "bad name" }, [
      "username",
    ]);
  });
});
