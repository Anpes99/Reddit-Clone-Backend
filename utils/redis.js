const { createClient } = require("redis");

const redisClient = createClient({ url: process.env.REDIS_URI });

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected successfully");
  }
};

module.exports = { redisClient, connectRedis };
