import { Redis } from "ioredis";

export const bullConnection = new Redis(process.env.REDIS_URI as string, {
  maxRetriesPerRequest: null,
});
