import { Router } from 'express';
import * as AchievementController from '../controllers/achievementController';

const router = Router();

router.get('/achievements', AchievementController.getPlayerAchievements);

export default router;
