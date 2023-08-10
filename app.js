const config = require("./utils/config");
const { connectToDatabase } = require("./utils/db");
const cors = require("cors");
const express = require("express");
const app = express();
app.use(cors());
app.use(express.static("build"));
app.use(express.json());
const usersRouter = require("./controllers/users");
const loginRouter = require("./controllers/login");
const middleware = require("./utils/middleware");
const postsRouter = require("./controllers/posts");
const newsRouter = require("./controllers/news");
const commentRouter = require("./controllers/comments");
const subredditsRouter = require("./controllers/subreddits");
const utilsRouter = require("./controllers/utils");
const path = require("path");
const searchRouter = require("./controllers/search");

connectToDatabase();

app.use(middleware.tokenExtractor);
app.use(middleware.userExtractor);

app.use("/api/login", loginRouter);
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

app.use(middleware.unknownEndpoint);

module.exports = app;
