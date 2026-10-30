const Joi = require("joi");

const verifyEmailSchema = Joi.object({
  token: Joi.string().length(64).hex().required(),
}).unknown(false);

const resendVerifyEmailEmailSchema = Joi.object({
  username: Joi.string()
    .trim()
    .min(1)
    .max(25)
    .regex(
      /^[A-Za-z0-9_-]+$/,
      "Username may contain letters, numbers, underscores and hyphens only",
    )
    .required(),
}).unknown(false);

module.exports = {
  verifyEmailSchema,
  resendVerifyEmailEmailSchema,
};
