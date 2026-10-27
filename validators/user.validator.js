import Joi from "joi";
import {
  USER_PAGE_CONTENT_SORT_BY_TYPES,
  USER_PAGE_CONTENT_TYPES,
} from "../enums/user.enum.js";

export const postNewUserSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(1)
    .max(25)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username may contain letters, numbers, underscores and hyphens only",
    )
    .required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(4).max(128).required(),
}).unknown(false);

export const getUserPostsAndCommentsFeedSchema = Joi.object({
  offset: Joi.number().integer().default(0),
  contentType: Joi.string()
    .valid(...Object.values(USER_PAGE_CONTENT_TYPES))
    .required(),
  sortByType: Joi.string().valid(
    ...Object.values(USER_PAGE_CONTENT_SORT_BY_TYPES),
  ),
  getTotalCount: Joi.boolean().default(false),
}).unknown(false);

export const forgottenPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(false);

export const resetPasswordSchema = Joi.object({
  password: Joi.string().min(4).max(128).required(),
  passwordResetToken: Joi.string().length(64).hex().required(),
}).unknown(false);
