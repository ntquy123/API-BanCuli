import { Router } from 'express';
import * as ItemController from '../controllers/itemController';

const router = Router();

router.get('/items', ItemController.getItems);

export default router;
