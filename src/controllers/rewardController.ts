import { Request, Response } from 'express';
import { listRewards } from '../services/rewardService';

export const getRewards = async (req: Request, res: Response) => {
  try {
    const { rewardType, playerId, dayofweek } = req.query;

    if (typeof rewardType !== 'string' || typeof playerId !== 'string') {
      res.status(400).json({ message: 'Missing or invalid rewardType or playerId' });
      return;
    }

    const playerIdNum = Number(playerId);
    if (isNaN(playerIdNum)) {
      res.status(400).json({ message: 'Invalid playerId' });
      return;
    }

    let dayOfWeekNum: number | undefined;
    if (dayofweek !== undefined) {
      const dayStr = Array.isArray(dayofweek) ? dayofweek[0] : dayofweek;
      dayOfWeekNum = Number(dayStr);
      if (isNaN(dayOfWeekNum)) {
        res.status(400).json({ message: 'Invalid dayofweek' });
        return;
      }
    }

    const rewards = await listRewards(rewardType, playerIdNum, dayOfWeekNum);
    res.json(rewards);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
