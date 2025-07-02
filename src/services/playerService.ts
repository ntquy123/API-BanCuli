// src/services/playerService.ts
import prisma from '../models/prismaClient'; // Import Prisma Client

export const getPlayerByAccountId = async (accountId: string) => {
  return await prisma.player.findFirst({
    where: { IdAccount: accountId },
  });
};

 
export const getPlayerByListId = async (ids: number[]) => {
  return await prisma.player.findMany({
    where: {
      IdAccount: {
        in: ids.map(String), // nếu IdAccount là string trong DB
      },
    },
  });
};

export const updatePlayerStats = async (
  playerId: number,
  expGain: number,
  ballDelta: number
) => {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { Exp: true, Level: true },
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

  return prisma.player.update({
    where: { id: playerId },
    data: {
      Exp: totalExp,
      Level: newLevel,
      RingBall: { increment: ballDelta },
    },
  });
};


