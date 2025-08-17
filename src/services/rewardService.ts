import prisma from '../models/prismaClient';

export const listRewards = async (
  rewardType: string,
  playerId: number,
  dayOfWeek?: number,
) => {
  const achievements = await prisma.playerAchievement.findMany({
    where: {
      rewardType,
      playerId,
    },
    orderBy: {
      seq: 'asc',
    },
    take: 20,
    select: {
      seq: true,
      locationId: true,
      itemId: true,
      rewardAmount: true,
    },
  });

  return achievements;
};

export const refreshRewards = async (playerId: number) => {
  const rewardType = '11100001';

  await prisma.playerAchievement.deleteMany({
    where: { playerId, rewardType },
  });

  const locations = Array.from({ length: 20 }, (_, i) => i + 1);
  const shuffled = [...locations].sort(() => Math.random() - 0.5);
  const itemLocations = shuffled.slice(0, 3);
  const rewardLocations = shuffled.slice(3, 7);

  const data = locations.map((loc) => {
    let itemId: number | null = null;
    let rewardAmount = 0;

    if (itemLocations.includes(loc)) {
      itemId = getRandomInt(99000020, 99000030);
    } else if (rewardLocations.includes(loc)) {
      rewardAmount = getRandomInt(1, 4);
    }

    return {
      playerId,
      rewardType,
      seq: loc,
      locationId: loc,
      itemId,
      rewardAmount,
    };
  });

  await prisma.playerAchievement.createMany({ data });

  return prisma.playerAchievement.findMany({
    where: { playerId, rewardType },
    orderBy: { seq: 'asc' },
    select: {
      seq: true,
      locationId: true,
      itemId: true,
      rewardAmount: true,
    },
  });
};

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
