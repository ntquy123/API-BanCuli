import WebSocket from 'ws';

export type PlayerMap = Map<string, WebSocket>;

export interface HandlerContext {
  playerId: string | null;
  isPlayerOnline: (playerId: string) => boolean;
}

type MessageHandler = (
  ws: WebSocket,
  players: PlayerMap,
  data: any,
  context: HandlerContext
) => void;

export const handleRegister: MessageHandler = (ws, players, data, context) => {
  const { playerId } = data;
  if (!playerId) {
    ws.send(
      JSON.stringify({ type: 'error', message: 'playerId is required for register' })
    );
    return;
  }
  context.playerId = playerId;
  players.set(playerId, ws);
};

export const handleGetOnlinePlayers: MessageHandler = (ws, players) => {
  const onlineIds = Array.from(players.keys());
  ws.send(JSON.stringify({ type: 'online_players', playerIds: onlineIds }));
};

export const handleInvite: MessageHandler = (ws, players, data, context) => {
  const { playerId } = data;
  if (!playerId) {
    ws.send(
      JSON.stringify({ type: 'error', message: 'playerId is required for invite' })
    );
    return;
  }
  if (context.isPlayerOnline(playerId)) {
    const target = players.get(playerId);
    target?.send(
      JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' })
    );
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Player is offline' }));
  }
};

export const handleFriendChallenge: MessageHandler = (ws, players, data, context) => {
  const senderId = String(data.senderId);
  const receiverId = String(data.receiverId);
  const bet = data.bet;
  if (!senderId || !receiverId || typeof bet === 'undefined') {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'senderId, receiverId, and bet are required for friend_challenge',
      })
    );
    return;
  }

  if (context.isPlayerOnline(receiverId)) {
    const target = players.get(receiverId);
    target?.send(JSON.stringify({ type: 'friend_challenge', senderId, bet }));
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Player is offline' }));
  }
};

export const handleFriendChallengeResponse: MessageHandler = (
  ws,
  players,
  data,
  context
) => {
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
  if (senderId !== context.playerId) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'senderId does not match current player',
      })
    );
    return;
  }
  if (context.isPlayerOnline(receiverId)) {
    const target = players.get(receiverId);
    target?.send(
      JSON.stringify({
        type: 'friend_challenge_response',
        senderId,
        bet,
        accepted,
      })
    );
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Player is offline' }));
  }
};

const handlers: Record<string, MessageHandler> = {
  register: handleRegister,
  get_online_players: handleGetOnlinePlayers,
  invite: handleInvite,
  friend_challenge: handleFriendChallenge,
  friend_challenge_response: handleFriendChallengeResponse,
};

export const handleMessage = (
  ws: WebSocket,
  players: PlayerMap,
  data: any,
  context: HandlerContext
) => {
  const handler = handlers[data.type];
  if (handler) {
    handler(ws, players, data, context);
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
  }
};

export type { MessageHandler };

