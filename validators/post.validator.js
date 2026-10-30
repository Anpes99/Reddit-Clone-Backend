const Joi = require("joi");
const { commentsSortBy } = require("../enums/post.enum.js");
const { SortOrder } = require("../enums/sort-order.enum.js");

const getPostSchema = Joi.object({
  order: Joi.string().valid(SortOrder.ASC, SortOrder.DESC),
  sortBy: Joi.string()
    .valid(...Object.values(commentsSortBy))
    .optional(),
}).unknown(false);

const postNewPostSchema = Joi.object({
  title: Joi.string().min(1).max(300).required(),
  text: Joi.string().min(1).max(40000),
  imageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(4096),
  subredditName: Joi.string().min(1).max(25),
}).unknown(false);

module.exports = {
  getPostSchema,
  postNewPostSchema,
};
