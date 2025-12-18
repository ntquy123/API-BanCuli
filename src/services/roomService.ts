import { exec } from 'child_process';
import util from 'util';
import prisma from '../models/prismaClient';
import { ensureEmptyRooms } from './matchmakingService';
import { TypeMatchGid } from '../config/typeMatchGid';

const execPromise = util.promisify(exec);

const DOCKER_RUNTIME = process.env.DOCKER_BIN || 'docker';

const MATCH_ROOM_TYPE_GID = TypeMatchGid.MatchRoom;
const MIN_CUSTOM_PLAYERS = 2;
const MAX_CUSTOM_PLAYERS = 3;

function buildContainerName(roomName: string): string {
  return `banculi-room-${roomName}`;
}

async function stopRoomContainer(roomName: string) {
  const containerName = buildContainerName(roomName);
  try {
    await execPromise(`${DOCKER_RUNTIME} stop ${containerName}`);
  } catch (error) {
    console.error(`Không thể dừng container ${containerName}:`, error);
  }
}

async function releasePortByRoomName(roomName: string) {
  const portRecord = await prisma.serverPortPool.findFirst({ where: { roomNameRef: roomName } });

  if (!portRecord) {
    return;
  }

  if (portRecord.containerId || portRecord.roomNameRef) {
    await stopRoomContainer(portRecord.roomNameRef ?? roomName);
  }

  await prisma.serverPortPool.delete({
    where: { portNo: portRecord.portNo },
  });
}

export const createRoom = async (data: {
  userId: number;
  bet?: number;
  maxPlayer?: number;
  mapId?: number;
  roomName?: string;
}) => {
  const { userId, bet = 0, maxPlayer, mapId, roomName } = data;

  if (!roomName?.trim()) {
    throw new Error('roomName is required');
  }

  if (!userId) {
    throw new Error('userId is required');
  }

  const normalizedRoomName = roomName.trim();
  const targetMaxPlayer = Math.min(
    Math.max(maxPlayer ?? MIN_CUSTOM_PLAYERS, MIN_CUSTOM_PLAYERS),
    MAX_CUSTOM_PLAYERS,
  );

  const { room, port } = await prisma.$transaction(async (tx) => {
    const portPool = await tx.serverPortPool.findFirst({
      where: { roomNameRef: normalizedRoomName, containerId: { not: null } },
    });

    if (!portPool) {
      throw new Error('ROOM_NOT_READY');
    }

    let roomRecord = await tx.room.findFirst({ where: { roomName: normalizedRoomName } });

    if (!roomRecord) {
      roomRecord = await tx.room.create({
        data: {
          roomName: normalizedRoomName,
          maxPlayers: targetMaxPlayer,
          maxPlayer: targetMaxPlayer,
          currentPlayers: 1,
          bet,
          createId: userId,
          createDate: new Date(),
          typeMatchGid: MATCH_ROOM_TYPE_GID,
          mapId: mapId ?? 0,
        },
      });
    } else if (roomRecord.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
      throw new Error('ROOM_TYPE_MISMATCH');
    }

    const existingMember = await tx.roomUser.findUnique({
      where: { roomId_userId: { roomId: roomRecord.id, userId } },
    });

    if (!existingMember) {
      await tx.roomUser.create({ data: { roomId: roomRecord.id, userId, joinedAt: new Date() } });
    }

    const currentPlayers = await tx.roomUser.count({ where: { roomId: roomRecord.id } });

    const updatedRoom = await tx.room.update({
      where: { id: roomRecord.id },
      data: { currentPlayers },
    });

    await tx.serverPortPool.update({
      where: { portNo: portPool.portNo },
      data: {
        isBusy: 1,
        roomNameRef: normalizedRoomName,
        lastUpdate: new Date(),
        typeMatchGid: MATCH_ROOM_TYPE_GID,
      },
    });

    return { room: updatedRoom, port: portPool.portNo };
  });

  await ensureEmptyRooms(MATCH_ROOM_TYPE_GID);

  return {
    message: 'Room created',
    roomId: room.id,
    roomName: room.roomName,
    port,
    mapId: room.mapId,
  };
};

export const joinRoom = async (roomId: number, userId: number) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId } });

      if (!room || room.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const player = await tx.player.findUnique({
        where: { id: userId },
        select: { RingBall: true },
      });

      if (!player || (player.RingBall ?? 0) < room.bet) {
        throw new Error('NOT_ENOUGH_RINGBALL');
      }

      const existing = await tx.roomUser.findUnique({ where: { roomId_userId: { roomId, userId } } });
      if (existing) {
        return room;
      }

      const currentCount = await tx.roomUser.count({ where: { roomId } });
      const maxPlayer = room.maxPlayer ?? room.maxPlayers ?? MAX_CUSTOM_PLAYERS;

      if (currentCount >= maxPlayer) {
        throw new Error('ROOM_FULL');
      }

      await tx.roomUser.create({ data: { roomId, userId } });

      const updatedRoom = await tx.room.update({
        where: { id: roomId },
        data: { currentPlayers: currentCount + 1 },
      });

      return updatedRoom;
    });

    return { message: 'User joined the room successfully', room: result };
  } catch (err) {
    const error = err as Error;
    if (error.message === 'ROOM_NOT_FOUND') {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (error.message === 'ROOM_FULL') {
      throw new Error('ROOM_FULL');
    }

    if (error.message === 'NOT_ENOUGH_RINGBALL') {
      throw new Error('NOT_ENOUGH_RINGBALL');
    }

    console.error('💥 Lỗi khi vào phòng:', err);
    throw new Error('Lỗi khi vào phòng');
  }
};

export const leaveRoom = async (roomId: number, userIds: number[]) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.room.findUnique({ where: { id: roomId } });

      if (!existing || existing.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
        throw new Error('ROOM_NOT_FOUND');
      }

      await tx.roomUser.deleteMany({ where: { roomId, userId: { in: userIds } } });
      const remainingPlayers = await tx.roomUser.count({ where: { roomId } });

      if (remainingPlayers === 0) {
        await tx.room.delete({ where: { id: roomId } });
        return { room: existing, remainingPlayers };
      }

      const updated = await tx.room.update({
        where: { id: roomId },
        data: { currentPlayers: remainingPlayers },
      });

      return { room: updated, remainingPlayers };
    });

    if (result.remainingPlayers === 0) {
      await releasePortByRoomName(result.room.roomName);
      await ensureEmptyRooms(MATCH_ROOM_TYPE_GID);
      return { message: 'User left the room and room closed' };
    }

    return { message: 'User left the room successfully' };
  } catch (err) {
    const error = err as Error;
    if (error.message === 'ROOM_NOT_FOUND') {
      throw new Error('ROOM_NOT_FOUND');
    }

    console.error('❌ Lỗi khi rời phòng:', err);
    throw new Error('Lỗi khi rời phòng');
  }
};

export const deleteRoom = async (roomId: number) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (room && room.typeMatchGid === MATCH_ROOM_TYPE_GID) {
    await releasePortByRoomName(room.roomName);
    await ensureEmptyRooms(MATCH_ROOM_TYPE_GID);
  }

  return prisma.room.delete({
    where: { id: roomId },
  });
};

export const getActiveRooms = async () => {
  const rooms = await prisma.room.findMany({
    where: { typeMatchGid: MATCH_ROOM_TYPE_GID },
    include: { _count: { select: { roomUsers: true } } },
  });

  const creatorIds = Array.from(new Set(rooms.map((room) => room.createId)));

  const creators = await prisma.player.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, PlayerName: true },
  });

  const creatorNameMap = new Map(creators.map((player) => [player.id, player.PlayerName]));

  return rooms.map((room) => ({
    ...room,
    createPlayerName: creatorNameMap.get(room.createId) ?? null,
  }));
};

export const updateRoomCreator = async (roomId: number, userId: number) => {
  try {
    const updatedRoom = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId } });

      if (!room || room.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
        throw new Error('ROOM_NOT_FOUND');
      }

      const member = await tx.roomUser.findUnique({ where: { roomId_userId: { roomId, userId } } });

      if (!member) {
        throw new Error('USER_NOT_IN_ROOM');
      }

      return tx.room.update({ where: { id: roomId }, data: { createId: userId } });
    });

    return { message: 'Room creator updated successfully', room: updatedRoom };
  } catch (err) {
    const error = err as Error;
    if (error.message === 'ROOM_NOT_FOUND') {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (error.message === 'USER_NOT_IN_ROOM') {
      throw new Error('USER_NOT_IN_ROOM');
    }

    console.error('❌ Lỗi khi cập nhật createId:', err);
    throw new Error('Lỗi khi cập nhật createId');
  }
};

export const getUserRooms = async (roomId: number) => {
  try {
    const users = await prisma.roomUser.findMany({
      where: { roomId },
      include: {
        player: true,
      },
    });

    return users;
  } catch (err) {
    console.error('❌ Lỗi khi lấy danh sách người dùng trong phòng:', err);
    throw new Error('Không thể lấy danh sách người dùng trong phòng');
  }
};
