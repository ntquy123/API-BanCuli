import express from 'express';
import { joinQueue, matchReady, matchResult } from '../controllers/matchQueueController';

const router = express.Router();

router.post('/queue/join', joinQueue);
router.post('/internal/match/ready', matchReady);
router.post('/internal/match/result', matchResult);

export default router;
