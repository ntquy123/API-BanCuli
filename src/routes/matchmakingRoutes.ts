import express from 'express';
import {
  availableRooms,
  getEmptyRoomList,
  joinRoom,
  joinRoomBatch,
  leaveRoomController,
  leaveRoomBatchController,
  shutdownServers,
} from '../controllers/matchmakingController';

const router = express.Router();

router.get('/availableRooms', availableRooms);
router.post('/joinRoom', joinRoom);
router.post('/joinRooms', joinRoomBatch);
router.post('/leaveRoom', leaveRoomController);
router.post('/leaveRooms', leaveRoomBatchController);
router.get('/emptyRooms', getEmptyRoomList);
router.post('/shutdownServers', shutdownServers);

export default router;
