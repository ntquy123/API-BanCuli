// src/routes/friendRoutes.ts
import { Router } from 'express';
import {
  sendFriendRequestController,
  removeFriendController,
  respondFriendRequestController,
  sendMessageController,
  receiveItemsController,
} from '../controllers/friendController';

const router = Router();

router.post('/friend-request', sendFriendRequestController);
router.post('/friend-remove', removeFriendController);
router.post('/friend-respond', respondFriendRequestController);
router.post('/send-message', sendMessageController);
router.post('/receive-items', receiveItemsController);

export default router;
