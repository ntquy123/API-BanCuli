import type { Prisma } from '@prisma/client';
import prisma from '../models/prismaClient';

export const buyItem = async (playerId: number, itemId: number) => {
  return prisma.$transaction(async (tx) => {
    const item = await (tx as any).item.findUnique({
      where: { id: itemId },
      select: { price: true, priceByBall: true }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const player = await tx.player.findFirst({
      where: { id: playerId, IsActive: true },
      select: { Money: true, RingBall: true }
    });

    if (!player) {
      throw new Error('Player not found or inactive');
    }

    const costMoney = item.price ?? 0;
    const costRingBall = (item as any).priceByBall ?? 0;

    if (itemId === 88000001) {
      if ((player.Money ?? 0) < costMoney) {
        throw new Error('Not enough money');
      }
      await tx.player.update({
        where: { id: playerId },
        data: {
          Money: { decrement: costMoney },
          RingBall: { increment: 10 },
        },
      });
      return { success: true } as const;
    }

    if (costMoney > 0) {
      if ((player.Money ?? 0) < costMoney) {
        throw new Error('Not enough money');
      }
    } else {
      if ((player.RingBall ?? 0) < costRingBall) {
        throw new Error('Not enough RingBall');
      }
    }

    const lastSeq = await tx.playerItem.findFirst({
      where: {
        playerId,
        itemId
      },
      orderBy: { seq: 'desc' },
      select: { seq: true }
    });

    const seq = lastSeq ? lastSeq.seq + 1 : 0;

    const playerItem = await tx.playerItem.create({
      data: {
        playerId,
        itemId,
        seq,
        level: 1,
        description: ''
      }
    });

    if (costMoney > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { Money: { decrement: costMoney } },
      });
    } else {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { decrement: costRingBall } },
      });
    }

    return playerItem;
  });
};

export const sellItem = async (
  playerId: number,
  itemId: number,
  seq: number
) => {
  return prisma.$transaction(async (tx) => {
    const item = await (tx as any).item.findUnique({
      where: { id: itemId },
      select: { price: true, priceByBall: true }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const active = await tx.player.findFirst({
      where: { id: playerId, IsActive: true },
      select: { id: true },
    });

    if (!active) {
      throw new Error('Player not found or inactive');
    }

    if (itemId === 88000001) {
      await tx.player.update({
        where: { id: playerId },
        data: {
          Money: { increment: item.price ?? 0 },
          RingBall: { decrement: 10 },
        },
      });
      return true;
    }

    const playerItem = await tx.playerItem.findUnique({
      where: {
        playerId_itemId_seq: {
          playerId,
          itemId,
          seq,
        },
      },
      select: { playerId: true },
    });

    if (!playerItem) {
      throw new Error('PlayerItem not found');
    }

    await tx.playerItem.delete({
      where: {
        playerId_itemId_seq: {
          playerId,
          itemId,
          seq
        }
      }
    });

    const costMoney = item.price ?? 0;
    const costRingBall = (item as any).priceByBall ?? 0;

    if (costMoney > 0) {
      await tx.player.update({
        where: { id: playerItem.playerId },
        data: { Money: { increment: costMoney } },
      });
    } else {
      await tx.player.update({
        where: { id: playerItem.playerId },
        data: { RingBall: { increment: costRingBall } },
      });
    }

    return true;
  });
};

type Material = { id: number; seq: number };

export const levelUpPlayerItem = async (
  playerId: number,
  itemId: number,
  seq: number,
  materials: Material[] = []
) => {
  return prisma.$transaction(async (tx) => {
    const playerItem = await tx.playerItem.findUnique({
      where: {
        playerId_itemId_seq: {
          playerId,
          itemId,
          seq,
        },
      },
      select: { playerId: true },
    });

    if (!playerItem) {
      throw new Error('PlayerItem not found');
    }

    const updated = await tx.playerItem.update({
      where: {
        playerId_itemId_seq: {
          playerId,
          itemId,
          seq,
        },
      },
      data: {
        level: { increment: 1 },
      },
    });

    if (materials.length > 0) {
      await tx.playerItem.deleteMany({
        where: {
          playerId,
          OR: materials.map((m) => ({ itemId: m.id, seq: m.seq })),
        },
      });
    }

    return updated;
  });
};

type AddItemOptions = {
  level?: number;
  description?: string;
  price?: number;
  isSolded?: number;
};

export const addItemToInventory = async (
  playerId: number,
  itemId: number,
  txClient?: Prisma.TransactionClient,
  options?: AddItemOptions,
) => {
  const execute = async (tx: Prisma.TransactionClient) => {
    const lastSeq = await tx.playerItem.findFirst({
      where: {
        playerId,
        itemId,
      },
      orderBy: { seq: 'desc' },
      select: { seq: true },
    });

    const seq = lastSeq ? lastSeq.seq + 1 : 0;
    const { level = 1, description = '', price = 0, isSolded = 0 } = options ?? {};

    return tx.playerItem.create({
      data: {
        playerId,
        itemId,
        seq,
        level,
        description,
        Price: price,
        IsSolded: isSolded,
      },
    });
  };

  if (txClient) {
    return execute(txClient);
  }

  return prisma.$transaction(async (tx) => execute(tx));
};
