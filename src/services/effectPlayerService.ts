import prisma from '../models/prismaClient';

export const getByPlayerId = async (playerId: number) => {
  return prisma.effectPlayer.findMany({
    where: { playerId },
    include: {
      sysMasGeneral: {
        select: {
          GenName: true, // Lấy tên kỹ năng
        },
      },
    },
  });
};

export const levelUpEffectPlayer = async (
  playerId: number,
  effectId: number
) => {
  return prisma.effectPlayer.update({
    where: { playerId_effectId: { playerId, effectId } },
    data: {
      level: { increment: 1 },
    },
  });
};
