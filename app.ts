import "express-async-errors";
import path from "path";
import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import * as runtime from "./utils/runtime";
import { connectToDatabase } from "./utils/db";
import { connectRedis } from "./utils/redis";
import * as middleware from "./utils/middleware/middleware";
import { generalRequestLimiter } from "./utils/middleware/requestRateLimiters";
import usersRouter from "./controllers/users";
import authRouter from "./controllers/auth";
import postsRouter from "./controllers/posts";
import newsRouter from "./controllers/news";
import commentRouter from "./controllers/comments";
import subredditsRouter from "./controllers/subreddits";
import utilsRouter from "./controllers/utils";
import searchRouter from "./controllers/search";
import loggedInUserRouter from "./controllers/loggedInUser";
import verifyEmailRouter from "./controllers/verifyEmail";
import notificationsRouter from "./controllers/notifications";

connectRedis();
const app = express();

app.use(middleware.httpLogger);

app.use(
  helmet({
    // Prevent  site from being embedded in frames.
    xFrameOptions: {
      action: "deny",
    },

    // Enable HSTS in production only.
    strictTransportSecurity:
      runtime.NODE_ENV === "production"
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: false,
          }
        : false,

    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "default-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "img-src": ["'self'", "https:", "data:", "blob:"],
        "connect-src": ["'self'", "https://*.amazonaws.com"],
      },
    },
  }),
);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(generalRequestLimiter);

app.use(express.static("build"));
app.use(express.json());
app.use(cookieParser());

connectToDatabase();

app.use(middleware.tokenExtractor);
app.use(middleware.userExtractor);

if (runtime.NODE_ENV === "production") {
  app.use(middleware.csrfProtection);
}

app.use("/api/auth", authRouter);
app.use("/api/loggedInUser", loggedInUserRouter);
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentRouter);
app.use("/api/news", newsRouter);
app.use("/api/subreddits", subredditsRouter);
app.use("/api/utils", utilsRouter);
app.use("/api/search", searchRouter);
app.use("/api/verify-email", verifyEmailRouter);
app.use("/api/notifications", notificationsRouter);

if (runtime.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    // Relative to the working directory, like express.static("build") above
    res.sendFile(path.resolve("build", "index.html"));
  });
}
app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

export = app;
