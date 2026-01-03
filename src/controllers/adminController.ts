import { RequestHandler } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '../models/prismaClient';
import { buildWarmPoolSummary } from '../services/orchestratorWarmPool';
import { DockerOrchestrator } from '../services/orchestrator';
import { fetchContainerLogs, listRunningContainers } from '../services/dockerService';
import { AdminTokenPayload, createAdminToken } from '../middleware/adminAuth';
const parseTypeMatchGid = (value: unknown) => {
  const typeMatchGid = Number(value);
  if (!Number.isInteger(typeMatchGid)) {
    return { error: 'TypeMatchGid không hợp lệ.' } as const;
  }
  return { typeMatchGid } as const;
};

const DEFAULT_REGION = process.env.DEFAULT_REGION || 'asia';

export const loginAdmin: RequestHandler = async (req, res) => {
  const { friendCode } = req.body as { friendCode?: unknown };

  if (typeof friendCode !== 'string' || friendCode.trim() === '') {
    res.status(400).json({ error: 'Vui lòng nhập friendCode hợp lệ.' });
    return;
  }

  const normalizedFriendCode = friendCode.trim();

  try {
    const player = await prisma.player.findFirst({
      where: {
        friendCode: normalizedFriendCode,
        ProviderType: 'System',
      },
    });

    if (!player) {
      res.status(401).json({ error: 'FriendCode không tồn tại hoặc không phải tài khoản hệ thống.' });
      return;
    }

    const token = createAdminToken({
      friendCode: player.friendCode,
      playerId: player.id,
      providerType: player.ProviderType ?? null,
      issuedAt: Date.now(),
    });

    res.json({
      token,
      player: {
        id: player.id,
        friendCode: player.friendCode,
        name: player.PlayerName ?? 'System Admin',
      },
    });
  } catch (error) {
    console.error('Lỗi khi đăng nhập admin:', error);
    res.status(500).json({ error: 'Không thể đăng nhập, vui lòng thử lại.' });
  }
};

export const getAdminSession: RequestHandler = async (_req, res) => {
  const admin = res.locals.admin as AdminTokenPayload | undefined;
  res.json({ admin });
};

export const startServers: RequestHandler = async (_req, res) => {
  try {
    const summary = await buildWarmPoolSummary();
    res.json({
      message: 'Đã bật/tăng nhiệt server và phòng chờ.',
      ...summary,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Docker start error')) {
      res.status(500).json({ error: 'Không thể khởi động container phòng.', detail: error.message });
      return;
    }

    if (error instanceof Error && error.message === 'DOCKER_NOT_AVAILABLE') {
      res.status(503).json({ error: 'Docker chưa sẵn sàng để khởi động server.' });
      return;
    }

    console.error('Lỗi khi bật server:', error);
    res.status(500).json({ error: 'Không thể bật server.' });
  }
};

export const startTestServer: RequestHandler = async (req, res) => {
  const parsed = parseTypeMatchGid(req.query?.typeMatchGid);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const region = typeof req.query?.region === 'string' && req.query.region.trim()
      ? req.query.region.trim()
      : DEFAULT_REGION;

    const containers = await DockerOrchestrator.listManagedContainers({ region });
    const sameType = containers.filter(
      (container) => container.labels.typeMatchGid === String(parsed.typeMatchGid),
    );
    const idleContainers = sameType.filter((container) => container.labels.mode === 'IDLE');
    const busyContainers = sameType.filter((container) => container.labels.mode === 'MATCH');

    if (busyContainers.length > 0 && idleContainers.length === 0) {
      res.status(409).json({ error: 'Phòng test đang bận, vui lòng thử lại sau khi trống.' });
      return;
    }

    let created = false;
    if (idleContainers.length === 0) {
      await DockerOrchestrator.startDedicatedServer({
        mode: 'IDLE',
        region,
        typeMatchGid: parsed.typeMatchGid,
      });
      created = true;
    }

    res.json({
      message: created
        ? `Đã bật server test (1 phòng trống) với TypeMatchGid = ${parsed.typeMatchGid}.`
        : `Server test đã sẵn sàng với TypeMatchGid = ${parsed.typeMatchGid}.`,
      typeMatchGid: parsed.typeMatchGid,
      region,
      created,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Docker start error')) {
      res
        .status(500)
        .json({ error: 'Không thể khởi động container server test.', detail: error.message });
      return;
    }

    if (error instanceof Error && error.message === 'DOCKER_NOT_AVAILABLE') {
      res.status(503).json({ error: 'Docker chưa sẵn sàng để khởi động server test.' });
      return;
    }

    console.error('Lỗi khi bật server test:', error);
    res.status(500).json({ error: 'Không thể bật server test.' });
  }
};

export const shutdownServersAdmin: RequestHandler = async (_req, res) => {
  try {
    const activeMatches = await DockerOrchestrator.listManagedContainers({ mode: 'MATCH' });
    if (activeMatches.length > 0) {
      res.status(400).json({ error: 'Không thể tắt server khi vẫn còn phòng đang bận' });
      return;
    }

    const idleContainers = await DockerOrchestrator.listManagedContainers({ mode: 'IDLE' });
    const stopResults = await Promise.all(
      idleContainers.map((container) => DockerOrchestrator.tryStopContainerById(container.id)),
    );

    const result = {
      stoppedContainers: stopResults.filter(Boolean).length,
    };
    res.json({
      message: 'Đã dừng toàn bộ warm pool server',
      ...result,
    });
  } catch (error) {
    console.error('Lỗi khi tắt server:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể tắt server', detail });
  }
};

export const shutdownTestServerController: RequestHandler = async (req, res) => {
  const parsed = parseTypeMatchGid(req.body?.typeMatchGid);
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  try {
    const region = typeof req.body?.region === 'string' && req.body.region.trim()
      ? req.body.region.trim()
      : DEFAULT_REGION;

    const containers = await DockerOrchestrator.listManagedContainers({ region });
    const sameType = containers.filter(
      (container) => container.labels.typeMatchGid === String(parsed.typeMatchGid),
    );
    const busyContainers = sameType.filter((container) => container.labels.mode === 'MATCH');
    if (busyContainers.length > 0) {
      res.status(400).json({ error: 'Không thể tắt server test khi phòng đang bận.' });
      return;
    }

    const idleContainers = sameType.filter((container) => container.labels.mode === 'IDLE');
    const stopResults = await Promise.all(
      idleContainers.map((container) => DockerOrchestrator.tryStopContainerById(container.id)),
    );
    const result = {
      deletedRecords: stopResults.filter(Boolean).length,
      stoppedContainers: stopResults.filter(Boolean).length,
    };
    res.json({
      message:
        result.deletedRecords > 0
          ? `Đã tắt server test TypeMatchGid = ${parsed.typeMatchGid} (${region}).`
          : `Không có server test TypeMatchGid = ${parsed.typeMatchGid} nào đang chạy.`,
      typeMatchGid: parsed.typeMatchGid,
      region,
      ...result,
    });
  } catch (error) {
    console.error('Lỗi khi tắt server test:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể tắt server test.', detail });
  }
};

export const getReadmeContent: RequestHandler = async (_req, res) => {
  const readmePath = path.join(process.cwd(), 'ReadMe');

  try {
    const content = await fs.readFile(readmePath, 'utf8');
    res.json({ content });
  } catch (error) {
    console.error('Lỗi khi đọc ReadMe:', error);
    res.status(404).json({ error: 'Không tìm thấy nội dung ReadMe.' });
  }
};

export const getActiveContainers: RequestHandler = async (_req, res) => {
  try {
    const containers = await listRunningContainers();
    const parseUdpPorts = (ports: string): number[] => {
      if (!ports) return [];
      return ports
        .split(',')
        .map((segment) => segment.trim())
        .filter((segment) => segment.includes('/udp'))
        .map((segment) => {
          if (segment.includes('->')) {
            const [hostPart] = segment.split('->');
            const hostPortMatch = hostPart.trim().match(/:(\d+)$/);
            const portNo = hostPortMatch ? Number(hostPortMatch[1]) : Number.NaN;
            return Number.isFinite(portNo) ? portNo : null;
          }

          const directMatch = segment.match(/(\d+)\/udp$/);
          const portNo = directMatch ? Number(directMatch[1]) : Number.NaN;
          return Number.isFinite(portNo) ? portNo : null;
        })
        .filter((portNo): portNo is number => portNo !== null);
    };

    const containerUdpPorts = containers.map((container) => ({
      container,
      udpPorts: parseUdpPorts(container.ports),
    }));

    const portNos = [
      ...new Set(containerUdpPorts.flatMap(({ udpPorts }) => udpPorts).filter((portNo) => portNo)),
    ];

    const portPools = portNos.length
      ? await prisma.serverPortPool.findMany({
          where: { portNo: { in: portNos } },
          select: {
            portNo: true,
            isBusy: true,
            roomNameRef: true,
            typeMatchGid: true,
          },
        })
      : [];

    const typeMatchGids = [...new Set(portPools.map((pool) => pool.typeMatchGid))];
    const roomNameRefs = [...new Set(portPools.map((pool) => pool.roomNameRef).filter(Boolean))];

    const [generalTypes, rooms] = await Promise.all([
      typeMatchGids.length
        ? prisma.sysMasGeneral.findMany({
            where: { GenCode: { in: typeMatchGids } },
            select: { GenCode: true, GenName: true },
          })
        : Promise.resolve([]),
      roomNameRefs.length
        ? prisma.room.findMany({
            where: { roomName: { in: roomNameRefs } },
            select: { roomName: true },
          })
        : Promise.resolve([]),
    ]);

    const portPoolMap = new Map<number, (typeof portPools)[number]>();
    portPools.forEach((pool) => {
      portPoolMap.set(pool.portNo, pool);
    });

    const typeMap = new Map(generalTypes.map((type) => [type.GenCode, type.GenName]));
    const roomNameSet = new Set(rooms.map((room) => room.roomName));

    const enhancedContainers = containerUdpPorts.map(({ container, udpPorts }) => {
      const pool = udpPorts.map((portNo) => portPoolMap.get(portNo)).find(Boolean);
      const roomTypeName = pool ? typeMap.get(pool.typeMatchGid) ?? 'Không có trong config' : 'Không có data pool';
      const isBusy = pool ? pool.isBusy === 1 : null;
      const hasStarted = pool?.roomNameRef ? roomNameSet.has(pool.roomNameRef) : false;

      return {
        ...container,
        roomTypeName,
        isBusy,
        hasStarted,
        typeMatchGid: pool?.typeMatchGid ?? null,
        roomNameRef: pool?.roomNameRef ?? null,
      };
    });

    res.json({ containers: enhancedContainers });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách docker đang chạy:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể lấy danh sách docker đang chạy.', detail });
  }
};

export const getContainerLogs: RequestHandler = async (req, res) => {
  const containerId = req.params.id;
  const tail = Number.parseInt((req.query.tail as string) ?? '200', 10);

  if (!containerId) {
    res.status(400).json({ error: 'Thiếu containerId để xem log.' });
    return;
  }

  try {
    const logs = await fetchContainerLogs(containerId, tail);
    res.json({ logs });
  } catch (error) {
    console.error(`Lỗi khi lấy log cho container ${containerId}:`, error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể lấy log container.', detail });
  }
};
