import prisma from '../models/prismaClient';
import { addItemToInventory } from './playerItemService';

const MAX_REWARD_LOCATIONS = 20;

type RewardRecord = {
  seq: number;
  locationId: number | null;
  itemId: number | null;
  rewardAmount: number;
  isUsed: boolean;
};

const buildRewardRecord = (
  status: any | undefined,
  achievement?: any,
): RewardRecord => {
  const relatedAchievement = achievement ?? status?.achievement ?? {};
  const seq =
    status?.seq ??
    status?.achievementId ??
    relatedAchievement?.seq ??
    relatedAchievement?.achievementId ??
    0;

  const locationId =
    status?.locationId ??
    relatedAchievement?.locationId ??
    (typeof seq === 'number' && seq > 0 ? seq : null);

  const itemId =
    status?.itemId ??
    relatedAchievement?.itemId ??
    null;

  const rewardAmount =
    status?.rewardAmount ??
    relatedAchievement?.rewardAmount ??
    0;

  const isUsed = Boolean(
    status?.isUsed ??
      status?.isComplete ??
      status?.isGiftReceived ??
      relatedAchievement?.isUsed ??
      false,
  );

  return {
    seq,
    locationId,
    itemId,
    rewardAmount,
    isUsed,
  };
};

const ensureBaseAchievements = async (
  rewardType: string,
  tx: any,
) => {
  const sequences = Array.from({ length: MAX_REWARD_LOCATIONS }, (_, index) => index + 1);

  const existing = await (tx.playerAchievement as any).findMany({
    where: { rewardType, seq: { in: sequences } },
    select: { seq: true },
  });

  const existingSeqs = new Set(existing.map((entry) => entry.seq));
  const toCreate = sequences
    .filter((seq) => !existingSeqs.has(seq))
    .map((seq) => ({
      rewardType,
      seq,
      locationId: seq,
      rewardAmount: 0,
      itemId: null,
      isUsed: false,
    }));

  if (toCreate.length > 0) {
    await (tx.playerAchievement as any).createMany({ data: toCreate });
  }
};

export const listRewards = async (
  rewardType: string,
  playerId: number,
  dayOfWeek?: number,
) => {
  await ensureBaseAchievements(rewardType, prisma);

  const achievements = await (prisma.playerAchievement as any).findMany({
    where: { rewardType },
    orderBy: { seq: 'asc' },
    take: MAX_REWARD_LOCATIONS,
    include: {
      statuses: {
        where: { playerId, rewardType },
        take: 1,
      },
    },
  });

  return achievements.map((achievement) =>
    buildRewardRecord((achievement as any).statuses?.[0], achievement),
  );
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

    const existingStatus = await (prisma.playerAchievementStatus as any).findFirst({
      where: {
        playerId,
        rewardType,
        updatedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingStatus) {
      return listRewards(rewardType, playerId);
    }

    return refreshRewards(playerId, rewardType);
  }

  return [];
};

export const refreshRewards = async (
  playerId: number,
  rewardType = '11100001',
) => {
  const results = await prisma.$transaction(async (tx) => {
    await ensureBaseAchievements(rewardType, tx);

    await (tx.playerAchievementStatus as any).deleteMany({
      where: { playerId, rewardType },
    });

    const locations = Array.from({ length: MAX_REWARD_LOCATIONS }, (_, index) => index + 1);
    const shuffled = [...locations].sort(() => Math.random() - 0.5);
    const itemLocations = shuffled.slice(0, 3);
    const rewardLocations = shuffled.slice(3, 7);

    const generatedAt = new Date();

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
        isUsed: false,
        updatedAt: generatedAt,
      };
    });

    await (tx.playerAchievementStatus as any).createMany({ data });

    const statuses = await (tx.playerAchievementStatus as any).findMany({
      where: { playerId, rewardType },
      orderBy: { seq: 'asc' },
      include: {
        achievement: {
          select: {
            seq: true,
            locationId: true,
            itemId: true,
            rewardAmount: true,
            isUsed: true,
          },
        },
      },
    });

    return statuses.map((status: any) => buildRewardRecord(status, status.achievement));
  });

  return results;
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
    const status = await (tx.playerAchievementStatus as any).findFirst({
      where: {
        playerId,
        rewardType,
        seq: locationId,
      },
      include: {
        achievement: true,
      },
    });

    if (!status || status.isUsed) {
      return null;
    }

    await (tx.playerAchievementStatus as any).updateMany({
      where: {
        playerId,
        rewardType,
        seq: locationId,
      },
      data: { isUsed: true, updatedAt: new Date() },
    });

    const rewardAmount =
      status.rewardAmount ?? status.achievement?.rewardAmount ?? 0;

    if (rewardAmount > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { increment: rewardAmount } },
      });
    }

    return { ...status, isUsed: true };
  });

  if (achievement) {
    const itemId = achievement.itemId ?? achievement.achievement?.itemId;

    if (itemId) {
      await addItemToInventory(playerId, itemId);
    }

    return buildRewardRecord(achievement, achievement.achievement);
  }

  return achievement;
};
