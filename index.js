const http = require("http");
const app = require("./app");
const config = require("./utils/config");

const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const postsSocket = require("./websockets/posts")(io);
const likesSocket = require("./websockets/likes")(io);

const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("./models/index");

const PORT = config.PORT || 3001;
server.listen(config.PORT);
console.log("server running on port " + config.PORT);

module.exports = { io };
