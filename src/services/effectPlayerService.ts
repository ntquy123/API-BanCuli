import prisma from '../models/prismaClient';

export const getByPlayerId = async (playerId: number) => {
  return prisma.effectPlayer.findMany({
    where: { playerId },
    include: {
      sysMasGeneral: {
        select: {
          GenName: true, // Lấy tên kỹ năng
          ParentCode: true, // Lấy parentId nếu cần
          description: true // Lấy mô tả kỹ năng
        },
      },
       player: {
        select: {
          TalentPoint: true,
          Level: true
        }
      }
    },
  });
};

export const levelUpEffectPlayer = async (
  playerId: number,
  effectId: number
) => {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({
      where: { id: playerId },
      select: { TalentPoint: true },
    });

    if (!player) {
      throw new Error('Player not found');
    }

    const currentTP = player.TalentPoint ?? 0;
    if (currentTP <= 0) {
      throw new Error('Không còn điểm TalentPoint để tăng cấp');
    }

    await tx.player.update({
      where: { id: playerId },
      data: { TalentPoint: currentTP - 1 },
    });

    await tx.effectPlayer.update({
      where: { playerId_effectId: { playerId, effectId } },
      data: {
        level: { increment: 1 },
      },
    });

    return { TalentPoint: currentTP - 1 };
 
  });
};
