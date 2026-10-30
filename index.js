const http = require("http");
const app = require("./app");
const runtime = require("./utils/runtime");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
require("./websockets/posts")(io);
require("./websockets/likes")(io);
const {
  registerSubredditOnlineCountSocketHandlers,
  startSubredditOnlineCountBroadcast,
} = require("./websockets/onlineCount");
registerSubredditOnlineCountSocketHandlers(io);
startSubredditOnlineCountBroadcast(io);
const {
  startUpdateTopCommunitiesTask,
} = require("./jobs/update-top-communities-task");

startUpdateTopCommunitiesTask();

const PORT = runtime.PORT || 3001;
server.listen(PORT);
console.log("server running on port " + PORT);

module.exports = { io };
