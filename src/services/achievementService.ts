import prisma from '../models/prismaClient';

export const getAchievementsByPlayer = async (playerId: number) => {
  const achievements = await prisma.achievement.findMany({
    include: {
      reward: true,
      playerAchievements: {
        where: { playerId },
        select: { achievedAt: true },
      },
    },
  });

  return achievements.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    criteria: a.criteria,
    reward: a.reward,
    achieved: a.playerAchievements.length > 0,
  }));
};

export const addPlayerAchievement = async (
  playerId: number,
  achievementId: number,
) => {
  return prisma.playerAchievement.create({
    data: { playerId, achievementId },
  });
};

export const claimAchievementReward = async (
  playerId: number,
  achievementId: number,
) => {
  return prisma.$transaction(async (tx) => {
    const achievement = await tx.achievement.findUnique({
      where: { id: achievementId },
      include: { reward: true },
    });

    if (!achievement || !achievement.reward) {
      throw new Error('Achievement not found');
    }

    const pa = await tx.playerAchievement.findUnique({
      where: {
        playerId_achievementId: { playerId, achievementId },
      },
    });

    if (!pa) {
      throw new Error('Player has not completed this achievement');
    }

    if (achievement.reward.rewardType === 'money') {
      await tx.player.update({
        where: { id: playerId },
        data: { Money: { increment: achievement.reward.rewardAmount } },
      });
    } else if (
      achievement.reward.rewardType === 'item' &&
      achievement.reward.itemId !== null
    ) {
      if (achievement.reward.itemId === 88000001) {
        await tx.player.update({
          where: { id: playerId },
          data: {
            RingBall: { increment: 10 },
          },
        });
        return true;
      }

      const lastSeq = await tx.playerItem.findFirst({
        where: { playerId, itemId: achievement.reward.itemId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });

      const seq = lastSeq ? lastSeq.seq + 1 : 0;

      await tx.playerItem.create({
        data: {
          playerId,
          itemId: achievement.reward.itemId,
          seq,
          level: 1,
          description: '',
        },
      });
    }

    return true;
  });
};
