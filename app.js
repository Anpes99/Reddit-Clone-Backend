const config = require("./utils/config");
const { connectToDatabase } = require("./utils/db");
const cors = require("cors");
const express = require("express");
const cookieParser = require("cookie-parser");
const app = express();
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  }),
);
app.use(express.static("build"));
app.use(express.json());
app.use(cookieParser());
const usersRouter = require("./controllers/users");
const authRouter = require("./controllers/auth");
const middleware = require("./utils/middleware");
const postsRouter = require("./controllers/posts");
const newsRouter = require("./controllers/news");
const commentRouter = require("./controllers/comments");
const subredditsRouter = require("./controllers/subreddits");
const utilsRouter = require("./controllers/utils");
const path = require("path");
const searchRouter = require("./controllers/search");
const loggedInUserRouter = require("./controllers/loggedInUser");

connectToDatabase();

app.use(middleware.tokenExtractor);
app.use(middleware.userExtractor);

app.use("/api/auth", authRouter);
app.use("/api/loggedInUser", loggedInUserRouter);
app.use("/api/users", usersRouter);
app.use("/api/posts", postsRouter);
app.use("/api/comments", commentRouter);
app.use("/api/news", newsRouter);
app.use("/api/subreddits", subredditsRouter);
app.use("/api/utils", utilsRouter);
app.use("/api/search", searchRouter);

if (config.NODE_ENV === "production") {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "build", "index.html"));
  });
}
app.use(middleware.errorHandler);
app.use(middleware.unknownEndpoint);

module.exports = app;
