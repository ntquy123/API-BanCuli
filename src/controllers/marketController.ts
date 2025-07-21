import { Request, Response } from 'express';
import {
  listItemForSale,
  buyMarketItem,
  cancelSale,
  getAllListedItems
} from '../services/marketService';

export const sellOnMarket = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const itemId = Number(req.body.itemId);
    const seq = Number(req.body.seq);
    const price = Number(req.body.price);

    if ([playerId, itemId, seq, price].some((v) => isNaN(v))) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const result = await listItemForSale(playerId, itemId, seq, price);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const buyOnMarket = async (req: Request, res: Response) => {
  try {
    const buyerId = Number(req.body.buyerId);
    const sellerId = Number(req.body.sellerId);
    const itemId = Number(req.body.itemId);
    const seq = Number(req.body.seq);

    if ([buyerId, sellerId, itemId, seq].some((v) => isNaN(v))) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const result = await buyMarketItem(buyerId, sellerId, itemId, seq);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const cancelSell = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const itemId = Number(req.body.itemId);
    const seq = Number(req.body.seq);

    if ([playerId, itemId, seq].some((v) => isNaN(v))) {
      res.status(400).json({ message: 'Invalid parameters' });
      return;
    }

    const result = await cancelSale(playerId, itemId, seq);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getListedItems = async (_req: Request, res: Response) => {
  try {
    const items = await getAllListedItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

