import { createClient } from "redis";
import logger from "./logger";

export const redisClient = createClient({ url: process.env.REDIS_URI });

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis Client Error");
});

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    logger.info("Redis connected successfully");
  }
};
