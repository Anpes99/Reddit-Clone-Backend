import Joi from "joi";

export const getLoggedInUserSchema = Joi.object({
  username: Joi.string().min(1).max(25).required(),
}).unknown(false);

export const updateLoggedInUserSchema = Joi.object({
  introduction: Joi.string().min(1).max(500),
  userAvatarImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);
