import { Router } from 'express';
import {
  getRewards,
  getPlayerAchievements,
  refreshRewards,
  claimReward,
  insertPlayerAchievement,
} from '../controllers/rewardController';

const router = Router();

router.get('/rewards', getRewards);
router.get('/rewards/player-achievements', getPlayerAchievements);
router.post('/rewards/refresh', refreshRewards);
router.post('/rewards/claim', claimReward);
router.post('/rewards/insert', insertPlayerAchievement);

export default router;
