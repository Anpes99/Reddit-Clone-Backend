import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../redis.js";
import { AppError } from "../../errors/index.js";

const tooManyRequestsError = (message: string) =>
  new AppError({
    status: 429,
    code: "TOO_MANY_REQUESTS",
    message: message,
    details: {},
  });

export const generalRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(tooManyRequestsError("Too many requests. Please try again later."));
  },
});

export const loginIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: "rl:login:ip:",
  }),

  handler: (req, res, next) => {
    next(
      tooManyRequestsError("Too many login attempts. Please try again later."),
    );
  },
});

export const signUpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: "rl:signup:ip:",
  }),

  handler: (req, res, next) => {
    next(
      tooManyRequestsError("Too many signup requests. Please try again later."),
    );
  },
});

export const signUpPerDayLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    prefix: "rl:signup-day:ip:",
  }),

  handler: (req, res, next) => {
    next(
      tooManyRequestsError("Too many signup requests. Please try again later."),
    );
  },
});

export const createPostRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  keyGenerator: (req) => `create-post:user:${req.user!.id}`,

  handler: (req, res, next) => {
    next(
      tooManyRequestsError(
        "Too many create post requests. Please try again later.",
      ),
    );
  },
});

export const createCommentRequestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  }),
  keyGenerator: (req) => `create-comment:user:${req.user!.id}`,

  handler: (req, res, next) => {
    next(
      tooManyRequestsError(
        "Too many create comment requests. Please try again later.",
      ),
    );
  },
});
