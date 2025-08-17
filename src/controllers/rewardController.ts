import { Request, Response } from 'express';
import {
  listRewards,
  refreshRewards as refreshRewardsService,
  claimReward as claimRewardService,
  insertPlayerAchievement as insertPlayerAchievementService,
} from '../services/rewardService';

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

export const refreshRewards = async (req: Request, res: Response) => {
  try {
    const playerIdParam = (req.query.playerId ?? req.body.playerId) as string | undefined;
    if (playerIdParam === undefined) {
      res.status(400).json({ message: 'Missing playerId' });
      return;
    }

    const playerIdNum = Number(playerIdParam);
    if (isNaN(playerIdNum)) {
      res.status(400).json({ message: 'Invalid playerId' });
      return;
    }

    const rewards = await refreshRewardsService(playerIdNum);
    res.json(rewards);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const claimReward = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const locationId = Number(req.body.locationId);
    const rewardType = req.body.rewardType;

    if (
      isNaN(playerId) ||
      isNaN(locationId) ||
      typeof rewardType !== 'string'
    ) {
      res.status(400).json({ message: 'Missing or invalid parameters' });
      return;
    }

    const achievement = await claimRewardService(
      playerId,
      locationId,
      rewardType,
    );

    if (!achievement) {
      res.status(404).json({ message: 'No reward found' });
      return;
    }

    res.json(achievement);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const insertPlayerAchievement = async (req: Request, res: Response) => {
  try {
    const { playerId, rewardType } = req.body;

    const playerIdNum = Number(playerId);
    if (isNaN(playerIdNum) || typeof rewardType !== 'string') {
      res
        .status(400)
        .json({ message: 'Missing or invalid playerId or rewardType' });
      return;
    }

    const achievements = await insertPlayerAchievementService(
      playerIdNum,
      rewardType,
    );
    res.json(achievements);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
