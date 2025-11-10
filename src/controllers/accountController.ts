import { Request, Response } from 'express';
import {
  createAccount,
  getPlayerByAccountId,
  loginOrCreateSocialAccount,
} from '../services/playerService';

const VALID_PROVIDER_TYPES = [
  'Anonymous',
  'EmailPassword',
  'Phone',
  'Google',
  'GooglePlayGames',
  'Facebook',
  'Twitter',
  'GitHub',
  'Microsoft',
  'Yahoo',
  'Apple',
  'GameCenter',
  'CustomToken',
] as const;

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

export const checkAccountController = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (typeof idToken !== 'string') {
      res.status(400).json({ message: 'Invalid idToken' });
      return;
    }

    const player = await getPlayerByAccountId(idToken);

    if (player) {
      res.json(player);
    } else {
      res.json({ player: null, message: 'Chưa có tài khoản' });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const isValidProviderType = (
  providerType: string
): providerType is (typeof VALID_PROVIDER_TYPES)[number] =>
  VALID_PROVIDER_TYPES.includes(providerType as (typeof VALID_PROVIDER_TYPES)[number]);

export const socialLoginController = async (req: Request, res: Response) => {
  try {
    const { firebaseUid, email, providerType } = req.body ?? {};

    if (typeof firebaseUid !== 'string' || !firebaseUid.trim()) {
      res.status(400).json({ message: 'Invalid firebaseUid' });
      return;
    }

    if (typeof email !== 'string') {
      res.status(400).json({ message: 'Invalid email' });
      return;
    }

    if (typeof providerType !== 'string' || !isValidProviderType(providerType.trim())) {
      res.status(400).json({ message: 'Invalid providerType' });
      return;
    }

    const normalizedFirebaseUid = firebaseUid.trim();
    const normalizedEmail = email.trim();
    const normalizedProviderType = providerType.trim();

    const player = await loginOrCreateSocialAccount(
      normalizedFirebaseUid,
      normalizedEmail,
      normalizedProviderType
    );

    res.json(player);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
