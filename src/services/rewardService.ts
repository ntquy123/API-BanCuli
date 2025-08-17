import prisma from '../models/prismaClient';

export const listRewards = async (
  rewardType: string,
  playerId: number,
  dayOfWeek?: number,
) => {
  const rewards = await prisma.reward.findMany({
    where: {
      rewardType,
      ...(dayOfWeek !== undefined ? { dayofweek: dayOfWeek } : {}),
    },
    include: {
      achievements: {
        include: {
          playerAchievements: {
            where: { playerId },
            select: { achievedAt: true },
          },
        },
      },
    },
  });

  return rewards.map((reward) => ({
    ...reward,
    achievements: reward.achievements.map((ach) => ({
      id: ach.id,
      name: ach.name,
      description: ach.description,
      criteria: ach.criteria,
      rewardId: ach.rewardId,
      claimed: ach.playerAchievements.length > 0,
      claimedAt: ach.playerAchievements[0]?.achievedAt || null,
    })),
  }));
};
