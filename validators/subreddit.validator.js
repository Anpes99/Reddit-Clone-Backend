import Joi from "joi";
import { postsOrderType } from "../enums/post.enum.js";
import { SortOrder } from "../enums/sort-order.enum.js";
import { SUBREDDIT_ORDER_BY_TYPES } from "../enums/subreddit.enum.js";

export const searchSuggestionsSchema = Joi.object({
  searchWord: Joi.string().min(1).max(500),
}).unknown(false);

export const searchPostsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
  orderType: Joi.string().valid(...Object.values(postsOrderType)),
}).unknown(false);

export const getSubredditsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100),
  order: Joi.string().valid(SortOrder.ASC, SortOrder.DESC),
  sortBy: Joi.string().valid(...Object.values(SUBREDDIT_ORDER_BY_TYPES)),
}).unknown(false);

export const getSubredditSchema = Joi.object({
  name: Joi.string().required(),
}).unknown(false);
