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

export const postNewSubredditSchema = Joi.object({
  communityName: Joi.string().min(2).max(21).required(),
  description: Joi.string().min(1).max(500).required(),
  subredditIconUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);

export const updateSubredditSchema = Joi.object({
  description: Joi.string().min(1).max(500),
  subredditIconUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
  subredditPageBackgroundImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);
