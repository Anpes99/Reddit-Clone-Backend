import { Worker } from "bullmq";
import axios from "axios";
import { bullConnection } from "../utils/bullmq";
import { Post, UserNotifications } from "../models/index";
import logger from "../utils/logger";
import { POST_MODERATION_STATUS } from "../constants/post.constant";
import { USER_NOTIFICATION_TYPES } from "../constants/user.constant";
import type { ModerationJobData } from "../queues/moderation.queue";

type ModerationJobResult = {
  postId: number;
  safe: boolean;
};

type SightengineResponse = {
  status: string;
  error?: { message?: string };
  nudity?: {
    sexual_activity?: number;
    sexual_display?: number;
    raw?: number;
    erotica?: number;
    suggestive_classes?: { visibly_undressed?: number };
  };
  offensive?: {
    nazi?: number;
    supremacist?: number;
    terrorist?: number;
    confederate?: number;
  };
  gore?: { prob?: number };
  "self-harm"?: { prob?: number };
};

const worker = new Worker<ModerationJobData, ModerationJobResult>(
  "image-moderation",

  async (job) => {
    const { postId, imageUrl } = job.data;

    const dbPost = await Post.findByPk(postId);
    if (!dbPost) {
      throw new Error("post not found");
    }

    const result = await axios.get<SightengineResponse>(
      "https://api.sightengine.com/1.0/check.json",
      {
        params: {
          url: imageUrl,
          models: "nudity-2.1,offensive-2.0,gore-2.0,self-harm",
          api_user: process.env.SIGHTENGINE_API_USER,
          api_secret: process.env.SIGHTENGINE_API_SECRET,
        },
        timeout: 30000,
      },
    );

    const data = result.data;

    if (data.status !== "success") {
      throw new Error(data.error?.message || "Sightengine moderation failed");
    }

    const nudity = data.nudity ?? {};
    const suggestive = nudity.suggestive_classes ?? {};
    const offensive = data.offensive ?? {};
    const gore = data.gore ?? {};
    const selfHarm = data["self-harm"] ?? {};

    const THRESHOLD = 0.8;

    const isNudity =
      (nudity.sexual_activity ?? 0) >= THRESHOLD ||
      (nudity.sexual_display ?? 0) >= THRESHOLD ||
      (nudity.raw ?? 0) >= THRESHOLD ||
      (nudity.erotica ?? 0) >= THRESHOLD ||
      (suggestive.visibly_undressed ?? 0) >= THRESHOLD;

    const isOffensive =
      (offensive.nazi ?? 0) >= THRESHOLD ||
      (offensive.supremacist ?? 0) >= THRESHOLD ||
      (offensive.terrorist ?? 0) >= THRESHOLD ||
      (offensive.confederate ?? 0) >= THRESHOLD;

    const isGore = (gore.prob ?? 0) >= THRESHOLD;

    const isSelfHarm = (selfHarm.prob ?? 0) >= THRESHOLD;

    const flagged = isNudity || isOffensive || isGore || isSelfHarm;

    await dbPost.update({
      safe: !flagged,
      moderationStatus: POST_MODERATION_STATUS.COMPLETED,
    });

    if (flagged) {
      await UserNotifications.create({
        userId: dbPost.userId,
        type: USER_NOTIFICATION_TYPES.POST_REJECTED,
        title: "Your post was rejected",
        message:
          "We've detected potentially unsafe or rule-breaking content in your post. It wasn't published. Please review our community guidelines.",
      });
    } else {
      await UserNotifications.create({
        userId: dbPost.userId,
        type: USER_NOTIFICATION_TYPES.POST_APPROVED,
        title: "Your post has been approved",
        message: "Your post passed our moderation checks and is now published.",
      });
    }

    return {
      postId,
      safe: !flagged,
    };
  },

  {
    connection: bullConnection,
    concurrency: 5,
  },
);

worker.on("failed", async (job, err) => {
  logger.error({ err }, `Moderation failed: ${job?.id}`);
  const attempts = job?.opts.attempts;
  if (job && attempts !== undefined && job.attemptsMade >= attempts) {
    await Post.update(
      { moderationStatus: POST_MODERATION_STATUS.FAILED },
      { where: { id: job.data.postId } },
    );
  }
});
