const { createClient } = require("redis");
const logger = require("./logger");

const redisClient = createClient({ url: process.env.REDIS_URI });

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis Client Error");
});

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    logger.info("Redis connected successfully");
  }
};

module.exports = { redisClient, connectRedis };
