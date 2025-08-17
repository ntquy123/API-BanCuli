import { Router } from 'express';
import { getRewards, refreshRewards } from '../controllers/rewardController';

const router = Router();

router.get('/rewards', getRewards);
router.post('/rewards/refresh', refreshRewards);

export default router;
