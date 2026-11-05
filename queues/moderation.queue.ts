import { Queue } from "bullmq";
import { bullConnection } from "../utils/bullmq";

export type ModerationJobData = {
  postId: number;
  imageUrl: string;
};

export type ModerationJobResult = {
  postId: number;
  safe: boolean;
};

export const moderationQueue = new Queue<
  ModerationJobData,
  ModerationJobResult,
  "moderate-image"
>("image-moderation", {
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
