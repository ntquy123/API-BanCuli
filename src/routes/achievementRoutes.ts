import { Router } from 'express';
import * as AchievementController from '../controllers/achievementController';

const router = Router();

router.get('/achievements/:playerId', AchievementController.getAchievements);
router.post('/achievements/complete', AchievementController.completeAchievement);
router.post('/achievements/claim', AchievementController.claimReward);

export default router;
