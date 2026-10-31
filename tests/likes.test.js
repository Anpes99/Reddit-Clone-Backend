jest.mock("../models/index", () => ({
  Comment: { findByPk: jest.fn() },
  Post: { findByPk: jest.fn() },
  UserRatedComments: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  UserRatedPosts: {
    findOne: jest.fn(),
    create: jest.fn(),
    destroy: jest.fn(),
  },
}));

jest.mock("../utils/db", () => ({
  sequelize: {
    transaction: jest.fn((callback) => callback(mockTransaction)),
  },
}));

const mockTransaction = { id: "test-transaction" };

const {
  Comment,
  Post,
  UserRatedComments,
  UserRatedPosts,
} = require("../models/index");
const registerLikeHandlers = require("../websockets/likes");

const createSocketHarness = () => {
  const socketHandlers = {};
  const socket = {
    data: { user: { id: 8 } },
    use: jest.fn(),
    on: jest.fn((eventName, handler) => {
      socketHandlers[eventName] = handler;
    }),
  };
  const io = {
    emit: jest.fn(),
    on: jest.fn((eventName, handler) => {
      if (eventName === "connection") {
        handler(socket);
      }
    }),
  };

  registerLikeHandlers(io);
  return { io, socketHandlers };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("repeated upvotes", () => {
  it("toggles off the user's second upvote on the same post", async () => {
    const post = {
      id: 21,
      increment: jest.fn().mockResolvedValue(),
      decrement: jest.fn().mockResolvedValue(),
    };
    let existingVote = null;
    Post.findByPk.mockResolvedValue(post);
    UserRatedPosts.findOne.mockImplementation(async () => existingVote);
    UserRatedPosts.create.mockImplementation(async (vote) => {
      existingVote = { id: 34, ...vote };
      return existingVote;
    });
    UserRatedPosts.destroy.mockImplementation(async () => {
      existingVote = null;
      return 1;
    });
    const { io, socketHandlers } = createSocketHarness();
    const firstResult = jest.fn();
    const secondResult = jest.fn();

    await socketHandlers.likePost({ postId: 21 }, firstResult);
    await socketHandlers.likePost({ postId: 21 }, secondResult);

    expect(firstResult).toHaveBeenCalledWith({ success: true, newRating: 1 });
    expect(secondResult).toHaveBeenCalledWith({ success: true, newRating: 0 });
    expect(UserRatedPosts.create).toHaveBeenCalledTimes(1);
    expect(UserRatedPosts.destroy).toHaveBeenCalledWith({
      where: { id: 34, rating: 1 },
      transaction: mockTransaction,
    });
    expect(post.increment).toHaveBeenCalledWith("upVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(post.decrement).toHaveBeenCalledWith("upVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(existingVote).toBeNull();
    expect(io.emit).toHaveBeenNthCalledWith(1, "post_likes_changed", {
      postId: 21,
      pointsToAddOrMinus: 1,
    });
    expect(io.emit).toHaveBeenNthCalledWith(2, "post_likes_changed", {
      postId: 21,
      pointsToAddOrMinus: -1,
    });
  });

  it("toggles off the user's second upvote on the same comment", async () => {
    const comment = {
      id: 55,
      increment: jest.fn().mockResolvedValue(),
      decrement: jest.fn().mockResolvedValue(),
    };
    let existingVote = null;
    Comment.findByPk.mockResolvedValue(comment);
    UserRatedComments.findOne.mockImplementation(async () => existingVote);
    UserRatedComments.create.mockImplementation(async (vote) => {
      existingVote = { id: 89, ...vote };
      return existingVote;
    });
    UserRatedComments.destroy.mockImplementation(async () => {
      existingVote = null;
      return 1;
    });
    const { io, socketHandlers } = createSocketHarness();

    await socketHandlers.likeComment({ commentId: 55 });
    await socketHandlers.likeComment({ commentId: 55 });

    expect(UserRatedComments.create).toHaveBeenCalledTimes(1);
    expect(UserRatedComments.destroy).toHaveBeenCalledWith({
      where: { id: 89, rating: 1 },
      transaction: mockTransaction,
    });
    expect(comment.increment).toHaveBeenCalledWith("upVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(comment.decrement).toHaveBeenCalledWith("upVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(existingVote).toBeNull();
    expect(io.emit).toHaveBeenNthCalledWith(1, "comment_likes_changed", {
      commentId: 55,
      ratingToPlusOrMinus: 1,
    });
    expect(io.emit).toHaveBeenNthCalledWith(2, "comment_likes_changed", {
      commentId: 55,
      ratingToPlusOrMinus: -1,
    });
  });
});

describe("repeated downvotes", () => {
  it("toggles off the user's second downvote on the same post", async () => {
    const post = {
      id: 21,
      increment: jest.fn().mockResolvedValue(),
      decrement: jest.fn().mockResolvedValue(),
    };
    let existingVote = null;
    Post.findByPk.mockResolvedValue(post);
    UserRatedPosts.findOne.mockImplementation(async () => existingVote);
    UserRatedPosts.create.mockImplementation(async (vote) => {
      existingVote = { id: 34, ...vote };
      return existingVote;
    });
    UserRatedPosts.destroy.mockImplementation(async () => {
      existingVote = null;
      return 1;
    });
    const { io, socketHandlers } = createSocketHarness();
    const firstResult = jest.fn();
    const secondResult = jest.fn();

    await socketHandlers.dislikePost({ postId: 21 }, firstResult);
    await socketHandlers.dislikePost({ postId: 21 }, secondResult);

    expect(firstResult).toHaveBeenCalledWith({ success: true, newRating: -1 });
    expect(secondResult).toHaveBeenCalledWith({ success: true, newRating: 0 });
    expect(UserRatedPosts.create).toHaveBeenCalledTimes(1);
    expect(UserRatedPosts.destroy).toHaveBeenCalledWith({
      where: { userId: 8, postId: 21, rating: -1 },
      transaction: mockTransaction,
    });
    expect(post.increment).toHaveBeenCalledWith("downVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(post.decrement).toHaveBeenCalledWith("downVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(existingVote).toBeNull();
    expect(io.emit).toHaveBeenNthCalledWith(1, "post_likes_changed", {
      postId: 21,
      pointsToAddOrMinus: -1,
    });
    expect(io.emit).toHaveBeenNthCalledWith(2, "post_likes_changed", {
      postId: 21,
      pointsToAddOrMinus: 1,
    });
  });

  it("toggles off the user's second downvote on the same comment", async () => {
    const comment = {
      id: 55,
      increment: jest.fn().mockResolvedValue(),
      decrement: jest.fn().mockResolvedValue(),
    };
    let existingVote = null;
    Comment.findByPk.mockResolvedValue(comment);
    UserRatedComments.findOne.mockImplementation(async () => existingVote);
    UserRatedComments.create.mockImplementation(async (vote) => {
      existingVote = { id: 89, ...vote };
      return existingVote;
    });
    UserRatedComments.destroy.mockImplementation(async () => {
      existingVote = null;
      return 1;
    });
    const { io, socketHandlers } = createSocketHarness();

    await socketHandlers.dislikeComment({ commentId: 55 });
    await socketHandlers.dislikeComment({ commentId: 55 });

    expect(UserRatedComments.create).toHaveBeenCalledTimes(1);
    expect(UserRatedComments.destroy).toHaveBeenCalledWith({
      where: { id: 89, rating: -1 },
      transaction: mockTransaction,
    });
    expect(comment.increment).toHaveBeenCalledWith("downVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(comment.decrement).toHaveBeenCalledWith("downVotes", {
      by: 1,
      transaction: mockTransaction,
    });
    expect(existingVote).toBeNull();
    expect(io.emit).toHaveBeenNthCalledWith(1, "comment_likes_changed", {
      commentId: 55,
      ratingToPlusOrMinus: -1,
    });
    expect(io.emit).toHaveBeenNthCalledWith(2, "comment_likes_changed", {
      commentId: 55,
      ratingToPlusOrMinus: 1,
    });
  });
});
