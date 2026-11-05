import http from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app";
import * as runtime from "./utils/runtime";
import logger from "./utils/logger";
import registerPostSocketHandlers from "./websockets/posts";
import registerLikeSocketHandlers from "./websockets/likes";
import {
  registerSubredditOnlineCountSocketHandlers,
  startSubredditOnlineCountBroadcast,
} from "./websockets/onlineCount";
import { startUpdateTopCommunitiesTask } from "./jobs/update-top-communities-task";
import "./workers/moderation.worker";
import type { AppServer, SocketUser } from "./websockets/types";

const server = http.createServer(app);
const io: AppServer = new Server(server);

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  try {
    const decoded = jwt.verify(token, process.env.SECRET as string);
    socket.data.user = decoded as SocketUser;
    next();
  } catch {
    socket.data.user = null;
    next();
  }
});

registerPostSocketHandlers(io);
registerLikeSocketHandlers(io);
registerSubredditOnlineCountSocketHandlers(io);
startSubredditOnlineCountBroadcast(io);

startUpdateTopCommunitiesTask();

const startServer = () => {
  const PORT = runtime.PORT || 3001;
  server.listen(PORT);
  logger.info("server running on port " + PORT);
};

startServer();

export { io };
