import Joi from "joi";

export type PostNewPostCommentBody = {
  text: string;
  directReplyToPost: boolean;
  commentId?: number;
  subredditId: number;
  postId: number;
};

export const postNewPostCommentSchema = Joi.object<PostNewPostCommentBody>({
  text: Joi.string().min(1).max(10000).required(),
  directReplyToPost: Joi.boolean().required(),
  commentId: Joi.number().integer(),
  subredditId: Joi.number().integer().required(),
  postId: Joi.number().integer().required(),
}).unknown(false);
