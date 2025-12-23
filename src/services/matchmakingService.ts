import { exec } from 'child_process';
import util from 'util';
import crypto from 'crypto';
import net from 'net';
import dgram from 'dgram';
import { Prisma } from '@prisma/client';
import prisma from '../models/prismaClient';
import { TypeMatchGid } from '../config/typeMatchGid';

const execPromise = util.promisify(exec);

const PORT_RANGE_START = Number(process.env.ROOM_PORT_START) || 27015;
const PORT_RANGE_END = Number(process.env.ROOM_PORT_END) || 27100;
export const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 20;
export const MIN_EMPTY_ROOMS = Number(process.env.MIN_EMPTY_ROOMS) || 2;
const DEFAULT_MAX_PLAYERS = Number(process.env.ROOM_MAX_PLAYERS) || 4;
const DOCKER_RUNTIME = process.env.DOCKER_BIN || 'docker';
const DOCKER_IMAGE = process.env.ROOM_DOCKER_IMAGE || 'banculi/unity-dedicated:latest';
const SERVER_PORT_IN_CONTAINER = Number(process.env.ROOM_CONTAINER_PORT) || 27015;
const EXTRA_SERVER_ARGS =
  process.env.ROOM_SERVER_ARGS || '-batchmode -nographics -dedicatedServer 1 -logfile -';
const DEFAULT_MATCH_TYPE_GID = TypeMatchGid.MatchRandomNormal;
const RANK_MATCH_TYPE_GID = TypeMatchGid.MatchRandomRank;

let portAllocationLock: Promise<void> = Promise.resolve();

async function withPortAllocationLock<T>(fn: () => Promise<T>): Promise<T> {
  let release: () => void;

  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });

  const previous = portAllocationLock;
  portAllocationLock = portAllocationLock.then(() => ready);

  await previous;

  try {
    return await fn();
  } finally {
    release!();
  }
}

function buildSessionProperties(typeMatchGid: number) {
  return `MatchRoom=${typeMatchGid}`;
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tcpTester = net.createServer();
    const udpTester = dgram.createSocket('udp4');

    let tcpReady = false;
    let udpReady = false;
    let resolved = false;

    const tryResolve = () => {
      if (resolved) return;

      if (tcpReady && udpReady) {
        resolved = true;
        resolve(true);
      }
    };

    const fail = () => {
      if (resolved) return;
      resolved = true;
      tcpTester.close();
      udpTester.close();
      resolve(false);
    };

    tcpTester.once('error', fail).once('listening', () => {
      tcpReady = true;
      tcpTester.close(() => tryResolve());
    });

    udpTester.once('error', fail).once('listening', () => {
      udpReady = true;
      udpTester.close(() => tryResolve());
    });

    tcpTester.listen(port, '0.0.0.0');
    udpTester.bind(port, '0.0.0.0');
  });
}

async function getAvailablePort(typeMatchGid: number): Promise<number | null> {
  const reusablePort = await prisma.serverPortPool.findFirst({
    where: { isBusy: 0, containerId: null, typeMatchGid },
    orderBy: { portNo: 'asc' },
  });

  if (reusablePort) {
    const portIsFree = await isPortAvailable(reusablePort.portNo);
    if (portIsFree) {
      return reusablePort.portNo;
    }

    await prisma.serverPortPool.update({
      where: { portNo: reusablePort.portNo },
      data: { isBusy: 1, lastUpdate: new Date() },
    });
  }

  const usedPorts = await prisma.serverPortPool.findMany({ select: { portNo: true } });
  const usedSet = new Set(usedPorts.map((room) => room.portNo));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port += 1) {
    if (usedSet.has(port)) {
      continue;
    }

    // Đảm bảo cổng chưa bị chiếm dụng ở tầng hệ điều hành
    // để tránh trùng cổng khi tạo container mới
    // (vd: container cũ chưa được ghi nhận trong cơ sở dữ liệu).
    // eslint-disable-next-line no-await-in-loop
    const portIsFree = await isPortAvailable(port);
    if (portIsFree) {
      return port;
    }
  }

  return null;
}

function buildContainerName(roomName: string): string {
  return `banculi-room-${roomName}`;
}

async function startRoomContainer(roomName: string, port: number, sessionProperties?: string) {
  const containerName = buildContainerName(roomName);
  const sessionPropertyEnv = sessionProperties ? `-e SessionProperties="${sessionProperties}"` : '';
 // const portBindings = `-p ${port}:${SERVER_PORT_IN_CONTAINER} -p ${port}:${SERVER_PORT_IN_CONTAINER}/udp`;
 //const portBindings = `-p ${port}:${SERVER_PORT_IN_CONTAINER}`;
 const portBindings = `-p ${port}:${SERVER_PORT_IN_CONTAINER}/udp`;
  const startCommand =
    `${DOCKER_RUNTIME} run -d --rm --name ${containerName} ${portBindings} ${sessionPropertyEnv} ${DOCKER_IMAGE} ${EXTRA_SERVER_ARGS} --roomName=${roomName} --port=${port}`.trim();

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

async function stopContainerById(containerId: string) {
  try {
    await execPromise(`${DOCKER_RUNTIME} stop ${containerId}`);
  } catch (error) {
    console.error(`Không thể dừng container ${containerId}:`, error);
  }
}

export async function resetServerPortPoolIfIdle() {
  const serverPool = await prisma.serverPortPool.findMany();

  if (serverPool.length === 0) {
    return false;
  }

  const hasBusyRoom = serverPool.some((record) => record.isBusy !== 0);
  if (hasBusyRoom) {
    return false;
  }

  for (const record of serverPool) {
    if (record.containerId) {
      // eslint-disable-next-line no-await-in-loop
      await stopContainerById(record.containerId);
      continue;
    }

    if (record.roomNameRef) {
      // eslint-disable-next-line no-await-in-loop
      await stopRoomContainer(record.roomNameRef);
    }
  }

  await prisma.serverPortPool.deleteMany();

  return true;
}

export async function shutdownAllServersIfIdle() {
  const serverPool = await prisma.serverPortPool.findMany();

  if (serverPool.length === 0) {
    return { deletedRecords: 0, stoppedContainers: 0 };
  }

  const busyRecords = serverPool.filter((record) => record.isBusy == 2);
  if (busyRecords.length > 0) {
    throw new Error('SERVERS_BUSY');
  }

  const roomNames = Array.from(
    new Set(
      serverPool
        .map((record) => record.roomNameRef)
        .filter((roomName): roomName is string => Boolean(roomName)),
    ),
  );
  let stoppedContainers = 0;

  for (const record of serverPool) {
    if (record.containerId) {
      // eslint-disable-next-line no-await-in-loop
      await stopContainerById(record.containerId);
      stoppedContainers += 1;
      continue;
    }

    if (record.roomNameRef) {
      // eslint-disable-next-line no-await-in-loop
      await stopRoomContainer(record.roomNameRef);
      stoppedContainers += 1;
    }
  }

  if (roomNames.length > 0) {
    const rooms = await prisma.room.findMany({
      where: { roomName: { in: roomNames } },
      select: { id: true },
    });

    const roomIds = rooms.map((room) => room.id);

    if (roomIds.length > 0) {
      await prisma.roomUser.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    }
  }

  const deleteResult = await prisma.serverPortPool.deleteMany();

  return { deletedRecords: deleteResult.count, stoppedContainers };
}

export async function shutdownTestServer(typeMatchGid: number = TypeMatchGid.MatchRandomRank) {
  const records = await prisma.serverPortPool.findMany({ where: { typeMatchGid } });

  if (records.length === 0) {
    return { deletedRecords: 0, stoppedContainers: 0 };
  }

  const busyRecords = records.filter((record) => record.isBusy === 2);
  if (busyRecords.length > 0) {
    throw new Error('TEST_SERVER_BUSY');
  }

  const roomNames = Array.from(
    new Set(records.map((record) => record.roomNameRef).filter((roomName): roomName is string => Boolean(roomName))),
  );
  let stoppedContainers = 0;

  for (const record of records) {
    if (record.containerId) {
      // eslint-disable-next-line no-await-in-loop
      await stopContainerById(record.containerId);
      stoppedContainers += 1;
      continue;
    }

    if (record.roomNameRef) {
      // eslint-disable-next-line no-await-in-loop
      await stopRoomContainer(record.roomNameRef);
      stoppedContainers += 1;
    }
  }

  if (roomNames.length > 0) {
    const rooms = await prisma.room.findMany({
      where: { roomName: { in: roomNames } },
      select: { id: true },
    });

    const roomIds = rooms.map((room) => room.id);
    if (roomIds.length > 0) {
      await prisma.roomUser.deleteMany({ where: { roomId: { in: roomIds } } });
      await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    }
  }

  const deleteResult = await prisma.serverPortPool.deleteMany({ where: { typeMatchGid } });

  return { deletedRecords: deleteResult.count, stoppedContainers };
}

export async function ensureSingleTestServer(typeMatchGid: number = TypeMatchGid.MatchRandomRank) {
  const filter: Prisma.ServerPortPoolWhereInput = {
    typeMatchGid,
    containerId: { not: '' },
    roomNameRef: { not: '' },
  };

  const [existingRooms, emptyRooms] = await Promise.all([
    prisma.serverPortPool.findMany({ where: filter, orderBy: { portNo: 'asc' } }),
    prisma.serverPortPool.findMany({ where: { isBusy: 0, ...filter }, orderBy: { portNo: 'asc' } }),
  ]);

  if (existingRooms.length > 0) {
    if (emptyRooms.length === 0) {
      throw new Error('TEST_SERVER_BUSY');
    }

    return { created: false, rooms: emptyRooms } as const;
  }

  const room = await createEmptyRoom(typeMatchGid);
  return { created: true, rooms: [room] } as const;
}

async function createEmptyRoom(typeMatchGid: number) {
  return withPortAllocationLock(async () => {
    const port = await getAvailablePort(typeMatchGid);
    if (!port) {
      throw new Error('NO_AVAILABLE_PORT');
    }

    const roomName = crypto.randomUUID();
    const containerId = await startRoomContainer(roomName, port, buildSessionProperties(typeMatchGid));

    const poolRecord = await prisma.serverPortPool.upsert({
      where: { portNo: port },
      create: {
        portNo: port,
        isBusy: 0,
        roomNameRef: roomName,
        containerId,
        lastUpdate: new Date(),
        typeMatchGid,
      },
      update: {
        isBusy: 0,
        roomNameRef: roomName,
        containerId,
        lastUpdate: new Date(),
        typeMatchGid,
      },
    });

    return poolRecord;
  });
}

export async function ensureEmptyRooms(
  typeMatchGid: number = DEFAULT_MATCH_TYPE_GID,
  minEmptyRooms: number = MIN_EMPTY_ROOMS,
) {
  const filter: Prisma.ServerPortPoolWhereInput = {
    typeMatchGid,
    containerId: { not: '' },
    roomNameRef: { not: '' },
 
  };

  const [totalRooms, emptyRooms] = await Promise.all([
    prisma.serverPortPool.count({ where: filter }),
    prisma.serverPortPool.findMany({
      where: { isBusy: 0, ...filter },
      orderBy: { portNo: 'asc' },
    }),
  ]);

  if (emptyRooms.length >= minEmptyRooms) {
    return emptyRooms;
  }

  const availableSlots = MAX_ROOMS - totalRooms;
  const needToCreate = Math.min(minEmptyRooms - emptyRooms.length, availableSlots);

  if (needToCreate <= 0) {
    throw new Error('SERVER_CAPACITY_REACHED');
  }

  const createdRooms = [] as typeof emptyRooms;
  for (let i = 0; i < needToCreate; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const room = await createEmptyRoom(typeMatchGid);
    createdRooms.push(room);
  }

  return [...emptyRooms, ...createdRooms];
}

export async function assignRoomToPlayer(userId: number, typeMatchGid: number = DEFAULT_MATCH_TYPE_GID) {
  if (!userId) {
    throw new Error('INVALID_USER');
  }

  const availableRooms = await ensureEmptyRooms(typeMatchGid);
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
          createId: userId,
          typeMatchGid,
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
      data: { isBusy: 1, roomNameRef: roomRecord.roomName, lastUpdate: new Date(), typeMatchGid },
    });

    return roomRecord;
  });

  await ensureEmptyRooms(typeMatchGid);

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

  let poolRecordForCleanup: { typeMatchGid: number } | null = null;

  if (room.currentPlayers <= 0) {
    const poolRecord = await prisma.serverPortPool.findFirst({ where: { roomNameRef: room.roomName } });
    poolRecordForCleanup = poolRecord ? { typeMatchGid: poolRecord.typeMatchGid } : null;
    await stopRoomContainer(room.roomName);

    if (poolRecord) {
      await prisma.serverPortPool.update({
        where: { portNo: poolRecord.portNo },
        data: {
          isBusy: 0,
          containerId: null,
          roomNameRef: null,
          lastUpdate: new Date(),
          typeMatchGid: poolRecord.typeMatchGid,
        },
      });
    }
  }

  const typeMatchGid = poolRecordForCleanup?.typeMatchGid ?? room.typeMatchGid ?? DEFAULT_MATCH_TYPE_GID;
  await ensureEmptyRooms(typeMatchGid);

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

  const typeMatchGid = room.typeMatchGid ?? DEFAULT_MATCH_TYPE_GID;
  await ensureEmptyRooms(typeMatchGid);

  return room;
}

export async function getEmptyRooms() {
  return ensureEmptyRooms();
}

export async function joinUsersToRoomByName(roomName: string, userIds: number[], mapId?: number) {
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
      const creatorId = Number(userIds[0]) || 0;
      roomRecord = await tx.room.create({
        data: {
          roomName,
          maxPlayers: DEFAULT_MAX_PLAYERS,
          currentPlayers: 0,
          createId: creatorId,
          typeMatchGid: portPool.typeMatchGid ?? DEFAULT_MATCH_TYPE_GID,
          mapId: mapId ?? 0,
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
      data: {
        isBusy: 1,
        roomNameRef: roomRecord.roomName,
        lastUpdate: new Date(),
        typeMatchGid: portPool.typeMatchGid ?? undefined,
      },
    });

    return { room: { ...roomRecord, port: portPool.portNo }, results };
  });
}

export async function findRoomByPlayerId(playerId: number) {
  if (!playerId) {
    throw new Error('INVALID_USER');
  }

  const roomUser = await prisma.roomUser.findFirst({
    where: { userId: playerId },
    include: { room: true },
    orderBy: { joinedAt: 'desc' },
  });

  if (!roomUser || !roomUser.room) {
    return null;
  }

  return { roomUser, room: roomUser.room };
}
