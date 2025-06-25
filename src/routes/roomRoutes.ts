import express from 'express';
import * as RoomController from '../controllers/roomController';
import { spawn, exec } from 'child_process';

const router = express.Router();

//router.post('/createroom/', RoomController.createRoom);
router.get('/getroom/', RoomController.getRooms);
router.delete('/deleteroom/:roomId', RoomController.deleteRoom);
router.put('/createroom',RoomController.createRoom);
router.post('/joinRoom',RoomController.joinRoom);
router.post('/leaveRoom',RoomController.leaveRoom);
router.get('/getUserRooms',RoomController.getUserRoomsController);
export default router;
