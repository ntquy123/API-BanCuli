import prisma from '../models/prismaClient';
import { addItemToInventory } from './playerItemService';

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
      //seq: true,
      locationId: true,
      //itemId: true,
      //rewardAmount: true,
      isUsed: true,
    },
  });

  return achievements;
};

export const insertPlayerAchievement = async (
  playerId: number,
  rewardType: string,
) => {
  if (rewardType === '11100001') {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.playerAchievement.findFirst({
      where: {
        playerId,
        rewardType,
        achievedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existing) {
      return prisma.playerAchievement.findMany({
        where: { playerId, rewardType },
        orderBy: { seq: 'asc' },
        select: {
          seq: true,
          locationId: true,
          itemId: true,
          rewardAmount: true,
        },
      });
    }

    return refreshRewards(playerId, rewardType);
  }

  return [];
};

export const refreshRewards = async (
  playerId: number,
  rewardType = '11100001',
) => {
  await prisma.playerAchievement.deleteMany({
    where: { playerId, rewardType },
  });

  const locations = Array.from({ length: 20 }, (_, i) => i + 1);
  const shuffled = [...locations].sort(() => Math.random() - 0.5);
  const itemLocations = shuffled.slice(0, 3);
  const rewardLocations = shuffled.slice(3, 7);

  const data = locations.map((loc) => {
    let itemId: number | null = null;
    let rewardAmount = 0;

    if (itemLocations.includes(loc)) {
      itemId = getRandomInt(99000002, 99000010);
    } else if (rewardLocations.includes(loc)) {
      rewardAmount = getRandomInt(1, 4);
    }

    return {
      playerId,
      rewardType,
      seq: loc,
      locationId: loc,
      itemId,
      rewardAmount,
    };
  });

  await prisma.playerAchievement.createMany({ data });

  return prisma.playerAchievement.findMany({
    where: { playerId, rewardType },
    orderBy: { seq: 'asc' },
    select: {
      seq: true,
      locationId: true,
      itemId: true,
      rewardAmount: true,
    },
  });
};

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const claimReward = async (
  playerId: number,
  locationId: number,
  rewardType: string,
) => {
  const achievement = await prisma.$transaction(async (tx) => {
    const found = await tx.playerAchievement.findFirst({
      where: { playerId, rewardType, locationId },
    });

    if (!found || found.isUsed) {
      return null;
    }

    const updated = await tx.playerAchievement.update({
      where: {
        playerId_rewardType_seq: {
          playerId,
          rewardType,
          seq: found.seq,
        },
      },
      data: { isUsed: true },
    });

    if ((found.rewardAmount ?? 0) > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: {
          RingBall: { increment: found.rewardAmount ?? 0 },
        },
      });
    }

    return updated;
  });

  if (achievement && achievement.itemId) {
    await addItemToInventory(playerId, achievement.itemId);
  }

  return achievement;
};
