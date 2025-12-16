import { RequestHandler } from 'express';
import * as RoomService from '../services/roomService';

export const createRoom: RequestHandler = async (req, res) => {
  try {
    const { userId, bet, maxPlayer, mapId } = req.body;
    const room = await RoomService.createRoom({ userId, bet, maxPlayer, mapId });

    res.json(room);
  } catch (error) {
    console.error('💥 Lỗi trong createRoom:', error);
    if (error instanceof Error && error.message === 'NO_AVAILABLE_PORT') {
      res.status(503).json({ error: 'Không còn cổng trống để tạo phòng' });
      return;
    }
    res.status(500).json({ error: error.message || 'Database error' });
  }
};

export const getRooms: RequestHandler = async (_req, res) => {
  try {
    const rooms = await RoomService.getActiveRooms();
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
};

export const updateRoomCreator: RequestHandler = async (req, res) => {
  try {
    const { roomId, userId } = req.body;

    const roomIdNumber = Number(roomId);
    const userIdNumber = Number(userId);

    if (Number.isNaN(roomIdNumber) || Number.isNaN(userIdNumber)) {
      res.status(400).json({ error: 'Invalid roomId or userId' });
      return;
    }

    const result = await RoomService.updateRoomCreator(roomIdNumber, userIdNumber);

    res.json(result);
    return;
  } catch (error) {
    console.error('💥 Lỗi trong updateRoomCreator:', error);
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (error instanceof Error && error.message === 'USER_NOT_IN_ROOM') {
      res.status(400).json({ error: 'User is not in the room' });
      return;
    }

    res.status(500).json({ error: error.message || 'Database error' });
  }
};

export const deleteRoom: RequestHandler = async (
  req,
  res
): Promise<void> => {
  try {
    const roomId = Number(req.params.roomId);
    if (isNaN(roomId)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }
    await RoomService.deleteRoom(roomId);
    res.json({ message: 'Room deleted' });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Room not found or error' });
    return;
  }
};

export const leaveRoom: RequestHandler = async (
  req,
  res
): Promise<void> => {
  try {
      // Lấy dữ liệu từ body
     const { roomId, userId } = req.body;
     const roomIdNumber = Number(roomId);
     const userIdNumber = Number(userId);

    // Kiểm tra nếu roomId hoặc userId không hợp lệ
    if (Number.isNaN(roomIdNumber) || Number.isNaN(userIdNumber)) {
      res.status(400).json({ error: 'Invalid roomId or userId' });
      return;
    }
    // Gọi service để xóa người dùng khỏi phòng
    const result = await RoomService.leaveRoom(roomIdNumber, userIdNumber);

    // Trả về kết quả thành công
    res.json(result);
    return;
  } catch (error) {
    console.error('💥 Lỗi trong leaveRoom:', error);
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    res.status(500).json({ error: error.message || 'Room not found or error' });
    return;
  }
};

export const joinRoom: RequestHandler = async (
  req,
  res
): Promise<void> => {
  try {
     // Lấy dữ liệu từ body
     const { roomId, userId } = req.body;
     const roomIdNumber = Number(roomId);
     const userIdNumber = Number(userId);

    // Kiểm tra nếu roomId hoặc userId không hợp lệ
    if (Number.isNaN(roomIdNumber) || Number.isNaN(userIdNumber)) {
      res.status(400).json({ error: 'Invalid roomId or userId' });
      return;
    }
    const room = await RoomService.joinRoom(roomIdNumber, userIdNumber);

    // Trả về kết quả thành công
    res.json(room);
    return;
  } catch (error) {
    console.error('💥 Lỗi :', error);
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (error instanceof Error && error.message === 'ROOM_FULL') {
      res.status(409).json({ error: 'Room is full' });
      return;
    }

    if (error instanceof Error && error.message === 'NOT_ENOUGH_RINGBALL') {
      res.status(400).json({ error: 'Not enough RingBall to join the room' });
      return;
    }

    res.status(500).json({ error: error.message || 'Room not found or error' });
    return;
  }
};

export const getUserRoomsController: RequestHandler = async (
  req,
  res
): Promise<void> => {
  try {
    const roomId = Number(req.query.roomId);   

    // Kiểm tra nếu roomId không hợp lệ
    if (isNaN(roomId)) {
      res.status(400).json({ error: 'Invalid roomId' });
      return;
    }

    // Gọi service để lấy danh sách người dùng trong phòng
    const users = await RoomService.getUserRooms(roomId);

    // Trả về danh sách người dùng
    res.json(users);
    return;
  } catch (error) {
    console.error('💥 Lỗi trong getUserRoomsController:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
    return;
  }
};
