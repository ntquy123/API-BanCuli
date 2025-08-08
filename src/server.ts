import cluster from 'cluster';
import dotenv from 'dotenv';
import initCluster from './cluster';
import createHttpServer from './httpServer';
import initWebSocketServer from './websocket/server';

// Load environment variables
dotenv.config();

// API port (5000)
const API_PORT = Number(process.env.API_PORT) || 5000;
// WebSocket port (5001)
const WS_PORT = Number(process.env.WS_PORT) || 5001;

if (cluster.isPrimary) {
  initCluster(API_PORT);
} else {
  const apiServer = createHttpServer();
  initWebSocketServer(apiServer, WS_PORT);

  process.on('message', (message, socket: any) => {
    if (message !== 'sticky-session:connection') return;
    apiServer.emit('connection', socket);
    socket.resume();
  });
}
