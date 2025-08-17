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
      playerAchievement: {
        where: { playerId },
        select: { achievedAt: true },
      },
    },
  });

  return rewards.map((reward) => ({
    ...reward,
    claimed: reward.playerAchievement.length > 0,
    claimedAt: reward.playerAchievement[0]?.achievedAt ?? null,
  }));
};
