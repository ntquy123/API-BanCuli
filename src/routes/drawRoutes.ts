import { Router } from 'express';
import { drawRewardController } from '../controllers/drawController';

const router = Router();

router.post('/draw-reward', drawRewardController);

export default router;
