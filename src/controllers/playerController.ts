// src/controllers/playerController.ts
import { Request, Response, RequestHandler } from 'express';
import { getPlayerByAccountId, getPlayerByListId, equipItem } from '../services/playerService';
import { getInventoryByPlayer } from '../services/itemService';

export const getPlayerController = async (req: Request, res: Response) => {
  try {
    const playerId = req.params.id;
    const player = await getPlayerByAccountId(playerId);
    if (player) {
      res.json(player);
    } else {
      res.status(404).json({ message: 'Player not found' });
    }
  } catch (error : any) {
    res.status(500).json({ message: error.message });
  }
};

 
 
export const getPlayerByIdsController = async (req: Request, res: Response) => {
  try {
    let ids = req.body.ids;
    const players = await getPlayerByListId(ids);
    res.json({ players });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getInventoryController: RequestHandler = async (
  req,
  res
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'Invalid player id' });
      return;
    }
    const inventory = await getInventoryByPlayer(id);
    res.json(inventory);
    return;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    return;
  }
};

export const equipItemController: RequestHandler = async (req, res): Promise<void> => {
  try {
    const playerId = Number(req.body.playerId);
    const typeGid = Number(req.body.typeGid);
    const itemId = Number(req.body.itemId);

    if (isNaN(playerId) || isNaN(typeGid) || isNaN(itemId)) {
      res.status(400).json({ message: 'Invalid playerId, typeGid or itemId' });
      return;
    }

    const updatedPlayer = await equipItem(playerId, typeGid, itemId);
    res.json(updatedPlayer);
    return;
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    return;
  }
};

