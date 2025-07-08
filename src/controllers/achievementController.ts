import { Request, Response } from 'express';
import {
  getAchievementsByPlayer,
  addPlayerAchievement,
  claimAchievementReward,
} from '../services/achievementService';

export const getAchievements = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.params.playerId);
    if (isNaN(playerId)) {
      res.status(400).json({ message: 'Invalid playerId' });
      return;
    }
    const achievements = await getAchievementsByPlayer(playerId);
    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const completeAchievement = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const achievementId = Number(req.body.achievementId);

    if (isNaN(playerId) || isNaN(achievementId)) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const result = await addPlayerAchievement(playerId, achievementId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const claimReward = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const achievementId = Number(req.body.achievementId);

    if (isNaN(playerId) || isNaN(achievementId)) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    await claimAchievementReward(playerId, achievementId);
    res.json({ message: 'Reward claimed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
