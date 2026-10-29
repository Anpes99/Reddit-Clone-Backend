const runtime = require("./utils/runtime");
const { connectToDatabase } = require("./utils/db");
const { connectRedis } = require("./utils/redis");
connectRedis();
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");

const app = express();

// Configure security headers before your routes.
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
        "img-src": ["'self'", "https:", "data:"],
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
const {
  generalRequestLimiter,
} = require("./utils/middleware/requestRateLimiters");

app.use(generalRequestLimiter);

app.use(express.static("build"));
app.use(express.json());
app.use(cookieParser());

const middleware = require("./utils/middleware/middleware");
const usersRouter = require("./controllers/users");
const authRouter = require("./controllers/auth");
const postsRouter = require("./controllers/posts");
const newsRouter = require("./controllers/news");
const commentRouter = require("./controllers/comments");
const subredditsRouter = require("./controllers/subreddits");
const utilsRouter = require("./controllers/utils");
const path = require("path");
const searchRouter = require("./controllers/search");
const loggedInUserRouter = require("./controllers/loggedInUser");
const verifyEmailRouter = require("./controllers/verifyEmail");

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

if (runtime.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}
app.use(middleware.errorHandler);
app.use(middleware.unknownEndpoint);

module.exports = app;
