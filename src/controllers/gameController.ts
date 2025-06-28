import { Request, Response } from 'express';
import { createHistory } from '../services/historyService';
import { updatePlayerStats } from '../services/playerService';

export const overGame = async (req: Request, res: Response) => {
  try {
    const {
      playerId,
      opponentId,
      isWin,
      rounds,
      marblesWon,
      marblesLost,
      expGained,
      ball,
      description,
    } = req.body;

    if (typeof playerId !== 'number' || typeof opponentId !== 'number') {
      res.status(400).json({ message: 'Invalid playerId or opponentId' });
      return;
    }

    const isWinBool = typeof isWin === 'boolean' ? isWin : isWin === 'yes';
    const exp = typeof expGained === 'number' ? expGained : 0;
    const ballDelta = typeof ball === 'number' ? ball : 0;

    await updatePlayerStats(playerId, exp, ballDelta);

    await createHistory({
      playerId,
      opponentId,
      isWin: isWinBool,
      rounds,
      marblesWon,
      marblesLost,
      expGained: exp,
      description,
    });

    res.json({ message: 'Game result recorded' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
