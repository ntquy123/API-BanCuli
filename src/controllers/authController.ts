import { Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import admin from '../config/firebaseAdmin';

const unityIssuer = 'https://player-auth.services.api.unity.com';
const jwksUri = new URL('https://player-auth.services.api.unity.com/.well-known/jwks.json');
const jwks = createRemoteJWKSet(jwksUri);

export const ugsToFirebase = async (req: Request, res: Response): Promise<void> => {
  const { ugsToken } = req.body ?? {};

  if (typeof ugsToken !== 'string' || !ugsToken.trim()) {
    res.status(400).json({ message: 'ugsToken is required.' });
    return;
  }

  const projectId = process.env.UGS_PROJECT_ID;

  if (!projectId) {
    console.error('UGS_PROJECT_ID environment variable is not configured.');
    res.status(500).json({ message: 'UGS project ID is not configured.' });
    return;
  }

  let verificationResult;

  try {
    verificationResult = await jwtVerify(ugsToken, jwks, {
      issuer: unityIssuer,
      audience: projectId,
    });
  } catch (error) {
    console.error('Failed to verify UGS token', error);
    res.status(401).json({ message: 'Invalid UGS token.' });
    return;
  }

  const playerId = verificationResult.payload.sub;

  if (typeof playerId !== 'string' || !playerId.trim()) {
    console.error('UGS token payload is missing subject (playerId).');
    res.status(400).json({ message: 'UGS token missing subject claim.' });
    return;
  }

  const uid = `ugs:${playerId}`;

  try {
    const customToken = await admin.auth().createCustomToken(uid);
    res.json({ customToken });
  } catch (error) {
    console.error('Failed to create Firebase custom token', error);
    res.status(500).json({ message: 'Failed to mint Firebase custom token.' });
  }
};
