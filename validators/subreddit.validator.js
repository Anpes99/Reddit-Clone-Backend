const Joi = require("joi");
const { postsOrderType } = require("../enums/post.enum.js");
const { SortOrder } = require("../enums/sort-order.enum.js");
const { SUBREDDIT_ORDER_BY_TYPES } = require("../enums/subreddit.enum.js");

const searchSuggestionsSchema = Joi.object({
  searchWord: Joi.string().min(1).max(500),
}).unknown(false);

const searchPostsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
  orderType: Joi.string().valid(...Object.values(postsOrderType)),
}).unknown(false);

const getSubredditsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100),
  order: Joi.string().valid(SortOrder.ASC, SortOrder.DESC),
  sortBy: Joi.string().valid(...Object.values(SUBREDDIT_ORDER_BY_TYPES)),
}).unknown(false);

const getSubredditSchema = Joi.object({
  name: Joi.string().required(),
}).unknown(false);

const postNewSubredditSchema = Joi.object({
  communityName: Joi.string().min(2).max(21).required(),
  description: Joi.string().min(1).max(500).required(),
  subredditIconUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);

const updateSubredditSchema = Joi.object({
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

module.exports = {
  searchSuggestionsSchema,
  searchPostsSchema,
  getSubredditsSchema,
  getSubredditSchema,
  postNewSubredditSchema,
  updateSubredditSchema,
};
