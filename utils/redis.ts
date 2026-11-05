import { createClient } from "redis";
import logger from "./logger";

export const redisClient = createClient({ url: process.env.REDIS_URI });

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis Client Error");
});

// Shared by every caller so the client only connects once
let connectPromise: Promise<void> | undefined;

export const connectRedis = () => {
  if (connectPromise === undefined) {
    connectPromise = redisClient.connect().then(() => {
      logger.info("Redis connected successfully");
    });
  }
  return connectPromise;
};
