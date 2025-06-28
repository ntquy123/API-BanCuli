import { Router } from 'express';
import { overGame } from '../controllers/gameController';

const router = Router();

router.post('/over-game', overGame);

export default router;
