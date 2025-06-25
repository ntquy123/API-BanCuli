import prisma from '../models/prismaClient';

export const getAllItems = async () => {
  return prisma.item.findMany();
};

export const getInventoryByPlayer = async (playerId: number) => {
  return prisma.playerItem.findMany({
    where: { playerId },
    include: { item: true }
  });
};
