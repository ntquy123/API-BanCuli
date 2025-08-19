import { Request, Response } from 'express';
import { listPlayerAchievements } from '../services/achievementService';

export const getPlayerAchievements = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.query.playerId);
    const achievements = await listPlayerAchievements(playerId);
    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
