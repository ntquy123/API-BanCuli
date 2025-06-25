
import * as RoomController from '../controllers/roomController';
import { spawn, exec } from 'child_process';
const express = require('express');
const router = express.Router();

//router.post('/createroom/', RoomController.createRoom);
router.get('/getroom/', RoomController.getRooms);
router.delete('deleteroom/:roomName', RoomController.deleteRoom);
router.put('/createroom',RoomController.createRoom);
router.post('/joinRoom',RoomController.joinRoom);
router.post('/leaveRoom',RoomController.leaveRoom);
router.get('/getUserRooms',RoomController.getUserRoomsController);
export default router;
