import prisma from '../models/prismaClient';

export const listRewards = async (
  rewardType: string,
  playerId: number,
  dayOfWeek?: number,
) => {
  const achievements = await prisma.playerAchievement.findMany({
    where: {
      rewardType,
      playerId,
    },
    orderBy: {
      seq: 'asc',
    },
    take: 20,
    select: {
      seq: true,
      locationId: true,
      itemId: true,
      rewardAmount: true,
    },
  });

  return achievements;
};
