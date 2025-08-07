// src/routes/friendRoutes.ts
import { Router } from 'express';
import {
  sendFriendRequestController,
  removeFriendController,
  respondFriendRequestController,
  sendMessageController,
  receiveItemsController,
  getFriendListController,
  getPendingFriendRequestsController,
  getFriendMessagesController,
} from '../controllers/friendController';

const router = Router();

router.post('/friend-request', sendFriendRequestController);
router.post('/friend-remove', removeFriendController);
router.post('/friend-respond', respondFriendRequestController);
router.post('/send-message', sendMessageController);
router.post('/receive-items', receiveItemsController);
router.get('/friend-list/:playerId', getFriendListController);
router.get('/friend-requests/:receiverId', getPendingFriendRequestsController);
router.get('/messages/:receiverId', getFriendMessagesController);

export default router;
