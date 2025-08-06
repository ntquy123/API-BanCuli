import cluster, { Worker } from 'cluster';
import os from 'os';
import net from 'net';
import http from 'http';
import dotenv from 'dotenv';
import app from './app';
import WebSocket, { Server } from 'ws';

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 5000;

/**
 * Simple hash function to consistently select a worker based on IP.
 */
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

  // Fork workers.
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

  server.listen(PORT, () => {
    console.log(`Master listening on port ${PORT}`);
  });
} else {
  // Worker process: set up Express and WebSocket servers.
  const server = http.createServer(app);
  const wss: Server = new WebSocket.Server({ noServer: true });

  // Handle WebSocket connections.
  wss.on('connection', (ws: WebSocket) => {
    console.log('A new client connected!');

    ws.on('message', (message: string) => {
      console.log('Received: %s', message);

      // Parse and handle incoming messages from client
      let data: any;
      try {
        data = JSON.parse(message);
      } catch (e) {
        console.error('Error parsing message:', e);
        return;
      }

      if (data.type === 'invite') {
        ws.send(
          JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' })
        );
      } else if (data.type === 'friend_challenge') {
        const challengeMessage = {
          type: 'friend_challenge_response',
          message: 'Challenge received!',
        };
        ws.send(JSON.stringify(challengeMessage));
      }
    });

    const welcomeMessage = { type: 'welcome', message: 'Welcome to the game server!' };
    ws.send(JSON.stringify(welcomeMessage));
  });

  // Upgrade HTTP requests to WebSocket when appropriate.
  server.on('upgrade', (request, socket, head) => {
    if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Receive connections from the master process.
  process.on('message', (message, socket: any) => {
    if (message !== 'sticky-session:connection') return;
    server.emit('connection', socket);
    socket.resume();
  });

  server.listen(0, () => {
    console.log(`Worker ${process.pid} ready`);
  });
}

