import express from 'express';
import playerRoutes from './routes/playerRoutes';
import roomRoutes from './routes/roomRoutes';
import itemRoutes from './routes/itemRoutes';
import gameRoutes from './routes/gameRoutes';
import languageRoutes from './routes/languageRoutes';
import effectPlayerRoutes from './routes/effectPlayerRoutes';
import playerItemRoutes from './routes/playerItemRoutes';
import ballPhysicsRoutes from './routes/ballPhysicsRoutes';
import achievementRoutes from './routes/achievementRoutes';
import historyRoutes from './routes/historyRoutes';
import drawRoutes from './routes/drawRoutes';
import marketRoutes from './routes/marketRoutes';
import accountRoutes from './routes/accountRoutes';
import friendRoutes from './routes/friendRoutes';
import WebSocket, { Server } from 'ws'; // Import WebSocket

const app = express();

// Middleware để parse body JSON
app.use(express.json());

// Các route API của bạn
app.use('/api', playerRoutes);
app.use('/api', roomRoutes);
app.use('/api', itemRoutes);
app.use('/api', gameRoutes);
app.use('/api', languageRoutes);
app.use('/api', effectPlayerRoutes);
app.use('/api', playerItemRoutes);
app.use('/api', ballPhysicsRoutes);
app.use('/api', achievementRoutes);
app.use('/api', historyRoutes);
app.use('/api', drawRoutes);
app.use('/api', marketRoutes);
app.use('/api', accountRoutes);
app.use('/api', friendRoutes);

// Khởi tạo WebSocket Server
const wss: Server = new WebSocket.Server({ noServer: true });

// Xử lý kết nối WebSocket
wss.on('connection', (ws: WebSocket) => {
  console.log('A new client connected via WebSocket!');

  ws.on('message', (message: string) => {
    console.log('Received: %s', message);

    let data: any;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }

    // Xử lý thông điệp từ client và phản hồi
    if (data.type === 'invite') {
      ws.send(JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' }));
    } else if (data.type === 'friend_invite') {
      ws.send(JSON.stringify({ type: 'friend_invite', message: 'You have a new friend invite!' }));
    } else if (data.type === 'friend_challenge') {
      const challengeMessage = { type: 'friend_challenge_response', message: 'Challenge received!' };
      ws.send(JSON.stringify(challengeMessage));
    }
  });

  // Gửi tin nhắn chào mừng khi kết nối thành công
  const welcomeMessage = { type: 'welcome', message: 'Welcome to the game server!' };
  ws.send(JSON.stringify(welcomeMessage));
});

// Kết nối WebSocket server với Express HTTP server
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});

// Xử lý yêu cầu WebSocket
server.on('upgrade', (request, socket, head) => {
  if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

export default app;
