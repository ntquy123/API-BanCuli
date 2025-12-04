import { Router } from 'express';
import {
  getHistories,
  getHistoryLeaderboard,
  getHistoryStats,
} from '../controllers/historyController';

const router = Router();

router.get('/histories/:playerId/stats', getHistoryStats);
router.get('/histories', getHistories);
router.get('/histories/leaderboard', getHistoryLeaderboard);

export default router;
