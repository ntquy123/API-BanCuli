import { Router } from 'express';
import { buyItemController, sellItemController } from '../controllers/playerItemController';

const router = Router();

router.post('/player-item/buy', buyItemController);
router.post('/player-item/sell', sellItemController);

export default router;
