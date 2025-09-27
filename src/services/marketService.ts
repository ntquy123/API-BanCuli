import prisma from '../models/prismaClient';
import { Prisma } from '@prisma/client';

export const listItemForSale = async (
  playerId: number,
  itemId: number,
  seq: number,
  price: number
) => {
  const playerItem = await prisma.playerItem.findUnique({
    where: { playerId_itemId_seq: { playerId, itemId, seq } },
    select: { IsSolded: true }
  });

  if (!playerItem) {
    throw new Error('PlayerItem not found');
  }

  if (playerItem.IsSolded === 2) {
    throw new Error('Item already sold');
  }

  return prisma.playerItem.update({
    where: { playerId_itemId_seq: { playerId, itemId, seq } },
    data: { IsSolded: 1, Price: price }
  });
};

export const buyMarketItem = async (
  buyerId: number,
  sellerId: number,
  itemId: number,
  seq: number
) => {
  return prisma.$transaction(async (tx) => {
    const item = await tx.playerItem.findUnique({
      where: { playerId_itemId_seq: { playerId: sellerId, itemId, seq } },
      select: { IsSolded: true, Price: true }
    });

    if (!item || item.IsSolded !== 1) {
      throw new Error('Item not available');
    }

    const buyer = await tx.player.findFirst({
      where: { id: buyerId, IsActive: true },
      select: { RingBall: true, PlayerName: true }
    });

    if (!buyer) {
      throw new Error('Buyer not found or inactive');
    }

    const price = item.Price ?? 0;
    if ((buyer.RingBall ?? 0) < price) {
      throw new Error('Not enough RingBall');
    }

    const seller = await tx.player.findFirst({
      where: { id: sellerId, IsActive: true },
      select: { id: true }
    });

    if (!seller) {
      throw new Error('Seller not found or inactive');
    }

    await tx.player.update({
      where: { id: buyerId },
      data: { RingBall: { decrement: price } }
    });

    const lastSystemMessage = await tx.friendMessage.findFirst({
      where: { senderId: 0 },
      orderBy: { seqMess: 'desc' },
      select: { seqMess: true }
    });

    const systemSeq = (lastSystemMessage?.seqMess ?? 0) + 1;
    const buyerName = buyer.PlayerName ?? '';

    await tx.friendMessage.create({
      data: {
        senderId: 0,
        receiverId: sellerId,
        seqMess: systemSeq,
        message: `[${buyerName}] (purchased)`,
        ringBallReward: price,
        status: 'PENDING'
      }
    });

    await tx.playerItem.update({
      where: { playerId_itemId_seq: { playerId: sellerId, itemId, seq } },
      data: { IsSolded: 2 }
    });

    const lastSeq = await tx.playerItem.findFirst({
      where: { playerId: buyerId, itemId },
      orderBy: { seq: 'desc' },
      select: { seq: true }
    });
    const newSeq = lastSeq ? lastSeq.seq + 1 : 0;

    await tx.playerItem.create({
      data: {
        playerId: buyerId,
        itemId,
        seq: newSeq,
        level: 1,
        description: '',
        Price: 0,
        IsSolded: 0
      }
    });

    await tx.itemTradeHistory.create({
      data: {
        playerIdBuy: buyerId,
        playerIdSold: sellerId,
        itemId,
        seq
      }
    });

    return { newSeq };
  });
};

export const cancelSale = async (
  playerId: number,
  itemId: number,
  seq: number
) => {
  const item = await prisma.playerItem.findUnique({
    where: { playerId_itemId_seq: { playerId, itemId, seq } },
    select: { IsSolded: true }
  });

  if (!item) {
    throw new Error('PlayerItem not found');
  }

  if (item.IsSolded === 2) {
    throw new Error('item đã bán rồi');
  }

  return prisma.playerItem.update({
    where: { playerId_itemId_seq: { playerId, itemId, seq } },
    data: { IsSolded: 0, Price: 0 }
  });
};

export const getAllListedItems = async () => {
  return prisma.playerItem.findMany({
    where: { IsSolded: 1 },
    include: { item: true }
  });
};

export interface ListedItemFilters {
  itemName?: string;
  level?: number;
  priceOrder?: 'asc' | 'desc';
  levelOrder?: 'asc' | 'desc';
  skip?: number;
  take?: number;
}

export type ListedItemResult = Prisma.PlayerItemGetPayload<{
  include: {
    item: true;
    player: { select: { PlayerName: true } };
  };
}>;

export const getListedItems = async ({
  itemName,
  level,
  priceOrder,
  levelOrder,
  skip = 0,
  take = 10
}: ListedItemFilters): Promise<ListedItemResult[]> => {
  const where: any = { IsSolded: 1 };

  if (level !== undefined && !isNaN(level)) {
    where.level = level;
  }

  if (itemName) {
    where.item = { name: { contains: itemName, mode: 'insensitive' } };
  }

  const orderBy: any[] = [];
  if (priceOrder) {
    orderBy.push({ Price: priceOrder });
  }
  if (levelOrder) {
    orderBy.push({ level: levelOrder });
  }

  return prisma.playerItem.findMany({
    where,
    include: {
      item: true,
      player: { select: { PlayerName: true } },
    },
    orderBy: orderBy.length > 0 ? orderBy : undefined,
    skip,
    take,
  });
};
