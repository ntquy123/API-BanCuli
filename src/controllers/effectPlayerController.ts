import { Request, Response } from 'express';
import { getByPlayerId } from '../services/effectPlayerService';

export const getEffectPlayers = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.params.playerId);
    if (isNaN(playerId)) {
      res.status(400).json({ message: 'Invalid playerId' });
      return;
    }
    const effects = await getByPlayerId(playerId);
    res.json(effects);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
