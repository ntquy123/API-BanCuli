import { RequestHandler } from 'express';

type QueueJoinBody = {
  userId?: number;
  bet?: number;
  region?: string;
  typeMatchGid?: number;
};

type MatchReadyBody = {
  matchId?: string;
  sessionName?: string;
  region?: string;
};

type MatchResultBody = {
  matchId?: string;
  result?: unknown;
};

export const joinQueue: RequestHandler = async (req, res) => {
  const { userId, bet, region, typeMatchGid } = req.body as QueueJoinBody;

  if (!userId) {
    res.status(400).json({ error: 'userId là bắt buộc' });
    return;
  }

  res.status(202).json({
    status: 'QUEUED',
    message: 'Đã nhận yêu cầu vào hàng chờ ghép trận',
    payload: {
      userId,
      bet: bet ?? null,
      region: region ?? null,
      typeMatchGid: typeMatchGid ?? null,
    },
  });
};

export const matchReady: RequestHandler = async (req, res) => {
  const { matchId, sessionName, region } = req.body as MatchReadyBody;

  if (!matchId || !sessionName || !region) {
    res.status(400).json({ error: 'matchId, sessionName, region là bắt buộc' });
    return;
  }

  res.json({
    status: 'READY_RECEIVED',
    matchId,
    sessionName,
    region,
  });
};

export const matchResult: RequestHandler = async (req, res) => {
  const { matchId, result } = req.body as MatchResultBody;

  if (!matchId) {
    res.status(400).json({ error: 'matchId là bắt buộc' });
    return;
  }

  res.json({
    status: 'RESULT_RECEIVED',
    matchId,
    result: result ?? null,
  });
};
