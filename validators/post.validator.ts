import Joi from "joi";
import {
  COMMENTS_SORT_BY,
  type CommentsSortBy,
} from "../constants/post.constant.js";
import {
  SORT_ORDER,
  type SortOrder,
} from "../constants/sort-order.constant.js";

export type GetPostQuery = {
  order?: SortOrder;
  sortBy?: CommentsSortBy;
};

export const getPostSchema = Joi.object<GetPostQuery>({
  order: Joi.string().valid(SORT_ORDER.ASC, SORT_ORDER.DESC),
  sortBy: Joi.string()
    .valid(...Object.values(COMMENTS_SORT_BY))
    .optional(),
}).unknown(false);

export type PostNewPostBody = {
  title: string;
  text?: string;
  imageUrl?: string;
  subredditName: string;
};

export const postNewPostSchema = Joi.object<PostNewPostBody>({
  title: Joi.string().min(1).max(300).required(),
  text: Joi.string().min(1).max(40000),
  imageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(4096),
  subredditName: Joi.string().min(1).max(25).required(),
}).unknown(false);

export type UpdatePostBody = {
  text: string;
};

export const updatePostSchema = Joi.object<UpdatePostBody>({
  text: Joi.string().min(1).max(40000).required(),
}).unknown(false);
