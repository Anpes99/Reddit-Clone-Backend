import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",

  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
            singleLine: true,
          },
        }
      : undefined,
});

// `export =` keeps `require("./logger")` returning the logger for JS callers
export = logger;
