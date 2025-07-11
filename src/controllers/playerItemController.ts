import { Request, Response } from 'express';
import { buyItem, sellItem } from '../services/playerItemService';

export const buyItemController = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const itemId = Number(req.body.itemId);

    if (isNaN(playerId) || isNaN(itemId)) {
      res.status(400).json({ message: 'Invalid playerId or itemId' });
      return;
    }

    const result = await buyItem(playerId, itemId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sellItemController = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const itemId = Number(req.body.itemId);
    const seq = Number(req.body.seq);

    if (isNaN(playerId) || isNaN(itemId) || isNaN(seq)) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    await sellItem(playerId, itemId, seq);
    res.json({ message: 'Item sold' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
