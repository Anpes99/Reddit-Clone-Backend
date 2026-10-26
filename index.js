const http = require("http");
const app = require("./app");
const runtime = require("./utils/runtime");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const postsSocket = require("./websockets/posts")(io);
const likesSocket = require("./websockets/likes")(io);
const {
  registerSubredditOnlineCountSocketHandlers,
  startSubredditOnlineCountBroadcast,
} = require("./websockets/onlineCount");
registerSubredditOnlineCountSocketHandlers(io);
startSubredditOnlineCountBroadcast(io);
const {
  startUpdateTopCommunitiesTask,
} = require("./jobs/update-top-communities-task");

const {
  User,
  Comment,
  Post,
  Subreddit,
  UserSubreddits,
} = require("./models/index");

startUpdateTopCommunitiesTask();

const PORT = runtime.PORT || 3001;
server.listen(runtime.PORT);
console.log("server running on port " + runtime.PORT);

module.exports = { io };
