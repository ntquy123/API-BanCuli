import prisma from '../models/prismaClient';

 export const getAllItems = async () => {
  return prisma.item.findMany({
    where: { locationGid: 2,isOpen: true },
    orderBy: { id: 'asc' },
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

  // Trả thông tin player kèm danh sách playerItems đơn giản hóa
  const simplifiedItems = player.playerItems.map((pi) => {
    const { level: _level, ...itemWithoutLevel } = pi.item;
    return {
      seq: pi.seq,
      level: pi.level,
      ...itemWithoutLevel,
    };
  });

  return { ...player, playerItems: simplifiedItems };
};
