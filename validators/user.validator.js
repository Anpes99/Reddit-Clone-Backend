const Joi = require("joi");
const {
  USER_PAGE_CONTENT_SORT_BY_TYPES,
  USER_PAGE_CONTENT_TYPES,
} = require("../enums/user.enum.js");

const postNewUserSchema = Joi.object({
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

const getUserPostsAndCommentsFeedSchema = Joi.object({
  offset: Joi.number().integer().default(0),
  contentType: Joi.string()
    .valid(...Object.values(USER_PAGE_CONTENT_TYPES))
    .required(),
  sortByType: Joi.string().valid(
    ...Object.values(USER_PAGE_CONTENT_SORT_BY_TYPES),
  ),
  getTotalCount: Joi.boolean().default(false),
}).unknown(false);

const forgottenPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
}).unknown(false);

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(4).max(128).required(),
  passwordResetToken: Joi.string().length(64).hex().required(),
}).unknown(false);

module.exports = {
  postNewUserSchema,
  getUserPostsAndCommentsFeedSchema,
  forgottenPasswordSchema,
  resetPasswordSchema,
};
