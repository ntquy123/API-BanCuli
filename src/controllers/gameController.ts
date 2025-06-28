import { Request, Response } from 'express';
import { createHistory } from '../services/historyService';
import { updatePlayerStats } from '../services/playerService';

export const overGame = async (req: Request, res: Response) => {
  try {
    if (!Array.isArray(req.body)) {
      res.status(400).json({ message: 'Request body must be an array' });
      return;
    }
const generateTransno = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const milli = String(now.getMilliseconds()).padStart(3, '0');
  return Number(`${year}${month}${day}${hour}${minute}${second}${milli}`);
};
    for (const entry of req.body) {
      const {
        playerId,
        tunrOrder,
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
      await updatePlayerStats(playerId, exp, 0);
      const transno = generateTransno();
      await createHistory({
        playerId,
        transno,
        turnOrder: tunrOrder,
        typeMatchGid,
        statusWin: StatusWin,
        mapGame: MapGame,
        maxPlayer: MaxPlayer,
        rounds,
        marbBet,
        marblesWon,
        marblesLost,
        expGained: exp,
        description,
      });
    }

    res.json({ message: 'Game results recorded' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
