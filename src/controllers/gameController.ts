import { Request, Response } from 'express';
import { createHistory } from '../services/historyService';
import { updatePlayerStats } from '../services/playerService';
import { processBetTransactions } from '../services/gameService';

export const deductBetOnGameStart = async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ message: 'Request body must be an array' });
      return;
    }

    const transactions = req.body
      .map((entry) => ({
        userId: Number(entry.userId ?? entry.playerId),
        ringBall: Number(entry.ringBall ?? entry.bet ?? entry.marbBet),
        money: entry.money !== undefined ? Number(entry.money) : 0,
        description: typeof entry.description === 'string' ? entry.description : undefined,
        eventType: typeof entry.eventType === 'string' ? entry.eventType : undefined,
      }))
      .filter((entry) => Number.isFinite(entry.userId) && Number.isFinite(entry.ringBall));

    if (!transactions.length) {
      res.status(400).json({ message: 'No valid transactions provided' });
      return;
    }

    const histories = await processBetTransactions(transactions);

    res.json({ message: 'Bet deductions recorded', histories });
  } catch (error: any) {
    const errorMessage = error?.message ?? 'Failed to deduct bets';
    let statusCode = 500;

    if (errorMessage.toLowerCase().includes('not found')) {
      statusCode = 404;
    } else if (errorMessage.includes('Not enough RingBall') || errorMessage.includes('must be a positive')) {
      statusCode = 400;
    }

    res.status(statusCode).json({ message: errorMessage });
  }
};

export const overGame = async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ message: 'Request body must be an array' });
      return;
    }
    const generateTransno = (): bigint => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const second = String(now.getSeconds()).padStart(2, '0');
      const milli = String(now.getMilliseconds()).padStart(3, '0');
      return BigInt(`${year}${month}${day}${hour}${minute}${second}${milli}`);
    };
    const transno = generateTransno();
    for (const entry of req.body) {
      const {
        playerId,
        turnOrder,
        typeMatchGid,
        StatusWin,
        rounds,
        MapGame,
        MaxPlayer,
        marbBet,
        marblesWon,
        marblesLost,
        expGained,
        description,
      } = entry;

      if (typeof playerId !== 'number') {
        continue;
      }

      const exp = typeof expGained === 'number' ? expGained : 0;
      const marblesActual = marblesWon > 0 ? marblesWon : -marblesLost;
      const rankPoints = StatusWin === 1 ? Math.abs(marblesActual) : -Math.abs(marblesActual);
      await updatePlayerStats(playerId, exp, marblesActual);

      await createHistory({
        playerId,
        transno,
        turnOrder,
        typeMatchGid,
        statusWin: StatusWin,
        mapGame: MapGame,
        maxPlayer: MaxPlayer,
        rounds,
        marbBet,
        marblesWon,
        marblesLost,
        expGained: exp,
        rankPoints,
        description,
      });
    }

    res.json({ message: 'Game results recorded' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
