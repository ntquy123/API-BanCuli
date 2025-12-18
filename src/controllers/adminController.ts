import { RequestHandler } from 'express';
import prisma from '../models/prismaClient';
import { buildWarmupSummary } from '../utils/matchmakingWarmup';
import { shutdownAllServersIfIdle } from '../services/matchmakingService';
import { AdminTokenPayload, createAdminToken } from '../middleware/adminAuth';

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
