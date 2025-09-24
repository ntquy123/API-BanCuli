import prisma from '../models/prismaClient';
import { addItemToInventory } from './playerItemService';

export class RewardClaimError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'RewardClaimError';
    this.statusCode = statusCode;
  }
}

const MAX_REWARD_LOCATIONS = 20;

type RewardRecord = {
  seq: number;
  locationId: number | null;
  itemId: number | null;
  rewardAmount: number;
  isUsed: boolean;
  isGiftReceived: boolean;
  isComplete: boolean;
  countGif: number | null;
  updatedAt: Date | null;
};

type PlayerAchievementWithStatus = RewardRecord & {
  rewardType: string;
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
 const countGif =
    status?.countGif ??
    relatedAchievement?.countGif ??
    null;
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

  const isGiftReceived =
    typeof status?.isGiftReceived === 'boolean' ? status.isGiftReceived : false;

  const isComplete =
    typeof status?.isComplete === 'boolean' ? status.isComplete : false;

  const updatedAt = (() => {
    const value = status?.updatedAt;

    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      return value;
    }

    const parsed = new Date(value);

    return Number.isNaN(parsed.valueOf()) ? null : parsed;
  })();

  return {
    seq: resolvedSeq,
    locationId,
    itemId,
    rewardAmount,
    isUsed,
    isGiftReceived,
    isComplete,
    countGif,
    updatedAt,
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

export const listRewardPlayerAchievements = async (
  playerId: number,
  rewardType: string,
): Promise<PlayerAchievementWithStatus[]> => {
 

  const achievements = await (prisma.playerAchievement as any).findMany({
    where: { rewardType },
    orderBy: { seq: 'asc' },
    include: {
      statuses: {
        where: { playerId },
        select: {
          isGiftReceived: true,
          isComplete: true,
          updatedAt: true,
        },
        take: 1,
      },
    },
  });

  return achievements.map((achievement: any) => {
    const status = achievement?.statuses?.[0];
    const normalizedStatus = status
      ? { ...status, achievementId: achievement.seq }
      : undefined;

    return {
      rewardType: String(achievement.rewardType ?? rewardType),
      ...buildRewardRecord(normalizedStatus, achievement),
    };
  });
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

    if (!status) {
      throw new RewardClaimError('Reward status not found.', 404);
    }

    if (!status.isGiftReceived) {
      throw new RewardClaimError(
        'Reward is not ready to claim. Confirm advertisement before claiming.',
        400,
      );
    }

    if (status.isComplete) {
      throw new RewardClaimError('Reward has already been claimed.', 409);
    }

    const limitRaw = status.achievement?.countGif;
    if (limitRaw !== undefined && limitRaw !== null) {
      const limit = Number(limitRaw);

      if (Number.isFinite(limit) && limit >= 0) {
        const completedCount = await (tx.playerAchievementStatus as any).count({
          where: {
            typeGid: rewardType,
            achievementId: locationId,
            isComplete: true,
          },
        });

        if (completedCount >= limit) {
          throw new RewardClaimError(
            'Reward claim limit reached for this achievement.',
            409,
          );
        }
      }
    }

    const updatedAt = new Date();

    await (tx.playerAchievementStatus as any).updateMany({
      where: {
        playerId,
        typeGid: rewardType,
        achievementId: locationId,
      },
      data: { isComplete: true, updatedAt },
    });

    const rewardAmount =
      status.achievement?.rewardAmount ?? status.rewardAmount ?? 0;

    if (rewardAmount > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { increment: rewardAmount } },
      });
    }

    return { ...status, isComplete: true, updatedAt };
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

export const confirmAdWatch = async (
  playerId: number,
  rewardType: string,
  achievementId: number,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const [existingStatus, achievement] = await Promise.all([
      (tx.playerAchievementStatus as any).findUnique({
        where: {
          playerId_typeGid_achievementId: {
            playerId,
            typeGid: rewardType,
            achievementId,
          },
        },
        include: {
          achievement: true,
        },
      }),
      (tx.playerAchievement as any).findUnique({
        where: {
          rewardType_seq: { rewardType, seq: achievementId },
        },
      }),
    ]);

    if (!achievement && !existingStatus) {
      return null;
    }

    const normalizeDate = (value: unknown) => {
      if (!value) {
        return null;
      }

      if (value instanceof Date) {
        return value;
      }

      const parsed = new Date(value as string);
      return Number.isNaN(parsed.valueOf()) ? null : parsed;
    };

    if (existingStatus) {
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const referenceDates = [
        existingStatus.updatedAt,
        (existingStatus as any).achievement?.achievedAt,
        achievement?.achievedAt,
      ]
        .map(normalizeDate)
        .filter((date): date is Date => Boolean(date));

      const hasRewardToday = referenceDates.some(
        (date) => date >= startOfToday && date <= endOfToday,
      );

      if (hasRewardToday) {
        throw new RewardClaimError('đã nhận quà rồi', 409);
      }
    }

    const now = new Date();
    const resolvedItemIdRaw =
      achievement?.itemId ??
      existingStatus?.itemId ??
      (existingStatus as any)?.achievement?.itemId ??
      null;
    const resolvedItemId =
      typeof resolvedItemIdRaw === 'number' &&
      Number.isFinite(resolvedItemIdRaw)
        ? resolvedItemIdRaw
        : 0;

    const statusPayload = {
      itemId: resolvedItemId,
      isGiftReceived: true,
      isComplete: true,
      updatedAt: now,
    };

    const updatedStatus = existingStatus
      ? await (tx.playerAchievementStatus as any).update({
          where: {
            playerId_typeGid_achievementId: {
              playerId,
              typeGid: rewardType,
              achievementId,
            },
          },
          data: statusPayload,
          include: { achievement: true },
        })
      : await (tx.playerAchievementStatus as any).create({
          data: {
            playerId,
            typeGid: rewardType,
            achievementId,
            ...statusPayload,
          },
          include: { achievement: true },
        });

    const rewardAmountRaw =
      achievement?.rewardAmount ??
      (existingStatus as any)?.achievement?.rewardAmount ??
      null;
    const rewardAmount =
      typeof rewardAmountRaw === 'number' && Number.isFinite(rewardAmountRaw)
        ? rewardAmountRaw
        : 0;

    if (rewardAmount > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { increment: rewardAmount } },
      });
    }

    if (resolvedItemId > 0) {
      await addItemToInventory(playerId, resolvedItemId, tx, {
        level: 1,
        price: 0,
        isSolded: 1,
      });
    }

    const relatedAchievement =
      (updatedStatus as any).achievement ?? achievement ?? undefined;

    return buildRewardRecord(updatedStatus, relatedAchievement);
  });

  return result;
};
