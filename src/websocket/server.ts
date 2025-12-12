import http from 'http';
import WebSocket, { Server } from 'ws';
import { handleMessage, HandlerContext } from './handlers';

export const initWebSocketServer = (apiServer: http.Server, wsPort: number) => {
  const wss: Server = new WebSocket.Server({ noServer: true });
  const players = new Map<number, WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('A new WebSocket client connected!');

    const context: HandlerContext = {
      playerId: null
    };

    ws.on('message', (message: WebSocket.RawData) => {
      const payload = typeof message === 'string' ? message : message.toString();
      console.log('Received: %s', payload);
      let data: any;
      try {
        data = JSON.parse(payload);
      } catch (e) {
        console.error('Error parsing message:', e);
        return;
      }

      handleMessage(ws, players, data, context).catch((error) => {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
      });
    });

    ws.on('close', () => {
      if (context.playerId) players.delete(context.playerId);
    });

    const welcomeMessage = { type: 'welcome', message: 'Welcome to the game server!' };
    ws.send(JSON.stringify(welcomeMessage));
  });

  apiServer.on('upgrade', (request, socket, head) => {
    if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  const wsServer = http.createServer();
  wsServer.listen(wsPort, () => {
    console.log(`WebSocket server running on port ${wsPort}`);
  });

  wsServer.on('upgrade', (request, socket, head) => {
    if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
};

export default initWebSocketServer;
