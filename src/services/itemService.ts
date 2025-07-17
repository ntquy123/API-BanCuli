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

  // Lấy thông tin các vật phẩm đang trang bị
  const equipIds: { key: string; id: number | null; seq?: number | null }[] = [
    { key: 'Ball', id: player.Ball, seq: player.SeqBall },
    { key: 'Body', id: player.Body },
    { key: 'Shirt', id: player.Shirt },
    { key: 'Pant', id: player.Pant },
    { key: 'Hair', id: player.Hair },
  ];

  const equippedItems: Record<string, any> = {};
  for (const equip of equipIds) {
    if (equip.id === null || equip.id === undefined) continue;
    const pi = await prisma.playerItem.findUnique({
      where: {
        playerId_itemId_seq: {
          playerId,
          itemId: equip.id,
          seq: equip.seq ?? 0,
        },
      },
      include: { item: true },
    });

    if (pi) {
      const { level: _lvl, ...itemWithoutLevel } = pi.item;
      equippedItems[equip.key] = {
        seq: pi.seq,
        level: pi.level,
        ...itemWithoutLevel,
      };
    } else {
      const item = await prisma.item.findUnique({ where: { id: equip.id } });
      if (item) {
        const { level: _lvl, ...itemWithoutLevel } = item;
        equippedItems[equip.key] = {
          seq: equip.seq ?? 0,
          level: 1,
          ...itemWithoutLevel,
        };
      }
    }
  }

  const { playerItems, ...rest } = player;
  return { ...rest, playerItems: simplifiedItems, equippedItems };
};
