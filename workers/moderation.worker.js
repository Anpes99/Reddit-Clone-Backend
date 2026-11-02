const { Worker } = require("bullmq");
const { bullConnection } = require("../utils/bullmq");
const { Post } = require("../models");
const logger = require("../utils/logger");
const { postModerationStatus } = require("../enums/post.enum");
const axios = require("axios");

const worker = new Worker(
  "image-moderation",

  async (job) => {
    const { postId, imageUrl } = job.data;

    const dbPost = await Post.findByPk(postId);
    if (!dbPost) {
      throw new Error("post not found");
    }

    const result = await axios.get(
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
      moderationStatus: postModerationStatus.COMPLETED,
    });

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
  if (job?.attemptsMade >= job?.opts?.attempts) {
    await Post.update(
      { moderationStatus: postModerationStatus.FAILED },
      { where: { id: job.data.postId } },
    );
  }
});
