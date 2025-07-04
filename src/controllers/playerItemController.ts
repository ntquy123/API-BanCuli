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
    const id = Number(req.body.id);
    const price = Number(req.body.price);

    if (isNaN(id) || isNaN(price)) {
      res.status(400).json({ message: 'Invalid id or price' });
      return;
    }

    await sellItem(id, price);
    res.json({ message: 'Item sold' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
