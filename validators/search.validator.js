import Joi from "joi";
import { postsOrderType } from "../enums/post.enum.js";

export const searchSuggestionsSchema = Joi.object({
  searchWord: Joi.string().min(1).max(500),
}).unknown(false);

export const searchPostsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
  orderType: Joi.string().valid(...Object.values(postsOrderType)),
}).unknown(false);

export const searchSubredditsSchema = Joi.object({
  searchQuery: Joi.string().min(1).max(500),
  offset: Joi.number().integer().min(0),
  limit: Joi.number().integer().min(1).max(100),
}).unknown(false);
