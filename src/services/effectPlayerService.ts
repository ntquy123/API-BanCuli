import prisma from '../models/prismaClient';

export const getByPlayerId = async (playerId: number) => {
  return prisma.effectPlayer.findMany({
    where: { playerId },
  });
};
