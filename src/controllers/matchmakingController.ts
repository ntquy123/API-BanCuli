import { RequestHandler } from 'express';
import {
  assignRoomToPlayer,
  ensureEmptyRooms,
  getEmptyRooms,
  joinUsersToRoomByName,
  leaveRoom,
  leaveRoomAndCleanup,
} from '../services/matchmakingService';

export const availableRooms: RequestHandler = async (_req, res) => {
  try {
    const rooms = await ensureEmptyRooms();
    res.json({
      availableRooms: rooms,
      minEmptyRooms: 2,
      maxRooms: 20,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SERVER_CAPACITY_REACHED') {
      res.status(503).json({ error: 'Server đang quá tải, vui lòng thử lại sau.' });
      return;
    }

    if (error instanceof Error && error.message.startsWith('ROOM_INSERT_FAILED')) {
      res.status(500).json({ error: `Không thể tạo phòng: ${error.message}` });
      return;
    }

    if (error instanceof Error && error.message === 'NO_AVAILABLE_PORT') {
      res.status(503).json({ error: 'Không còn cổng trống để tạo phòng mới.' });
      return;
    }

    if (error instanceof Error && error.message.startsWith('Docker start error')) {
      res.status(500).json({ error: 'Không thể khởi động container phòng.', detail: error.message });
      return;
    }

    console.error('Lỗi khi đảm bảo phòng trống:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể lấy danh sách phòng', detail });
  }
};

export const joinRoom: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const room = await assignRoomToPlayer(Number(userId));
    res.json({
      room,
      message: 'Đã gán phòng thành công',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SERVER_CAPACITY_REACHED') {
      res.status(503).json({ error: 'Server đang quá tải, vui lòng thử lại sau.' });
      return;
    }

    if (error instanceof Error && error.message === 'ROOM_FULL') {
      res.status(409).json({ error: 'Phòng đã đầy, vui lòng thử lại.' });
      return;
    }

    console.error('Lỗi khi join room:', error);
    res.status(500).json({ error: 'Không thể join room' });
  }
};

export const joinRoomBatch: RequestHandler = async (req, res) => {
  try {
    const { userIds, roomName } = req.body as { userIds: unknown; roomName: unknown };

    if (typeof roomName !== 'string' || roomName.trim() === '') {
      res.status(400).json({ error: 'roomName is required' });
      return;
    }

    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ error: 'userIds must be a non-empty array' });
      return;
    }

    try {
      const result = await joinUsersToRoomByName(roomName.trim(), userIds as number[]);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
        res.status(404).json({ error: 'Không tìm thấy phòng' });
        return;
      }

      if (error instanceof Error && error.message === 'SERVER_CAPACITY_REACHED') {
        res.status(503).json({ error: 'Server đang quá tải, vui lòng thử lại sau.' });
        return;
      }

      console.error('Lỗi khi join room hàng loạt:', error);
      res.status(500).json({ error: 'Không thể join room' });
    }
  } catch (error) {
    console.error('Lỗi khi join room hàng loạt:', error);
    res.status(500).json({ error: 'Không thể join room' });
  }
};

export const leaveRoomController: RequestHandler = async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    if (!roomId || !userId) {
      res.status(400).json({ error: 'roomId và userId là bắt buộc' });
      return;
    }

    const room = await leaveRoom(Number(roomId), Number(userId));
    res.json({
      room,
      message: 'Đã rời phòng',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
      res.status(404).json({ error: 'Không tìm thấy phòng' });
      return;
    }

    console.error('Lỗi khi leave room:', error);
    res.status(500).json({ error: 'Không thể rời phòng' });
  }
};

export const leaveRoomBatchController: RequestHandler = async (req, res) => {
  try {
    const { roomId } = req.body as { roomId: unknown };

    if (!roomId) {
      res.status(400).json({ error: 'roomId là bắt buộc' });
      return;
    }

    const parsedRoomId = Number(roomId);

    if (!parsedRoomId) {
      res.status(400).json({ error: 'roomId không hợp lệ' });
      return;
    }

    try {
      const room = await leaveRoomAndCleanup(parsedRoomId);
      res.json({ room, message: 'Đã giải phóng phòng và container' });
    } catch (error) {
      if (error instanceof Error && error.message === 'ROOM_NOT_FOUND') {
        res.status(404).json({ error: 'Không tìm thấy phòng' });
        return;
      }

      console.error('Lỗi khi hủy phòng và container:', error);
      res.status(500).json({ error: 'Không thể hủy phòng' });
    }
  } catch (error) {
    console.error('Lỗi khi leave room hàng loạt:', error);
    res.status(500).json({ error: 'Không thể rời phòng' });
  }
};

export const getEmptyRoomList: RequestHandler = async (_req, res) => {
  try {
    const rooms = await getEmptyRooms();
    res.json({ rooms });
  } catch (error) {
    console.error('Lỗi khi lấy phòng trống:', error);
    res.status(500).json({ error: 'Không thể lấy danh sách phòng trống' });
  }
};
