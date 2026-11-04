import Joi from "joi";

export type UpdateLoggedInUserBody = {
  introduction?: string;
  userAvatarImageUrl?: string | null;
  profilePageBackgroundImageUrl?: string | null;
};

export const updateLoggedInUserSchema = Joi.object<UpdateLoggedInUserBody>({
  introduction: Joi.string().min(1).max(500),
  userAvatarImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
  profilePageBackgroundImageUrl: Joi.string()
    .uri({ scheme: ["https", "http"] })
    .max(2048)
    .allow(null, ""),
})
  .min(1)
  .unknown(false);
