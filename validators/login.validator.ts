import Joi from "joi";

export type LoginBody = {
  username: string;
  password: string;
};

export const loginSchema = Joi.object<LoginBody>({
  username: Joi.string().min(1).max(25).required(),
  password: Joi.string().min(4).max(128).required(),
}).unknown(false);
