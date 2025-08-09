import WebSocket from 'ws';

export type PlayerMap = Map<number, WebSocket>;

export interface HandlerContext {
  playerId: number | null;
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
  const id = Number(playerId);
  context.playerId = id;
  players.set(id, ws); 
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
    const target = players.get(playerId);
    target?.send(
      JSON.stringify({ type: 'invite', message: 'You have a new friend invite!' })
    );
  
};

 export const handleFriendChallenge: MessageHandler = (ws, players, data, context) => {
  const senderId = Number(data.senderId);
  const receiverId = Number(data.receiverId);
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
  const target = players.get(receiverId);
  if (target) {
    target.send(JSON.stringify({ type: 'friend_challenge', senderId, bet }));
    ws.send(
      JSON.stringify({
        type: 'friend_challenge_ack',
        message: 'Challenge sent successfully',
        receiverId,
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'Target player is offline or not found',
      })
    );
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

    const target = players.get(receiverId);
    if (!target) {
      ws.send(JSON.stringify({ type: 'error', message: 'Target player not found' }));
      return;
    }
    target.send(
      JSON.stringify({
        type: 'friend_challenge_response_fromSocket',
        senderId,
        receiverId,
        bet,
        accepted,
      })
    );
 
};
export const handleCheckPlayerOnline: MessageHandler = (ws, players, data) => {
  const { playerId } = data;
  if (typeof playerId === 'undefined') {
    ws.send(JSON.stringify({ type: 'error', message: 'playerId is required for check_player_online' }));
    return;
  }
  const isOnline = players.has(playerId);
  ws.send(JSON.stringify({ type: 'check_player_online', playerId, isOnline }));
};
const handlers: Record<string, MessageHandler> = {
  register: handleRegister,
  get_online_players: handleGetOnlinePlayers,
  invite: handleInvite,
  friend_challenge: handleFriendChallenge,
  friend_challenge_response: handleFriendChallengeResponse,
  check_player_online: handleCheckPlayerOnline, 
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

