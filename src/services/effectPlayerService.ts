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
