import Joi from "joi";
import {
  POSTS_ORDER_TYPE,
  type PostsOrderType,
} from "../constants/post.constant.js";

export type SearchSuggestionsQuery = {
  searchWord?: string;
};

export const searchSuggestionsSchema = Joi.object<SearchSuggestionsQuery>({
  searchWord: Joi.string().min(1).max(500),
}).unknown(false);

export type SearchPostsQuery = {
  searchQuery?: string;
  offset: number;
  limit?: number;
  orderType?: PostsOrderType;
  prevSearchWordEmbedding?: string;
};

export const searchPostsSchema = Joi.object<SearchPostsQuery>({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0).default(0),
  limit: Joi.number().integer().min(1).max(100),
  orderType: Joi.string().valid(...Object.values(POSTS_ORDER_TYPE)),
  prevSearchWordEmbedding: Joi.string().max(10000),
}).unknown(false);

export type SearchSubredditsQuery = {
  searchQuery?: string;
  offset?: number;
  limit?: number;
};

export const searchSubredditsSchema = Joi.object<SearchSubredditsQuery>({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
}).unknown(false);
