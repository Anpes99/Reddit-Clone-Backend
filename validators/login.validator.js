import Joi from "joi";

export const loginSchema = Joi.object({
  username: Joi.string().min(1).max(25).required(),
  password: Joi.string().min(4).max(128).required(),
}).unknown(false);
