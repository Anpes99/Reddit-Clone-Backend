const Joi = require("joi");

const updateLoggedInUserSchema = Joi.object({
  introduction: Joi.string().min(1).max(500),
  userAvatarImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
  profilePageBackgroundImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
}).unknown(false);

module.exports = {
  updateLoggedInUserSchema,
};
