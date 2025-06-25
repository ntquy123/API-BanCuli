import { RequestHandler } from 'express';
import * as RoomService from '../services/roomService';

export const createRoom: RequestHandler = async (req, res) => {
  try {
    const { roomName, userId } = req.body;
    // Gọi service để tạo hoặc cập nhật room
    const room = await RoomService.createRoom({ roomName, userId });

    // Trả về kết quả
    res.json(room);
  } catch (error) {
    console.error('💥 Lỗi trong createRoom:', error);
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

    // Kiểm tra nếu roomId hoặc userId không hợp lệ
    if (isNaN(roomId) || isNaN(userId)) {
      res.status(400).json({ error: 'Invalid roomId or userId' });
      return;
    }
    // Gọi service để xóa người dùng khỏi phòng
    await RoomService.leaveRoom(roomId, userId);

    // Trả về kết quả thành công
    res.json({ message: 'User left the room successfully' });
    return;
  } catch (error) {
    console.error('💥 Lỗi trong leaveRoom:', error);
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

    // Kiểm tra nếu roomId hoặc userId không hợp lệ
    if (isNaN(roomId) || isNaN(userId)) {
      res.status(400).json({ error: 'Invalid roomId or userId' });
      return;
    }
    await RoomService.joinRoom(roomId, userId);

    // Trả về kết quả thành công
    res.json({ message: 'User join the room successfully' });
    return;
  } catch (error) {
    console.error('💥 Lỗi :', error);
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
