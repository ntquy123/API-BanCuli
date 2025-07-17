// src/services/playerService.ts
import prisma from '../models/prismaClient'; // Import Prisma Client

export const getPlayerByAccountId = async (accountId: string) => {
  return await prisma.player.findFirst({
    where: { IdAccount: accountId },
  });
};

 
export const getPlayerByListId = async (ids: number[]) => {
  const players = await prisma.player.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    include: {
      effectPlayers: {
        select: {
          spin: true,
          power: true,
          level: true,
        },
      },
      // Include equipPlayers relation so caller can know equipped items
      equipPlayers: true,
    },
  });

  return players.map((player) => {
    const totals = player.effectPlayers.reduce(
      (acc, ef) => {
        acc.totalSpin += ef.spin * ef.level;
        acc.totalPower += ef.power * ef.level;
        return acc;
      },
      { totalSpin: 0, totalPower: 0 }
    );
    totals.totalSpin += 1;
    totals.totalPower += 5;
    const { effectPlayers, ...rest } = player;
    return { ...rest, ...totals };
  });
};

export const updatePlayerStats = async (
  playerId: number,
  expGain: number,
  ballDelta: number
) => {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { Exp: true, Level: true, TalentPoint: true },
  });

  if (!player) {
    throw new Error('Player not found');
  }

  const currentExp = player.Exp ?? 0;
  const currentLevel = player.Level ?? 1;

  const totalExp = currentExp + expGain;

  const levelSteps = [
    0,
    100,
    250,
    450,
    700,
    1000,
    1350,
    1750,
    2200,
    2700,
    3250,
    3850,
    4500,
    5200,
    5950,
    6750,
    7600,
    8500,
    9450,
    10450,
    11500,
    12600,
    13750,
    14950,
    16200,
  ];

  let newLevel = currentLevel;
  for (let i = levelSteps.length - 1; i >= 0; i--) {
    if (totalExp >= levelSteps[i]) {
      newLevel = i + 1;
      break;
    }
  }
  const levelDiff = newLevel - currentLevel;
  const data: any = {
    Exp: totalExp,
    Level: newLevel,
    RingBall: { increment: ballDelta },
  };

  if (levelDiff > 0) {
    const currentTP = player.TalentPoint ?? 0;
    data.TalentPoint = currentTP + levelDiff;
  }

  return prisma.player.update({
    where: { id: playerId },
    data,
  });
};

export const equipItem = async (
  playerId: number,
  typeGid: number,
  itemId: number,
  seq: number
) => {
  const playerItem = await prisma.playerItem.findUnique({
    where: { playerId_itemId_seq: { playerId, itemId, seq } },
  });

  if (!playerItem) {
    throw new Error('Item not found in inventory');
  }

  return playerItem;
};

export const equipPlayerItem = async (
  playerId: number,
  locationId: number,
  itemId: number,
  seqItem: number
) => {
  const existing = await prisma.equipPlayer.findUnique({
    where: { playerId_locationId: { playerId, locationId } },
  });

  if (existing) {
    return prisma.equipPlayer.update({
      where: { playerId_locationId: { playerId, locationId } },
      data: { itemId, seqItem },
    });
  }

  return prisma.equipPlayer.create({
    data: {
      playerId,
      locationId,
      itemId,
      seqItem,
      createdDate: new Date(),
    },
  });
};


