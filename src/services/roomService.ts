import prisma from '../models/prismaClient'; // Import Prisma Client
import { exec } from 'child_process'; // Import exec từ child_process
import util from 'util'; // Để sử dụng exec dưới dạng Promise

const execPromise = util.promisify(exec); // Chuyển exec thành Promise
const PORT_RANGE_START = 27015;
const PORT_RANGE_END = 27100;
async function getAvailablePort(): Promise<number | null> {
  const usedPorts = await prisma.serverPortPool.findMany({ select: { portNo: true } });
  const usedSet = new Set(usedPorts.map(r => r.portNo));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (!usedSet.has(port)) {
      return port;
    }
  }

  return null;
}
// export const createOrUpdateRoomDFS = async (data: { roomName: string }) => {
//   const { roomName } = data;

//   if (!roomName) {
//     throw new Error('roomName is required');
//   }

//   try {
//     // 🔍 Tìm port chưa dùng
//     const port = await getAvailablePort();
//     if (!port) throw new Error('No available port');

//     // 1️⃣ Upsert vào database
//     const room = await prisma.room.upsert({
//       where: { roomName },
//       update: {
//         currentPlayers: 1,
//         port, // cập nhật port nếu phòng đã tồn tại
//       },
//       create: {
//         roomName,
//         maxPlayers: 4,
//         currentPlayers: 1,
//         port,
//       },
//     });

//     const roomId = room.id;

//     // 2️⃣ Gọi pm2 start bằng room ID và port
//     const command = `pm2 start ./BanCuLiServer.x86_64 --name ${roomId} -- -batchmode -nographics --roomName=${roomId} --port=${port}`;

//     const { stdout, stderr } = await execPromise(command, { cwd: '/home/deploy/server' });

//     if (stderr) {
//       console.error(`❌ Không start được server room ID ${roomId}:`, stderr);
//       throw new Error('Failed to start room');
//     }

//     console.log(`✅ Phòng ${room.roomName} [ID: ${roomId}] đã được tạo và chạy bằng pm2 trên port ${port}`);

//     return {
//       message: `Room created and server started`,
//       roomId,
//       roomName: room.roomName,
//       port,
//       output: stdout,
//     };
//   } catch (err) {
//     console.error('💥 Lỗi khi tạo phòng:', err);
//     throw new Error('Something went wrong creating room');
//   }
// };


export const createRoom = async (data: { roomName: string, userId: number }) => {
  const { roomName, userId } = data;

  if (!roomName) {
    throw new Error('roomName is required');
  }

  try {
 

    // Tạo phòng mới
    const room = await prisma.room.create({
      data: {
        roomName,
        maxPlayers: 2,
        // Bắt đầu phòng với 1 người chơi
        currentPlayers: 1,
      },
    });

    const roomIdCreated = room.id;

    // Thêm người dùng vào phòng
    const roomUser = await prisma.roomUser.create({
      data: {
        roomId: roomIdCreated,
        userId: userId,
        joinedAt: new Date(),
      },
    });

    return {
      message: `Room created`,
      roomId: roomIdCreated,
      roomName: room.roomName,
      port: 27015,
    };
  } catch (err) {
    console.error('💥 Lỗi khi tạo phòng:', err);
    throw new Error(err.message || 'Something went wrong creating room');
  }
};
export const joinRoom = async (roomId: number, userId: number) => {
  try {
    // Kiểm tra xem người dùng đã tham gia phòng chưa
    const existing = await prisma.roomUser.findFirst({
      where: { roomId: roomId, userId: userId },
    });

    // Nếu chưa tham gia, thêm người dùng vào phòng
    if (!existing) {
      await prisma.roomUser.create({
        data: {
          roomId: roomId,
          userId: userId,
        },
      });

      // Tăng số lượng người chơi hiện tại của phòng
      await prisma.room.update({
        where: { id: roomId },
        data: { currentPlayers: { increment: 1 } },
      });
    }

    return { message: 'User joined the room successfully' };
  } catch (err) {
    console.error('💥 Lỗi khi vào phòng:', err);
    throw new Error('Lỗi khi vào phòng');
  }
};

 export const leaveRoom = async (roomId: number, userId: number) => {
  try {
    // Xóa người dùng khỏi phòng
    await prisma.roomUser.deleteMany({
      where: {
        roomId: roomId,
        userId: userId,
      },
    });

    // Giảm số lượng người chơi hiện tại
    const room = await prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { decrement: 1 } },
    });

    // Nếu không còn ai thì xóa phòng
    if (room.currentPlayers === 0) {
      await prisma.room.delete({
        where: { id: roomId },
      });
      return { message: 'User left the room and room deleted' };
    }

    return { message: 'User left the room successfully' };
  } catch (err) {
    console.error('❌ Lỗi khi rời phòng:', err);
    throw new Error('Lỗi khi rời phòng');
  }
};

export const deleteRoom = async (roomId: number) => {
  return prisma.room.delete({
    where: { id: roomId  },
  });
};

export const getActiveRooms = async () => {
  return prisma.room.findMany();
};

export const getUserRooms = async (roomId: number) => {
  try {
    // Truy vấn danh sách người dùng trong phòng
    const users = await prisma.roomUser.findMany({
      where: { roomId: roomId },
      include: {
        player: true, // Giả sử bạn đã định nghĩa quan hệ giữa roomUser và player trong schema.prisma
      },
    });

    return users;
  } catch (err) {
    console.error('❌ Lỗi khi lấy danh sách người dùng trong phòng:', err);
    throw new Error('Không thể lấy danh sách người dùng trong phòng');
  }
};