import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const items = [
    { name: 'Potion', description: 'Restore health', level: 1, typeGid: 1, price: 50, isLevelUp: false, isOpen: true, locationGid: 0 },
    { name: 'Elixir', description: 'Restore mana', level: 1, typeGid: 2, price: 75, isLevelUp: false, isOpen: true, locationGid: 0 }
  ];

  for (const data of items) {
    await prisma.item.upsert({
      where: { id: data.typeGid },
      update: {},
      create: data
    });
  }

  const player = await prisma.player.findFirst();
  if (player) {
    const firstItem = await prisma.item.findFirst();
    if (firstItem) {
      await prisma.playerItem.upsert({
        where: { playerId_itemId: { playerId: player.id, itemId: firstItem.id } },
        update: { quantity: 1 },
        create: { playerId: player.id, itemId: firstItem.id, quantity: 1 }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
