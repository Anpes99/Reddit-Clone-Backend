import Joi from "joi";
import {
  USER_PAGE_CONTENT_SORT_BY_TYPES,
  USER_PAGE_CONTENT_TYPES,
  type UserPageContentSortByType,
  type UserPageContentType,
} from "../constants/user.constant.js";

export type PostNewUserBody = {
  username: string;
  email: string;
  password: string;
};

export const postNewUserSchema = Joi.object<PostNewUserBody>({
  username: Joi.string()
    .trim()
    .min(2)
    .max(25)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username may contain letters, numbers, underscores and hyphens only",
    )
    .required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(4).max(128).required(),
}).unknown(false);

export type GetUserPostsAndCommentsFeedQuery = {
  offset: number;
  contentType: UserPageContentType;
  sortByType?: UserPageContentSortByType;
  getTotalCount: boolean;
};

export const getUserPostsAndCommentsFeedSchema =
  Joi.object<GetUserPostsAndCommentsFeedQuery>({
    offset: Joi.number().integer().default(0),
    contentType: Joi.string()
      .valid(...Object.values(USER_PAGE_CONTENT_TYPES))
      .required(),
    sortByType: Joi.string().valid(
      ...Object.values(USER_PAGE_CONTENT_SORT_BY_TYPES),
    ),
    getTotalCount: Joi.boolean().default(false),
  }).unknown(false);

export type ForgottenPasswordBody = {
  email: string;
};

export const forgottenPasswordSchema = Joi.object<ForgottenPasswordBody>({
  email: Joi.string().trim().lowercase().email().required(),
}).unknown(false);

export type ResetPasswordBody = {
  password: string;
  passwordResetToken: string;
};

export const resetPasswordSchema = Joi.object<ResetPasswordBody>({
  password: Joi.string().min(4).max(128).required(),
  passwordResetToken: Joi.string().length(64).hex().required(),
}).unknown(false);
