import { RequestHandler } from 'express';
import prisma from '../models/prismaClient';
import { buildWarmupSummary } from '../utils/matchmakingWarmup';
import {
  ensureSingleTestServer,
  shutdownAllServersIfIdle,
  shutdownTestServer,
} from '../services/matchmakingService';
import { fetchContainerLogs, listRunningContainers } from '../services/dockerService';
import { AdminTokenPayload, createAdminToken } from '../middleware/adminAuth';
import { TypeMatchGid } from '../config/typeMatchGid';

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
    const summary = await buildWarmupSummary();
    res.json({
      message: 'Đã bật/tăng nhiệt server và phòng chờ.',
      ...summary,
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

    console.error('Lỗi khi bật server:', error);
    res.status(500).json({ error: 'Không thể bật server.' });
  }
};

export const startTestServer: RequestHandler = async (_req, res) => {
  try {
    const result = await ensureSingleTestServer(TypeMatchGid.MatchRandomRank);
    res.json({
      message: result.created
        ? 'Đã bật server test Rank (1 phòng trống) với TypeMatchGid = 10000002.'
        : 'Server test Rank đã sẵn sàng, không cần tạo thêm.',
      typeMatchGid: TypeMatchGid.MatchRandomRank,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TEST_SERVER_BUSY') {
      res.status(409).json({ error: 'Phòng test đang bận, vui lòng thử lại sau khi trống.' });
      return;
    }

    if (error instanceof Error && error.message === 'NO_AVAILABLE_PORT') {
      res.status(503).json({ error: 'Không còn cổng trống để tạo server test.' });
      return;
    }

    if (error instanceof Error && error.message.startsWith('Docker start error')) {
      res
        .status(500)
        .json({ error: 'Không thể khởi động container server test.', detail: error.message });
      return;
    }

    console.error('Lỗi khi bật server test:', error);
    res.status(500).json({ error: 'Không thể bật server test.' });
  }
};

export const shutdownServersAdmin: RequestHandler = async (_req, res) => {
  try {
    const result = await shutdownAllServersIfIdle();
    res.json({
      message: 'Đã dừng toàn bộ docker và làm trống ServerPortPool',
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'SERVERS_BUSY') {
      res.status(400).json({ error: 'Không thể tắt server khi vẫn còn phòng đang bận' });
      return;
    }

    console.error('Lỗi khi tắt server:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể tắt server', detail });
  }
};

export const shutdownTestServerController: RequestHandler = async (_req, res) => {
  try {
    const result = await shutdownTestServer(TypeMatchGid.MatchRandomRank);
    res.json({
      message:
        result.deletedRecords > 0
          ? 'Đã tắt server test Rank và dọn dẹp phòng.'
          : 'Không có server test Rank nào đang chạy.',
      typeMatchGid: TypeMatchGid.MatchRandomRank,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'TEST_SERVER_BUSY') {
      res.status(400).json({ error: 'Không thể tắt server test khi phòng đang bận.' });
      return;
    }

    console.error('Lỗi khi tắt server test:', error);
    const detail = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Không thể tắt server test.', detail });
  }
};

export const getActiveContainers: RequestHandler = async (_req, res) => {
  try {
    const containers = await listRunningContainers();
    res.json({ containers });
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
