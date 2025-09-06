import prisma from '../models/prismaClient';
import { Item, Player } from '@prisma/client';

export interface InventoryItem extends Omit<Item, 'level'> {
  seq: number;
  level: number;
  IsSolded: number;
}

export interface EquippedInventoryItem extends InventoryItem {
  locationId: number;
}

export type InventoryByPlayer = Omit<Player, 'playerItems' | 'equipPlayers'> & {
  playerItems: InventoryItem[];
  equippedItems: EquippedInventoryItem[];
};

export const getAllItems = async () => {
  return prisma.item.findMany({
    where: { locationGid: 2, isOpen: true },
    orderBy: { id: 'asc' },
  });
};

export const getInventoryByPlayer = async (
  playerId: number
): Promise<InventoryByPlayer | null> => {
  // Lấy thông tin player
  const player = await prisma.player.findFirst({
    where: { id: playerId, IsActive: true },
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
  const simplifiedItems: InventoryItem[] = player.playerItems.map((pi) => {
    const { level: _level, ...itemWithoutLevel } = pi.item;
    return {
      seq: pi.seq,
      level: pi.level,
      IsSolded: pi.IsSolded,
      ...itemWithoutLevel,
    };
  });

  // Thông tin các vật phẩm đang trang bị
  const equippedItems: EquippedInventoryItem[] = [];

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
      IsSolded: pi?.IsSolded ?? 0,
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
        IsSolded: pi.IsSolded,
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
          IsSolded: 0,
          ...itemWithoutLevel,
        });
      }
    }
  }

  const equippedIdSeq = new Set(
    equippedItems.map((ei: any) => `${ei.id}-${ei.seq}`)
  );

  const filteredItems = simplifiedItems.filter(
    (it) => !equippedIdSeq.has(`${it.id}-${it.seq}`)
  );

  const { playerItems, equipPlayers, ...rest } = player;
  return { ...rest, playerItems: filteredItems, equippedItems };
};
