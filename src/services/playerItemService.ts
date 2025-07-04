import prisma from '../models/prismaClient';

export const buyItem = async (playerId: number, itemId: number) => {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({
      where: { id: itemId },
      select: { price: true }
    });

    if (!item) {
      throw new Error('Item not found');
    }

    const player = await tx.player.findUnique({
      where: { id: playerId },
      select: { Money: true }
    });

    if (!player) {
      throw new Error('Player not found');
    }

    const currentMoney = player.Money ?? 0;
    if (currentMoney < item.price) {
      throw new Error('Not enough money');
    }

    const playerItem = await tx.playerItem.create({
      data: {
        playerId,
        itemId,
        level: 1,
        description: ''
      }
    });

    await tx.player.update({
      where: { id: playerId },
      data: { Money: { decrement: item.price } }
    });

    return playerItem;
  });
};

export const sellItem = async (id: number, price: number) => {
  return prisma.$transaction(async (tx) => {
    const playerItem = await tx.playerItem.findUnique({
      where: { id },
      select: { playerId: true }
    });

    if (!playerItem) {
      throw new Error('PlayerItem not found');
    }

    await tx.playerItem.delete({ where: { id } });

    await tx.player.update({
      where: { id: playerItem.playerId },
      data: { Money: { increment: price } }
    });

    return true;
  });
};
