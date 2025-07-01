import { Request, Response } from 'express';
import { getByPlayerId, levelUpEffectPlayer } from '../services/effectPlayerService';

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

export const levelUpEffect = async (req: Request, res: Response) => {
  try {
    const playerId = Number(req.body.playerId);
    const effectId = Number(req.body.effectId);

    if (isNaN(playerId) || isNaN(effectId)) {
      res.status(400).json({ message: 'Invalid playerId or effectId' });
      return;
    }

    const updated = await levelUpEffectPlayer(playerId, effectId);
    res.json(updated);
  } catch (error: any) {
 
    if (error.message === 'Không còn điểm TalentPoint để tăng cấp') {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
 
  }
};
