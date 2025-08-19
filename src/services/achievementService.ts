import prisma from '../models/prismaClient';

export const listPlayerAchievements = async (playerId: number) => {
  return prisma.playerAchievementStatus.findMany({
    where: { playerId },
  });
};
