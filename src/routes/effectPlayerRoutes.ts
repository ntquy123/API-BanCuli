import { Router } from 'express';
import * as EffectPlayerController from '../controllers/effectPlayerController';

const router = Router();

router.get('/effect-player/:playerId', EffectPlayerController.getEffectPlayer);

export default router;
