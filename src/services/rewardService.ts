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

  const resolvedSeq = (() => {
    const achievementId = Number(status?.achievementId);
    if (Number.isFinite(achievementId) && achievementId > 0) {
      return achievementId;
    }

    const achievementSeq = Number(relatedAchievement?.seq);
    if (Number.isFinite(achievementSeq) && achievementSeq > 0) {
      return achievementSeq;
    }

    return 0;
  })();

  const locationId =
    relatedAchievement?.locationId ??
    (typeof resolvedSeq === 'number' && resolvedSeq > 0 ? resolvedSeq : null);

  const itemId =
    status?.itemId ??
    relatedAchievement?.itemId ??
    null;

  const rewardAmount =
    status?.rewardAmount ??
    relatedAchievement?.rewardAmount ??
    0;

  const isUsed = (() => {
    if (typeof status?.isGiftReceived === 'boolean') {
      return status.isGiftReceived;
    }

    if (typeof status?.isUsed === 'boolean') {
      return status.isUsed;
    }

    if (typeof relatedAchievement?.isUsed === 'boolean') {
      return relatedAchievement.isUsed;
    }

    return false;
  })();

  return {
    seq: resolvedSeq,
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
        where: { playerId, typeGid: rewardType },
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
        typeGid: rewardType,
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
      where: { playerId, typeGid: rewardType },
    });

    const locations = Array.from({ length: MAX_REWARD_LOCATIONS }, (_, index) => index + 1);
    const shuffled = [...locations].sort(() => Math.random() - 0.5);
    const itemLocations = shuffled.slice(0, 3);
    const rewardLocations = shuffled.slice(3, 7);

    const generatedAt = new Date();

    const generatedEntries = locations.map((loc) => {
      const hasItemReward = itemLocations.includes(loc);
      const itemId = hasItemReward ? getRandomInt(99000002, 99000010) : null;
      const rewardAmount = !hasItemReward && rewardLocations.includes(loc)
        ? getRandomInt(1, 4)
        : 0;

      return {
        seq: loc,
        achievementData: {
          itemId,
          rewardAmount,
          locationId: loc,
          isUsed: false,
        },
        statusData: {
          playerId,
          typeGid: rewardType,
          achievementId: loc,
          itemId,
          isComplete: true,
          isGiftReceived: false,
          updatedAt: generatedAt,
        },
      };
    });

    await Promise.all(
      generatedEntries.map(({ seq, achievementData }) =>
        (tx.playerAchievement as any).update({
          where: { rewardType_seq: { rewardType, seq } },
          data: achievementData,
        }),
      ),
    );

    await (tx.playerAchievementStatus as any).createMany({
      data: generatedEntries.map(({ statusData }) => statusData),
    });

    const statuses = await (tx.playerAchievementStatus as any).findMany({
      where: { playerId, typeGid: rewardType },
      orderBy: { achievementId: 'asc' },
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
        typeGid: rewardType,
        achievementId: locationId,
      },
      include: {
        achievement: true,
      },
    });

    if (!status || status.isGiftReceived) {
      return null;
    }

    await (tx.playerAchievementStatus as any).updateMany({
      where: {
        playerId,
        typeGid: rewardType,
        achievementId: locationId,
      },
      data: { isGiftReceived: true, updatedAt: new Date() },
    });

    const rewardAmount =
      status.achievement?.rewardAmount ?? status.rewardAmount ?? 0;

    if (rewardAmount > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { increment: rewardAmount } },
      });
    }

    return { ...status, isGiftReceived: true };
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
