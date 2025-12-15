import { exec } from 'child_process';
import util from 'util';
import prisma from '../models/prismaClient';

const execPromise = util.promisify(exec);

const PORT_RANGE_START = Number(process.env.ROOM_PORT_START) || 27015;
const PORT_RANGE_END = Number(process.env.ROOM_PORT_END) || 27100;
const DOCKER_RUNTIME = process.env.DOCKER_BIN || 'docker';
const DOCKER_IMAGE = process.env.ROOM_DOCKER_IMAGE || 'banculi/unity-dedicated:latest';
const SERVER_PORT_IN_CONTAINER = Number(process.env.ROOM_CONTAINER_PORT) || 27015;
const EXTRA_SERVER_ARGS =
  process.env.ROOM_SERVER_ARGS || '-batchmode -nographics -dedicatedServer 1 -logfile -';

const MATCH_ROOM_TYPE_GID = 10000003;
const MIN_CUSTOM_PLAYERS = 2;
const MAX_CUSTOM_PLAYERS = 3;

function buildContainerName(roomName: string): string {
  return `banculi-room-${roomName}`;
}

function buildSessionProperties(typeMatchGid: number) {
  return `MatchRoom=${typeMatchGid}`;
}

async function startRoomContainer(roomName: string, port: number, sessionProperties: string) {
  const containerName = buildContainerName(roomName);
  const baseCommand = `${DOCKER_RUNTIME} run -d --rm --name ${containerName} -p ${port}:${SERVER_PORT_IN_CONTAINER} ${DOCKER_IMAGE}`;
  const startCommand =
    `${baseCommand} -e SessionProperties=${sessionProperties} ${EXTRA_SERVER_ARGS} --roomName=${roomName} --port=${port}`.trim();

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
    console.error(`Không thể dừng container ${containerName}:`, error);
  }
}

async function findReusablePort() {
  const reusable = await prisma.serverPortPool.findFirst({
    where: { isBusy: 0, containerId: null },
    orderBy: { portNo: 'asc' },
  });

  return reusable?.portNo ?? null;
}

async function findNewPort() {
  const usedPorts = await prisma.serverPortPool.findMany({ select: { portNo: true } });
  const usedSet = new Set(usedPorts.map((item) => item.portNo));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 1) {
    if (!usedSet.has(port)) {
      return port;
    }
  }

  return null;
}

async function allocatePort(roomName: string, typeMatchGid: number, sessionProperties: string) {
  const port = (await findReusablePort()) ?? (await findNewPort());

  if (!port) {
    throw new Error('NO_AVAILABLE_PORT');
  }

  const containerId = await startRoomContainer(roomName, port, sessionProperties);

  await prisma.serverPortPool.upsert({
    where: { portNo: port },
    create: {
      portNo: port,
      isBusy: 1,
      roomNameRef: roomName,
      containerId,
      lastUpdate: new Date(),
      typeMatchGid,
    },
    update: {
      isBusy: 1,
      roomNameRef: roomName,
      containerId,
      lastUpdate: new Date(),
      typeMatchGid,
    },
  });

  return { port, containerId };
}

async function releasePortByRoomName(roomName: string) {
  const portRecord = await prisma.serverPortPool.findFirst({ where: { roomNameRef: roomName } });

  if (!portRecord) {
    return;
  }

  if (portRecord.containerId || portRecord.roomNameRef) {
    await stopRoomContainer(portRecord.roomNameRef ?? roomName);
  }

  await prisma.serverPortPool.update({
    where: { portNo: portRecord.portNo },
    data: { isBusy: 0, containerId: null, roomNameRef: null, lastUpdate: new Date(), typeMatchGid: null },
  });
}

export const createRoom = async (data: { roomName: string; userId: number; bet?: number; maxPlayer?: number }) => {
  const { roomName, userId, bet = 0, maxPlayer } = data;

  if (!roomName?.trim()) {
    throw new Error('roomName is required');
  }

  if (!userId) {
    throw new Error('userId is required');
  }

  const normalizedRoomName = roomName.trim();
  const targetMaxPlayer = Math.min(Math.max(maxPlayer ?? MIN_CUSTOM_PLAYERS, MIN_CUSTOM_PLAYERS), MAX_CUSTOM_PLAYERS);
  const sessionProperties = buildSessionProperties(MATCH_ROOM_TYPE_GID);

  const { port } = await allocatePort(normalizedRoomName, MATCH_ROOM_TYPE_GID, sessionProperties);

  try {
    const room = await prisma.room.create({
      data: {
        roomName: normalizedRoomName,
        maxPlayers: targetMaxPlayer,
        maxPlayer: targetMaxPlayer,
        currentPlayers: 1,
        bet,
        createId: userId,
        createDate: new Date(),
        typeMatchGid: MATCH_ROOM_TYPE_GID,
      },
    });

    await prisma.roomUser.create({
      data: { roomId: room.id, userId, joinedAt: new Date() },
    });

    return { message: 'Room created', roomId: room.id, roomName: room.roomName, port };
  } catch (err) {
    await releasePortByRoomName(normalizedRoomName);
    const error = err as Error;
    throw new Error(error.message || 'Something went wrong creating room');
  }
};

export const joinRoom = async (roomId: number, userId: number) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({ where: { id: roomId } });

      if (!room || room.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
        throw new Error('ROOM_NOT_FOUND');
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

    console.error('💥 Lỗi khi vào phòng:', err);
    throw new Error('Lỗi khi vào phòng');
  }
};

export const leaveRoom = async (roomId: number, userId: number) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.room.findUnique({ where: { id: roomId } });

      if (!existing || existing.typeMatchGid !== MATCH_ROOM_TYPE_GID) {
        throw new Error('ROOM_NOT_FOUND');
      }

      await tx.roomUser.deleteMany({ where: { roomId, userId } });
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
  }

  return prisma.room.delete({
    where: { id: roomId },
  });
};

export const getActiveRooms = async () => {
  return prisma.room.findMany({
    where: { typeMatchGid: MATCH_ROOM_TYPE_GID },
    include: { _count: { select: { roomUsers: true } } },
  });
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
