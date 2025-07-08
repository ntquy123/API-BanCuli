import prisma from '../models/prismaClient';

 export const getAllItems = async () => {
  return prisma.item.findMany({
    where: { locationGid: 2 }
  });
};

export const getInventoryByPlayer = async (playerId: number) => {
  // Lấy thông tin player
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      playerItems: {
        include: {
          item: true
        }
      }
    }
  });

  if (!player) return null;

  // Trả nguyên thông tin player kèm danh sách playerItems
  return player;
};
