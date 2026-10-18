import Joi from "joi";

export const getLoggedInUserSchema = Joi.object({
  username: Joi.string().min(1).max(25).required(),
}).unknown(false);
