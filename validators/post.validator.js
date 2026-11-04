const Joi = require("joi");
const { COMMENTS_SORT_BY } = require("../constants/post.constant.js");
const { SORT_ORDER } = require("../constants/sort-order.constant.js");

const getPostSchema = Joi.object({
  order: Joi.string().valid(SORT_ORDER.ASC, SORT_ORDER.DESC),
  sortBy: Joi.string()
    .valid(...Object.values(COMMENTS_SORT_BY))
    .optional(),
}).unknown(false);

const postNewPostSchema = Joi.object({
  title: Joi.string().min(1).max(300).required(),
  text: Joi.string().min(1).max(40000),
  imageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(4096),
  subredditName: Joi.string().min(1).max(25).required(),
}).unknown(false);

module.exports = {
  getPostSchema,
  postNewPostSchema,
};
