"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserRoomsController = exports.joinRoom = exports.leaveRoom = exports.deleteRoom = exports.getRooms = exports.createRoom = void 0;
const RoomService = __importStar(require("../services/roomService"));
const createRoom = async (req, res) => {
    try {
        const { roomName, userId } = req.body;
        // Gọi service để tạo hoặc cập nhật room
        const room = await RoomService.createRoom({ roomName, userId });
        // Trả về kết quả
        res.json(room);
    }
    catch (error) {
        console.error('💥 Lỗi trong createRoom:', error);
        res.status(500).json({ error: error.message || 'Database error' });
    }
};
exports.createRoom = createRoom;
const getRooms = async (_, res) => {
    try {
        const rooms = await RoomService.getActiveRooms();
        res.json(rooms);
    }
    catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
};
exports.getRooms = getRooms;
const deleteRoom = async (req, res) => {
    try {
        const roomId = Number(req.params.roomId);
        if (isNaN(roomId)) {
            return res.status(400).json({ error: 'Invalid roomId' });
        }
        await RoomService.deleteRoom(roomId);
        res.json({ message: 'Room deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Room not found or error' });
    }
};
exports.deleteRoom = deleteRoom;
const leaveRoom = async (req, res) => {
    try {
        // Lấy dữ liệu từ body
        const { roomId, userId } = req.body;
        // Kiểm tra nếu roomId hoặc userId không hợp lệ
        if (isNaN(roomId) || isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid roomId or userId' });
        }
        // Gọi service để xóa người dùng khỏi phòng
        await RoomService.leaveRoom(roomId, userId);
        // Trả về kết quả thành công
        res.json({ message: 'User left the room successfully' });
    }
    catch (error) {
        console.error('💥 Lỗi trong leaveRoom:', error);
        res.status(500).json({ error: error.message || 'Room not found or error' });
    }
};
exports.leaveRoom = leaveRoom;
const joinRoom = async (req, res) => {
    try {
        // Lấy dữ liệu từ body
        const { roomId, userId } = req.body;
        // Kiểm tra nếu roomId hoặc userId không hợp lệ
        if (isNaN(roomId) || isNaN(userId)) {
            return res.status(400).json({ error: 'Invalid roomId or userId' });
        }
        await RoomService.joinRoom(roomId, userId);
        // Trả về kết quả thành công
        res.json({ message: 'User join the room successfully' });
    }
    catch (error) {
        console.error('💥 Lỗi :', error);
        res.status(500).json({ error: error.message || 'Room not found or error' });
    }
};
exports.joinRoom = joinRoom;
const getUserRoomsController = async (req, res) => {
    try {
        const roomId = Number(req.query.roomId);
        // Kiểm tra nếu roomId không hợp lệ
        if (isNaN(roomId)) {
            return res.status(400).json({ error: 'Invalid roomId' });
        }
        // Gọi service để lấy danh sách người dùng trong phòng
        const users = await RoomService.getUserRooms(roomId);
        // Trả về danh sách người dùng
        res.json(users);
    }
    catch (error) {
        console.error('💥 Lỗi trong getUserRoomsController:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
};
exports.getUserRoomsController = getUserRoomsController;
