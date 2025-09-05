import { Request, Response } from 'express';
import {
  listItemForSale,
  buyMarketItem,
  cancelSale,
  getListedItems as getListedItemsService,
  ListedItemResult
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

export const getListedItems = async (req: Request, res: Response) => {
  try {
    const itemName = req.query.itemName as string | undefined;
    const level = req.query.level ? Number(req.query.level) : undefined;
    const priceOrder = req.query.priceOrder as 'asc' | 'desc' | undefined;
    const levelOrder = req.query.levelOrder as 'asc' | 'desc' | undefined;

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 10;
    const skip = (page - 1) * pageSize;

    const items = await getListedItemsService({
      itemName,
      level,
      priceOrder,
      levelOrder,
      skip,
      take: pageSize,
    });
    const response: (ListedItemResult & { playerName: string | null })[] = items.map(
      (i) => ({
        ...i,
        playerName: i.player?.PlayerName ?? null,
      })
    );
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

