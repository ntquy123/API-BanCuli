import { Router } from 'express';
import { getHistories, getHistoryStats } from '../controllers/historyController';

const router = Router();

router.get('/histories/:playerId/stats', getHistoryStats);
router.get('/histories', getHistories);

export default router;
