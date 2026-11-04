import Joi from "joi";
import {
  SORT_ORDER,
  type SortOrder,
} from "../constants/sort-order.constant.js";
import {
  SUBREDDIT_ORDER_BY_TYPES,
  type SubredditOrderByType,
} from "../constants/subreddit.constant.js";


export type GetSubredditsQuery = {
  limit?: number;
  order?: SortOrder;
  sortBy?: SubredditOrderByType;
};

export const getSubredditsSchema = Joi.object<GetSubredditsQuery>({
  limit: Joi.number().integer().min(1).max(100),
  order: Joi.string().valid(SORT_ORDER.ASC, SORT_ORDER.DESC),
  sortBy: Joi.string().valid(...Object.values(SUBREDDIT_ORDER_BY_TYPES)),
}).unknown(false);

export type GetSubredditParams = {
  name: string;
};

export const getSubredditSchema = Joi.object<GetSubredditParams>({
  name: Joi.string().required(),
}).unknown(false);

export type PostNewSubredditBody = {
  communityName: string;
  description: string;
  subredditIconUrl?: string | null;
};

export const postNewSubredditSchema = Joi.object<PostNewSubredditBody>({
  communityName: Joi.string().min(2).max(21).required(),
  description: Joi.string().min(1).max(500).required(),
  subredditIconUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);

export type UpdateSubredditBody = {
  description?: string;
  subredditIconUrl?: string | null;
  subredditPageBackgroundImageUrl?: string | null;
};

export const updateSubredditSchema = Joi.object<UpdateSubredditBody>({
  description: Joi.string().min(1).max(500),
  subredditIconUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
  subredditPageBackgroundImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).min(1).unknown(false);
