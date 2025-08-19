import prisma from '../models/prismaClient';
import { addItemToInventory } from './playerItemService';

export const listPlayerAchievements = async (playerId: number) => {
  return prisma.playerAchievementStatus.findMany({
    where: { playerId },
  });
};

export const claimAchievement = async (
  playerId: number,
  typeGid: number,
  achievementId: number,
) => {
  const result = await prisma.$transaction(async (tx) => {
    const record: any = await tx.playerAchievementStatus.findUnique({
      where: {
        playerId_typeGid_achievementId: { playerId, typeGid, achievementId },
      },
    });

    if (!record || !record.isComplete || record.isGiftReceived) {
      return null;
    }

    await (tx.playerAchievementStatus as any).update({
      where: {
        playerId_typeGid_achievementId: { playerId, typeGid, achievementId },
      },
      data: { isGiftReceived: true },
    });

    if ((record.ringBall ?? 0) > 0) {
      await tx.player.update({
        where: { id: playerId },
        data: { RingBall: { increment: record.ringBall } },
      });
    }

    return record;
  });

  if (result && (result as any).itemId) {
    await addItemToInventory(playerId, (result as any).itemId);
  }

  return result;
};
