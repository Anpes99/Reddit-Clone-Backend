const IORedis = require("ioredis");

const bullConnection = new IORedis(process.env.REDIS_URI, {
  maxRetriesPerRequest: null,
});

module.exports = { bullConnection };
