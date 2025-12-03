import { Request, Response } from 'express';
import {
  getHistories as getHistoriesService,
  getHistoryStatsByPlayer,
} from '../services/historyService';

export const getHistories = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;
    const histories = await getHistoriesService(skip, pageSize);
    res.json(histories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getHistoryStats = async (req: Request, res: Response) => {
  try {
    const playerId = parseInt(req.params.playerId, 10);

    if (Number.isNaN(playerId)) {
      res.status(400).json({ message: 'playerId must be a number' });
      return;
    }

    const stats = await getHistoryStatsByPlayer(playerId);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
