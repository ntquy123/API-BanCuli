import { Router } from 'express';
import { buyItemController, sellItemController } from '../controllers/playerItemController';
import { getInventoryController } from '../controllers/playerController';

const router = Router();

router.get('/players/:id/inventory', getInventoryController);
router.post('/player-item/buy', buyItemController);
router.post('/player-item/sell', sellItemController);

export default router;
