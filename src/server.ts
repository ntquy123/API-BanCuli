import dotenv from 'dotenv';
import app from './app';
import WebSocket, { Server } from 'ws';

// Load biến môi trường từ file .env
dotenv.config();  

// Khởi tạo WebSocket server
const wss: Server = new WebSocket.Server({ noServer: true });

// Lắng nghe kết nối WebSocket và xử lý các sự kiện
wss.on('connection', (ws: WebSocket) => {
  console.log('A new client connected!');

  ws.on('message', (message: string) => {
    console.log('Received: %s', message);

    // Giải mã và xử lý các thông điệp từ client
    let data: any;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('Error parsing message:', e);
      return;
    }

    // Xử lý thông điệp từ client (ví dụ: thông báo mời, thách đấu, v.v.)
    if (data.type === 'invite') {
      ws.send(JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' }));
    } else if (data.type === 'friend_challenge') {
      const challengeMessage = { type: 'friend_challenge_response', message: 'Challenge received!' };
      ws.send(JSON.stringify(challengeMessage));
    }
  });

  // Gửi tin nhắn chào mừng đến client khi kết nối
  const welcomeMessage = { type: 'welcome', message: 'Welcome to the game server!' };
  ws.send(JSON.stringify(welcomeMessage));
});

// Lắng nghe API requests từ Express
const server = app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});

// Kết hợp WebSocket server với Express server
server.on('upgrade', (request, socket, head) => {
  // Kiểm tra xem yêu cầu có phải là WebSocket không
  if (request.headers['upgrade'] !== 'websocket') return socket.destroy();

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
