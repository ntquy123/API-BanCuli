import { Request, Response } from 'express';
import { getAllHistories } from '../services/historyService';

export const getHistories = async (_req: Request, res: Response) => {
  try {
    const histories = await getAllHistories();
    res.json(histories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
