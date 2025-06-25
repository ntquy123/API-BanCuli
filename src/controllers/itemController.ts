import { Request, Response } from 'express';
import * as ItemService from '../services/itemService';

export const getItems = async (_req: Request, res: Response) => {
  try {
    const items = await ItemService.getAllItems();
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
