import cluster, { Worker } from 'cluster';
import os from 'os';
import net from 'net';
import http from 'http';
import dotenv from 'dotenv';
import app from './app'; // Express app
import WebSocket, { Server } from 'ws';

// Load environment variables
dotenv.config();

// API port (5000)
const API_PORT = Number(process.env.API_PORT) || 5000;
// WebSocket port (5001)
const WS_PORT = Number(process.env.WS_PORT) || 5001;

const getWorkerIndex = (ip: string, length: number): number => {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % length;
};

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  const workers: Worker[] = [];

  for (let i = 0; i < numCPUs; i++) {
    workers[i] = cluster.fork();
  }

  // Respawn workers on exit.
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} exited. Spawning a new process.`);
    const index = workers.indexOf(worker);
    workers[index] = cluster.fork();
  });

  // Master server accepts connections and dispatches them to workers.
  const server = net.createServer({ pauseOnConnect: true }, (socket) => {
    const ip = socket.remoteAddress || '';
    const worker = workers[getWorkerIndex(ip, workers.length)];
    worker.send('sticky-session:connection', socket);
  });

  server.listen(API_PORT, () => {
    console.log(`Master listening on API port ${API_PORT}`);
  });
} else {
  // Worker process: set up Express and WebSocket servers.

  // Set up API server (HTTP)  // Chỉ tạo server mà KHÔNG lắng nghe trên cổng 5000
  const apiServer = http.createServer(app); // Express app listens on API_PORT

  // Set up WebSocket server
  const wss: Server = new WebSocket.Server({ noServer: true });

  const players = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('A new WebSocket client connected!');

    let playerId: string | null = null;

    ws.on('message', (message: string) => {
      console.log('Received: %s', message);
      let data: any;
      try {
        data = JSON.parse(message);
      } catch (e) {
        console.error('Error parsing message:', e);
        return;
      }

      if (data.type === 'register') {
        playerId = data.playerId;
        players.set(playerId, ws);
      } 
      else if (data.type === 'get_online_players') {
        const onlineIds = Array.from(players.keys());
        ws.send(JSON.stringify({ type: 'online_players', playerIds: onlineIds }));
    }
      else if (data.type === 'invite') {
        if (!data.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'playerId is required for invite' }));
          return;
        }
        const target = players.get(data.playerId);
        if (target) {
          target.send(JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' }));
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Player is offline' }));
        }
      } else if (data.type === 'friend_challenge') {
          const senderId = String(data.senderId);
          const receiverId = String(data.receiverId);
          const bet = data.bet;
        if (!senderId || !receiverId || typeof bet === 'undefined') {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'senderId, receiverId, and bet are required for friend_challenge',
            }),
          );
          return;
        }

        const target = players.get(receiverId);
        if (target) {
          target.send(
            JSON.stringify({ type: 'friend_challenge', senderId, bet })
          );
        } else {
          ws.send(
            JSON.stringify({ type: 'error', message: 'Player is offline' })
          );
        }
      } else if (data.type === 'friend_challenge_response') {
        const { senderId, receiverId, bet, accepted } = data;

        if (
          !senderId ||
          !receiverId ||
          typeof bet === 'undefined' ||
          typeof accepted === 'undefined'
        ) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message:
                'senderId, receiverId, bet, and accepted are required for friend_challenge_response',
            }),
          );
          return;
        }

        if (senderId !== playerId) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'senderId does not match current player',
            }),
          );
          return;
        }

        const target = players.get(receiverId);
        if (target) {
          target.send(
            JSON.stringify({
              type: 'friend_challenge_response',
              senderId,
              bet,
              accepted,
            }),
          );
        } else {
          ws.send(
            JSON.stringify({ type: 'error', message: 'Player is offline' }),
          );
        }
      }
    });

    ws.on('close', () => {
      if (playerId) players.delete(playerId);
    });

    const welcomeMessage = { type: 'welcome', message: 'Welcome to the game server!' };
    ws.send(JSON.stringify(welcomeMessage));
  });

  // Upgrade HTTP requests to WebSocket when appropriate
  apiServer.on('upgrade', (request, socket, head) => {
    if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Server for WebSocket running on port 5001
  const wsServer = http.createServer();
  wsServer.listen(WS_PORT, () => {
    console.log(`WebSocket server running on port ${WS_PORT}`);
  });

  // Handle WebSocket connections on the new port
  wsServer.on('upgrade', (request, socket, head) => {
    if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  process.on('message', (message, socket: any) => {
    if (message !== 'sticky-session:connection') return;
    apiServer.emit('connection', socket);
    socket.resume();
  });
}
