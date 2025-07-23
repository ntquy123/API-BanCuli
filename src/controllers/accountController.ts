import { Request, Response } from 'express';
import { createAccount } from '../services/playerService';

export const createAccountController = async (req: Request, res: Response) => {
  try {
    const { idToken, playerName } = req.body;

    if (typeof idToken !== 'string' || typeof playerName !== 'string') {
      res.status(400).json({ message: 'Invalid idToken or playerName' });
      return;
    }

    const player = await createAccount(idToken, playerName);
    res.json(player);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
