const Joi = require("joi");
const { POSTS_ORDER_TYPE } = require("../constants/post.constant.js");

const searchSuggestionsSchema = Joi.object({
  searchWord: Joi.string().min(1).max(500),
}).unknown(false);

const searchPostsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0).default(0),
  limit: Joi.number().integer().min(1).max(100),
  orderType: Joi.string().valid(...Object.values(POSTS_ORDER_TYPE)),
  prevSearchWordEmbedding: Joi.string().max(10000),
}).unknown(false);

const searchSubredditsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
}).unknown(false);

module.exports = {
  searchSuggestionsSchema,
  searchPostsSchema,
  searchSubredditsSchema,
};
