import { Request, Response } from 'express';
import * as ItemService from '../services/itemService';

export const getItems = async (req: Request, res: Response) => {
  try {
    const locationGidParam = Number(req.query.locationGid ?? 2);

    if (Number.isNaN(locationGidParam)) {
      return res
        .status(400)
        .json({ message: 'locationGid is required and must be a number' });
    }

    const items = await ItemService.getAllItems(locationGidParam);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
