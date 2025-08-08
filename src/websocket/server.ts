import http from 'http';
import WebSocket, { Server } from 'ws';

export const initWebSocketServer = (apiServer: http.Server, wsPort: number) => {
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
      } else if (data.type === 'get_online_players') {
        const onlineIds = Array.from(players.keys());
        ws.send(JSON.stringify({ type: 'online_players', playerIds: onlineIds }));
      } else if (data.type === 'invite') {
        if (!data.playerId) {
          ws.send(JSON.stringify({ type: 'error', message: 'playerId is required for invite' }));
          return;
        }
        const target = players.get(data.playerId);
        if (target) {
          target.send(
            JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' })
          );
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
              message:
                'senderId, receiverId, and bet are required for friend_challenge',
            })
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
            })
          );
          return;
        }

        if (senderId !== playerId) {
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'senderId does not match current player',
            })
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
            })
          );
        } else {
          ws.send(
            JSON.stringify({ type: 'error', message: 'Player is offline' })
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
