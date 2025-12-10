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
  const reusablePort = await prisma.serverPortPool.findFirst({
    where: { isBusy: 0, containerId: null },
    orderBy: { portNo: 'asc' },
  });

  if (reusablePort) {
    return reusablePort.portNo;
  }

  const usedPorts = await prisma.serverPortPool.findMany({ select: { portNo: true } });
  const usedSet = new Set(usedPorts.map((room) => room.portNo));

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
  const startCommand =
    `${baseCommand} ${EXTRA_SERVER_ARGS} --roomName=${roomName} --port=${port}`.trim();

  const { stderr, stdout } = await execPromise(startCommand);
  const stderrLines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const nonIgnorableErrors = stderrLines.filter(
    (line) => !line.startsWith('Emulate Docker CLI using podman. Create /etc/containers/nodocker to quiet msg.'),
  );

  if (nonIgnorableErrors.length > 0) {
    throw new Error(`Docker start error: ${stderr}`);
  }

  const containerId = stdout.trim();
  if (!containerId) {
    throw new Error('Docker start error: missing container id');
  }

  return containerId;
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
  const containerId = await startRoomContainer(roomName, port);

  const poolRecord = await prisma.serverPortPool.upsert({
    where: { portNo: port },
    create: {
      portNo: port,
      isBusy: 0,
      roomNameRef: roomName,
      containerId,
      lastUpdate: new Date(),
    },
    update: {
      isBusy: 0,
      roomNameRef: roomName,
      containerId,
      lastUpdate: new Date(),
    },
  });

  return poolRecord;
}

export async function ensureEmptyRooms() {
  const [totalRooms, emptyRooms] = await Promise.all([
    prisma.serverPortPool.count(),
    prisma.serverPortPool.findMany({
      where: { isBusy: 0, containerId: { not: null } },
      orderBy: { portNo: 'asc' },
    }),
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

  if (!targetRoom) {
    throw new Error('SERVER_CAPACITY_REACHED');
  }

  const room = await prisma.$transaction(async (tx) => {
    const poolRecord = await tx.serverPortPool.findUnique({ where: { portNo: targetRoom.portNo } });

    if (!poolRecord || poolRecord.isBusy !== 0 || !poolRecord.roomNameRef || !poolRecord.containerId) {
      throw new Error('ROOM_NOT_FOUND');
    }

    let roomRecord = await tx.room.findFirst({ where: { roomName: poolRecord.roomNameRef } });

    if (roomRecord && roomRecord.currentPlayers >= roomRecord.maxPlayers) {
      throw new Error('ROOM_FULL');
    }

    if (roomRecord) {
      roomRecord = await tx.room.update({
        where: { id: roomRecord.id },
        data: { currentPlayers: { increment: 1 } },
      });
    } else {
      roomRecord = await tx.room.create({
        data: {
          roomName: poolRecord.roomNameRef,
          maxPlayers: DEFAULT_MAX_PLAYERS,
          currentPlayers: 1,
        },
      });
    }

    await tx.roomUser.upsert({
      where: { roomId_userId: { roomId: roomRecord.id, userId } },
      create: {
        roomId: roomRecord.id,
        userId,
      },
      update: {},
    });

    await tx.serverPortPool.update({
      where: { portNo: poolRecord.portNo },
      data: { isBusy: 1, roomNameRef: roomRecord.roomName, lastUpdate: new Date() },
    });

    return roomRecord;
  });

  await ensureEmptyRooms();

  return { ...room, port: targetRoom.portNo };
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
    const poolRecord = await prisma.serverPortPool.findFirst({ where: { roomNameRef: room.roomName } });
    await stopRoomContainer(room.roomName);

    if (poolRecord) {
      await prisma.serverPortPool.update({
        where: { portNo: poolRecord.portNo },
        data: { isBusy: 0, containerId: null, roomNameRef: null, lastUpdate: new Date() },
      });
    }
  }

  await ensureEmptyRooms();

  return room;
}

export async function leaveRoomAndCleanup(roomId: number) {
  if (!roomId) {
    throw new Error('INVALID_LEAVE_REQUEST');
  }

  const room = await prisma.$transaction(async (tx) => {
    const existing = await tx.room.findUnique({ where: { id: roomId } });

    if (!existing) {
      throw new Error('ROOM_NOT_FOUND');
    }

    await tx.roomUser.deleteMany({ where: { roomId } });
    await tx.room.delete({ where: { id: roomId } });

    return existing;
  });

  const portPool = await prisma.serverPortPool.findFirst({ where: { roomNameRef: room.roomName } });

  if (portPool && portPool.roomNameRef) {
    await stopRoomContainer(portPool.roomNameRef);

    await prisma.serverPortPool.delete({ where: { portNo: portPool.portNo } });
  }

  await ensureEmptyRooms();

  return room;
}

export async function getEmptyRooms() {
  return ensureEmptyRooms();
}

export async function joinUsersToRoomByName(roomName: string, userIds: number[]) {
  if (!roomName) {
    throw new Error('INVALID_ROOM_NAME');
  }

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new Error('INVALID_USER_IDS');
  }

  const portPool = await prisma.serverPortPool.findFirst({ where: { roomNameRef: roomName } });

  if (!portPool || !portPool.containerId) {
    throw new Error('ROOM_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    let roomRecord = await tx.room.findFirst({ where: { roomName } });

    if (!roomRecord) {
      roomRecord = await tx.room.create({
        data: {
          roomName,
          maxPlayers: DEFAULT_MAX_PLAYERS,
          currentPlayers: 0,
        },
      });
    }

    let addedCount = 0;
    const results: Array<{ userId: number; message: string } | { userId: number; error: string }> = [];

    for (const rawId of userIds) {
      const userId = Number(rawId);

      if (!userId) {
        results.push({ userId, error: 'userId is required' });
        continue;
      }

      const alreadyJoined = await tx.roomUser.findUnique({
        where: { roomId_userId: { roomId: roomRecord.id, userId } },
      });

      if (alreadyJoined) {
        results.push({ userId, message: 'User already in room' });
        continue;
      }

      await tx.roomUser.create({
        data: {
          roomId: roomRecord.id,
          userId,
        },
      });

      addedCount += 1;
      results.push({ userId, message: 'Đã gán phòng thành công' });
    }

    if (addedCount > 0) {
      roomRecord = await tx.room.update({
        where: { id: roomRecord.id },
        data: { currentPlayers: { increment: addedCount } },
      });
    }

    await tx.serverPortPool.update({
      where: { portNo: portPool.portNo },
      data: { isBusy: 1, roomNameRef: roomRecord.roomName, lastUpdate: new Date() },
    });

    return { room: { ...roomRecord, port: portPool.portNo }, results };
  });
}
