const Joi = require("joi");

const postNewPostCommentSchema = Joi.object({
  text: Joi.string().min(1).max(10000).required(),
  directReplyToPost: Joi.boolean().required(),
  commentId: Joi.number().integer(),
  subredditId: Joi.number().integer().required(),
  postId: Joi.number().integer().required(),
}).unknown(false);

module.exports = {
  postNewPostCommentSchema,
};
