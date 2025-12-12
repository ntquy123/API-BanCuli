import { Request, Response } from 'express';
import {
  createAccount,
  getPlayerByAccountId,
  loginOrCreateSocialAccount,
  confirmPlayerName,
  markPlayerOffline,
  markPlayerOnline,
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
    const status = error.message === 'Player is already logged in' ? 409 : 500;
    res.status(status).json({ message: error.message });
  }
};

export const confirmSocialLoginNameController = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      id,
      PlayerName,
      playerName,
      CompanionBallItemId,
      companionBallItemId,
    } = req.body ?? {};

    const parsedId =
      typeof id === 'string' ? Number.parseInt(id, 10) : Number(id);

    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      res.status(400).json({ message: 'Invalid id' });
      return;
    }

    const nameCandidate =
      typeof PlayerName === 'string' && PlayerName.trim()
        ? PlayerName
        : typeof playerName === 'string'
        ? playerName
        : undefined;

    if (typeof nameCandidate !== 'string' || !nameCandidate.trim()) {
      res.status(400).json({ message: 'Invalid PlayerName' });
      return;
    }

    const parsedCompanionBallItemId = (() => {
      const rawValue =
        typeof CompanionBallItemId === 'string' && CompanionBallItemId.trim()
          ? CompanionBallItemId
          : typeof companionBallItemId === 'string' && companionBallItemId.trim()
          ? companionBallItemId
          : typeof CompanionBallItemId === 'number'
          ? CompanionBallItemId
          : typeof companionBallItemId === 'number'
          ? companionBallItemId
          : undefined;

      return typeof rawValue === 'string'
        ? Number.parseInt(rawValue, 10)
        : rawValue;
    })();

    if (
      !Number.isInteger(parsedCompanionBallItemId) ||
      parsedCompanionBallItemId <= 0
    ) {
      res.status(400).json({ message: 'Invalid CompanionBallItemId' });
      return;
    }

    const updatedPlayer = await confirmPlayerName(
      parsedId,
      nameCandidate.trim(),
      parsedCompanionBallItemId
    );

    res.json(updatedPlayer);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

const resolveAccountId = (candidate: unknown) =>
  typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;

export const loginSessionController = async (req: Request, res: Response) => {
  try {
    const { idToken, accountId, firebaseUid } = req.body ?? {};

    const resolvedAccountId =
      resolveAccountId(idToken) || resolveAccountId(accountId) || resolveAccountId(firebaseUid);

    if (!resolvedAccountId) {
      res.status(400).json({ message: 'Invalid accountId' });
      return;
    }

    const player = await markPlayerOnline(resolvedAccountId);

    res.json(player);
  } catch (error: any) {
    const status = error.message === 'Player is already logged in' ? 409 : 500;
    res.status(status).json({ message: error.message });
  }
};

export const logoutSessionController = async (req: Request, res: Response) => {
  try {
    const { idToken, accountId, firebaseUid } = req.body ?? {};

    const resolvedAccountId =
      resolveAccountId(idToken) || resolveAccountId(accountId) || resolveAccountId(firebaseUid);

    if (!resolvedAccountId) {
      res.status(400).json({ message: 'Invalid accountId' });
      return;
    }

    const player = await markPlayerOffline(resolvedAccountId);

    res.json(player);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
