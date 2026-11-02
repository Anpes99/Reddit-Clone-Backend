const { Queue } = require("bullmq");
const { bullConnection } = require("../utils/bullmq");

const moderationQueue = new Queue("image-moderation", {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

module.exports = { moderationQueue };
