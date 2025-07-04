// src/routes/playerRoutes.ts
import { Router } from 'express';
import * as PlayerController from '../controllers/playerController';
import { getInventoryController } from '../controllers/playerController';
const router = Router();

router.get('/player/:id', PlayerController.getPlayerController);
router.post('/player/by-list-id', PlayerController.getPlayerByIdsController);
router.get('/players/:id/inventory', getInventoryController);
router.post('/player/equip', PlayerController.equipItemController);
 

// router.post('/player/:id/experience', updateExperienceController);
// router.post('/player/:id/level-up', levelUpController);

export default router;
