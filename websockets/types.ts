import type { Server, Socket } from "socket.io";
import type Comment from "../models/Comment";
import type Post from "../models/Post";
import type Subreddit from "../models/Subreddit";
import type User from "../models/User";

export type SocketUser = { id: User["id"]; username: User["username"] };

export type SocketData = {
  user?: SocketUser | null;
};

export type VoteCallback = (result: {
  success: boolean;
  newRating?: number;
}) => void;

export type FetchPostsCallback = (result: {
  posts: Post[];
  totalCount: number;
}) => void;

export type FetchMorePostsPayload = {
  order?: string;
  sortBy?: string;
  offset?: number;
  limit?: number;
  subredditId?: Subreddit["id"];
  username?: User["username"];
};

export type FetchTopPostsPayload = {
  offset?: number;
  subredditId?: Subreddit["id"];
  username?: User["username"];
};

export type ClientToServerEvents = {
  likePost: (payload: { postId: Post["id"] }, cb: VoteCallback) => void;
  dislikePost: (payload: { postId: Post["id"] }, cb: VoteCallback) => void;
  likeComment: (payload: { commentId: Comment["id"] }) => void;
  dislikeComment: (payload: { commentId: Comment["id"] }) => void;
  fetch_more_posts: (
    payload: FetchMorePostsPayload,
    cb: FetchPostsCallback,
  ) => void;
  fetch_top_posts: (
    payload: FetchTopPostsPayload,
    cb: FetchPostsCallback,
  ) => void;
  "subreddit:view": (payload: { subredditName: Subreddit["name"] }) => void;
  "presence:refresh": () => void;
};

export type ServerToClientEvents = {
  comment_likes_changed: (payload: {
    commentId: Comment["id"];
    ratingToPlusOrMinus: number;
  }) => void;
  post_likes_changed: (payload: {
    postId: Post["id"];
    pointsToAddOrMinus: number;
  }) => void;
  "subreddit:online-count": (count: number) => void;
};

// No events are sent between server instances
type InterServerEvents = Record<string, never>;

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
