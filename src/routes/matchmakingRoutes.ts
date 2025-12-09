import express from 'express';
import {
  availableRooms,
  getEmptyRoomList,
  joinRoom,
  leaveRoomController,
} from '../controllers/matchmakingController';

const router = express.Router();

router.get('/availableRooms', availableRooms);
router.post('/joinRoom', joinRoom);
router.post('/leaveRoom', leaveRoomController);
router.get('/emptyRooms', getEmptyRoomList);

export default router;
