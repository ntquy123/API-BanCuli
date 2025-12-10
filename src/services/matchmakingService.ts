import { exec } from 'child_process';
import util from 'util';
import crypto from 'crypto';
import prisma from '../models/prismaClient';

const execPromise = util.promisify(exec);

const PORT_RANGE_START = Number(process.env.ROOM_PORT_START) || 27015;
const PORT_RANGE_END = Number(process.env.ROOM_PORT_END) || 27100;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 20;
const MIN_EMPTY_ROOMS = Number(process.env.MIN_EMPTY_ROOMS) || 2;
const DEFAULT_MAX_PLAYERS = Number(process.env.ROOM_MAX_PLAYERS) || 4;
const DOCKER_RUNTIME = process.env.DOCKER_BIN || 'docker';
const DOCKER_IMAGE = process.env.ROOM_DOCKER_IMAGE || 'banculi/unity-dedicated:latest';
const SERVER_PORT_IN_CONTAINER = Number(process.env.ROOM_CONTAINER_PORT) || 27015;
const EXTRA_SERVER_ARGS =
  process.env.ROOM_SERVER_ARGS || '-batchmode -nographics -dedicatedServer 1 -logfile -';

async function getAvailablePort(): Promise<number | null> {
  const usedPorts = await prisma.room.findMany({ select: { port: true } });
  const usedSet = new Set(usedPorts.map((room) => room.port));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 1) {
    if (!usedSet.has(port)) {
      return port;
    }
  }

  return null;
}

function buildContainerName(roomName: string): string {
  return `banculi-room-${roomName}`;
}

async function startRoomContainer(roomName: string, port: number) {
  const containerName = buildContainerName(roomName);
  const baseCommand = `${DOCKER_RUNTIME} run -d --rm --name ${containerName} -p ${port}:${SERVER_PORT_IN_CONTAINER} ${DOCKER_IMAGE}`;
  const startCommand = `${baseCommand} ${EXTRA_SERVER_ARGS}`.trim();

  const { stderr } = await execPromise(startCommand);
  if (stderr) {
    throw new Error(`Docker start error: ${stderr}`);
  }
}

async function stopRoomContainer(roomName: string) {
  const containerName = buildContainerName(roomName);
  try {
    await execPromise(`${DOCKER_RUNTIME} stop ${containerName}`);
  } catch (error) {
    // Không throw lỗi để không chặn luồng leaveRoom; chỉ log lại
    console.error(`Không thể dừng container ${containerName}:`, error);
  }
}

async function createEmptyRoom() {
  const port = await getAvailablePort();
  if (!port) {
    throw new Error('NO_AVAILABLE_PORT');
  }

  const roomName = crypto.randomUUID();

  const room = await prisma.room.create({
    data: {
      roomName,
      port,
      maxPlayers: DEFAULT_MAX_PLAYERS,
      currentPlayers: 0,
    },
  });

  try {
    await startRoomContainer(room.roomName, port);
    return room;
  } catch (error) {
    await prisma.room.delete({ where: { id: room.id } });
    throw error;
  }
}

export async function ensureEmptyRooms() {
  const [totalRooms, emptyRooms] = await Promise.all([
    prisma.room.count(),
    prisma.room.findMany({ where: { currentPlayers: 0 }, orderBy: { id: 'asc' } }),
  ]);

  if (emptyRooms.length >= MIN_EMPTY_ROOMS) {
    return emptyRooms;
  }

  const availableSlots = MAX_ROOMS - totalRooms;
  const needToCreate = Math.min(MIN_EMPTY_ROOMS - emptyRooms.length, availableSlots);

  if (needToCreate <= 0) {
    throw new Error('SERVER_CAPACITY_REACHED');
  }

  const createdRooms = [] as typeof emptyRooms;
  for (let i = 0; i < needToCreate; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const room = await createEmptyRoom();
    createdRooms.push(room);
  }

  return [...emptyRooms, ...createdRooms];
}

export async function assignRoomToPlayer(userId: number) {
  if (!userId) {
    throw new Error('INVALID_USER');
  }

  const availableRooms = await ensureEmptyRooms();
  const targetRoom = availableRooms[0];

  const room = await prisma.$transaction(async (tx) => {
    const roomRecord = await tx.room.findUnique({ where: { id: targetRoom.id } });
    if (!roomRecord) {
      throw new Error('ROOM_NOT_FOUND');
    }

    if (roomRecord.currentPlayers >= roomRecord.maxPlayers) {
      throw new Error('ROOM_FULL');
    }

    await tx.roomUser.upsert({
      where: { roomId_userId: { roomId: roomRecord.id, userId } },
      create: {
        roomId: roomRecord.id,
        userId,
      },
      update: {},
    });

    const updatedRoom = await tx.room.update({
      where: { id: roomRecord.id },
      data: { currentPlayers: { increment: 1 } },
    });

    return updatedRoom;
  });

  await ensureEmptyRooms();

  return room;
}

export async function leaveRoom(roomId: number, userId: number) {
  if (!roomId || !userId) {
    throw new Error('INVALID_LEAVE_REQUEST');
  }

  const room = await prisma.$transaction(async (tx) => {
    await tx.roomUser.deleteMany({ where: { roomId, userId } });

    const existing = await tx.room.findUnique({ where: { id: roomId } });
    if (!existing) {
      throw new Error('ROOM_NOT_FOUND');
    }

    const nextCount = Math.max(existing.currentPlayers - 1, 0);

    if (nextCount === 0) {
      await tx.room.delete({ where: { id: roomId } });
      return existing;
    }

    const updated = await tx.room.update({
      where: { id: roomId },
      data: { currentPlayers: nextCount },
    });

    return updated;
  });

  if (room.currentPlayers <= 0) {
    await stopRoomContainer(room.roomName);
  }

  await ensureEmptyRooms();

  return room;
}

export async function getEmptyRooms() {
  return ensureEmptyRooms();
}
