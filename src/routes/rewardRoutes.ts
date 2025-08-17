import { Router } from 'express';
import * as RewardController from '../controllers/rewardController';

const router = Router();

router.get('/rewards', RewardController.getRewards);

export default router;
