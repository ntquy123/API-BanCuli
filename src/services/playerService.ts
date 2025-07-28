// src/services/playerService.ts
import prisma from '../models/prismaClient'; // Import Prisma Client

// Location id used in EquipPlayer to mark the equipped ball slot
const BALL_SLOT_LOCATION_ID = 2;

export const getPlayerByAccountId = async (accountId: string) => {
  return await prisma.player.findFirst({
    where: { IdAccount: accountId, IsActive: true },
  });
};

 
export const getPlayerByListId = async (ids: number[]) => {
  const players = await prisma.player.findMany({
    where: {
      id: {
        in: ids,
      },
      IsActive: true,
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
  const player = await prisma.player.findFirst({
    where: { id: playerId, IsActive: true },
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
  const active = await prisma.player.findFirst({
    where: { id: playerId, IsActive: true },
    select: { id: true },
  });

  if (!active) {
    throw new Error('Player not found or inactive');
  }
  const data: { Ball?: number; Shirt?: number; SeqBall?: number } = {};

  if (typeGid === 1) {
    data.Ball = itemId;
    data.SeqBall = seq;

    const locationId = BALL_SLOT_LOCATION_ID;
    const existing = await (prisma as any).equipPlayer.findFirst({
      where: { playerId, locationId },
      select: { playerId: true },
    });

    if (existing) {
      await (prisma as any).equipPlayer.update({
        where: { playerId_locationId: { playerId, locationId } },
        data: { itemId, seqItem: seq },
      });
    } else {
      await (prisma as any).equipPlayer.create({
        data: { playerId, locationId, itemId, seqItem: seq },
      });
    }
  } else if (typeGid === 2) {
    data.Shirt = itemId;
  } else {
    throw new Error('Unsupported typeGid');
  }

  return prisma.player.update({
    where: { id: playerId },
    data,
  });
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

export const createAccount = async (idToken: string, playerName: string) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.player.findFirst({
      where: { IdAccount: idToken, IsActive: true },
    });

    if (existing) {
      return existing;
    }

    const player = await tx.player.create({
      data: {
        IdAccount: idToken,
        PlayerName: playerName,
        Level: 1,
        Exp: 0,
        Body: 0,
        RingBall: 0,
        Money: 0,
        TalentPoint: 0,
      },
    });

    await tx.playerItem.create({
      data: {
        playerId: player.id,
        itemId: 99000001,
        seq: 0,
        level: 1,
        description: '',
        Price: 0,
        IsSolded: 3,
      },
    });

    await tx.equipPlayer.create({
      data: {
        playerId: player.id,
        locationId: 1,
        itemId: 99000001,
        seqItem: 0,
        createdDate: new Date(),
      },
    });

const effects = [
      { effectId: 11000001, power: 0.0, spin: 0, isPassive: true, charges: 0 },
      { effectId: 11000002, power: 0, spin: 0.5, isPassive: true, charges: 0 },
      { effectId: 11000003, power: 0, spin: 0, isPassive: true, charges: 0 },
      { effectId: 11000004, power: 0, spin: 0, isPassive: true, charges: 0 },
      { effectId: 11000005, power: 0, spin: 0, isPassive: true, charges: 0 },
      { effectId: 11000006, power: 0, spin: 0, isPassive: true, charges: 0 },
      { effectId: 11000007, power: 0, spin: 0, isPassive: false, charges: 0 },
      { effectId: 11000008, power: 0, spin: 0, isPassive: false, charges: 0 },
    ];

   await tx.effectPlayer.createMany({
      data: effects.map((effect) => ({
        playerId: player.id,
        effectId: effect.effectId,
        power: effect.power,
        spin: effect.spin,
        level: 1, // Mặc định level ban đầu là 1
        isPassive: effect.isPassive,
        charges: effect.charges,
        description: `Skill ${effect.effectId}`, // Mô tả kỹ năng
      })),
    });


    return player;
  });
};


