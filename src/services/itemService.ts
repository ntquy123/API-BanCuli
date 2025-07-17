import prisma from '../models/prismaClient';

export const getAllItems = async () => {
  return prisma.item.findMany({
    where: { locationGid: 2, isOpen: true },
    orderBy: { id: 'asc' },
  });
};

export const getInventoryByPlayer = async (playerId: number) => {
  // Lấy thông tin player
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      playerItems: {
        include: { item: true },
      },
      equipPlayers: {
        include: { item: true },
      },
    },
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

  // Thông tin các vật phẩm đang trang bị
  const equippedItems: any[] = [];

  // Lấy thông tin trang bị từ bảng EquipPlayer
  for (const equip of player.equipPlayers) {
    const pi = player.playerItems.find(
      (i) => i.itemId === equip.itemId && i.seq === equip.seqItem
    );

    const level = pi?.level ?? 1;
    const { level: _lvl, ...itemWithoutLevel } = equip.item as any;

    equippedItems.push({
      locationId: equip.locationId,
      seq: equip.seqItem,
      level,
      ...itemWithoutLevel,
    });
  }

  // Body vẫn được lưu ở bảng Player
  if (player.Body !== null && player.Body !== undefined) {
    const pi = player.playerItems.find((i) => i.itemId === player.Body);

    if (pi) {
      const { level: _lvl, ...itemWithoutLevel } = pi.item;
      equippedItems.push({
        locationId: 0,
        seq: pi.seq,
        level: pi.level,
        ...itemWithoutLevel,
      });
    } else {
      const item = await prisma.item.findUnique({ where: { id: player.Body } });
      if (item) {
        const { level: _lvl, ...itemWithoutLevel } = item;
        equippedItems.push({
          locationId: 0,
          seq: 0,
          level: 1,
          ...itemWithoutLevel,
        });
      }
    }
  }

  const { playerItems, equipPlayers, ...rest } = player;
  return { ...rest, playerItems: simplifiedItems, equippedItems };
};
