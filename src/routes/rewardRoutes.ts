import { Router } from 'express';
import {
  getRewards,
  refreshRewards,
  claimReward,
} from '../controllers/rewardController';

const router = Router();

router.get('/rewards', getRewards);
router.post('/rewards/refresh', refreshRewards);
router.post('/rewards/claim', claimReward);

export default router;
