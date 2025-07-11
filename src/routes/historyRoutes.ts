import { Router } from 'express';
import { getHistories } from '../controllers/historyController';

const router = Router();

router.get('/histories', getHistories);

export default router;
