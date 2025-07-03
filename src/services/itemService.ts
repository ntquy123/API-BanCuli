import prisma from '../models/prismaClient';

export const getAllItems = async () => {
  return prisma.item.findMany();
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

  // Đổi tên cho dễ dùng (items là danh sách PlayerItem, mỗi phần tử có thêm trường item)
  return {
    ...player,
    items: player.playerItems,
  };
};
