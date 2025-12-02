// src/services/playerService.ts
import { Prisma } from '@prisma/client';
import prisma from '../models/prismaClient'; // Import Prisma Client

// Location id used in EquipPlayer to mark the equipped ball slot
const BALL_SLOT_LOCATION_ID = 2;

 const generateFriendCode  = (): string => {
  // Bộ ký tự không dễ nhầm
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // bỏ O, I
  const numbers = '23456789';                 // bỏ 0, 1
  
  // Nhóm 1: 3 chữ cái
  let part1 = '';
  for (let i = 0; i < 3; i++) {
    part1 += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Nhóm 2: 3 chữ số
  let part2 = '';
  for (let i = 0; i < 3; i++) {
    part2 += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }
  
  // Kết quả dạng ABC-123
  return `${part1}-${part2}`;
};


const STARTING_EFFECTS = [
  { level: 1, effectId: 11000001, power: 0, spin: 0, isPassive: false, IsActive: true, IsEquiped: true, charges: 1 },
  { level: 1, effectId: 11000002, power: 0, spin: 0.5, isPassive: false,IsActive: true ,IsEquiped: true, charges: 1 },
  { level: 1, effectId: 11000003, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
  { level: 1, effectId: 11000004, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
  { level: 1, effectId: 11000005, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
  { level: 1, effectId: 11000006, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
  { level: 1, effectId: 11000007, power: 0, spin: 0, isPassive: false, IsActive: true, IsEquiped: true, charges: 1 },
  { level: 1, effectId: 11000008, power: 0, spin: 0, isPassive: true, IsActive: true, charges: 1 },
  { level: 1, effectId: 11000009, power: 0, spin: 0, isPassive: false, charges: 1 },
  { level: 1, effectId: 11000010, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
  { level: 1, effectId: 11000011, power: 0, spin: 0, isPassive: false,IsActive: true, charges: 1 },
];

const seedNewPlayerData = async (
  tx: Prisma.TransactionClient,
  playerId: number
) => {
  await tx.playerItem.create({
    data: {
      playerId,
      itemId: 99000001,
      seq: 0,
      level: 1,
      description: '',
      Price: 0,
      IsSolded: 3,
    },
  });

  await tx.effectPlayer.createMany({
    data: STARTING_EFFECTS.map((effect) => ({
      playerId,
      effectId: effect.effectId,
      power: effect.power,
      spin: effect.spin,
      level: effect.level,
      isPassive: effect.isPassive,
      IsActive: effect.IsActive,
      IsEquiped: effect.IsEquiped,
      charges: effect.charges,
      description: `Skill ${effect.effectId}`,
    })),
  });
};


export const getPlayerByAccountId = async (accountId: string) => {
  return await prisma.player.findFirst({
    where: { IdAccount: accountId, IsActive: true },
  });
};

export const updatePlayerName = async (playerId: number, playerName: string) => {
  return prisma.player.update({
    where: { id: playerId },
    data: { PlayerName: playerName },
  });
};

export const confirmPlayerName = async (
  playerId: number,
  playerName: string,
  companionBallItemId: number
) => {
  return prisma.$transaction(async (tx) => {
    const updatedPlayer = await tx.player.update({
      where: { id: playerId },
      data: { PlayerName: playerName },
    });

    await tx.equipPlayer.upsert({
      where: { playerId_locationId: { playerId, locationId: 1 } },
      update: { itemId: companionBallItemId, seqItem: 0 },
      create: {
        playerId,
        locationId: 1,
        itemId: companionBallItemId,
        seqItem: 0,
        createdDate: new Date(),
      },
    });

    return updatedPlayer;
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
        //acc.totalSpin += ef.spin * ef.level;
        //acc.totalPower += ef.power * ef.level;
        acc.totalSpin = 1.5;
        acc.totalPower = 2;
        return acc;
      },
      { totalSpin: 0, totalPower: 0 }
    );
    //totals.totalSpin += 1;
    //totals.totalPower += 5;
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

  const levelSteps = [0, 20, 40, 60, 80, 110, 140, 170, 200, 230, 270, 310, 350, 390, 430, 480, 530, 580, 630, 680, 740, 800, 860, 920, 980];

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
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.player.findFirst({
          where: { IdAccount: idToken, IsActive: true },
        });

        if (existing) {
          return existing;
        }

        const player = await tx.player.create({
          data: {
            friendCode: generateFriendCode(),
            IdAccount: idToken,
            PlayerName: playerName,
            Level: 1,
            Exp: 0,
            Body: 1,
            RingBall: 20,
            Money: 0,
            TalentPoint: 0,
            IsActive: true,
          },
        });

        await seedNewPlayerData(tx, player.id);

        return player;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        continue; // Retry on unique constraint violation
      }
      throw error;
    }
  }

  throw new Error('Failed to create account');
};


export const loginOrCreateSocialAccount = async (
  firebaseUid: string,
  email: string,
  providerType: string
) => {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.player.findFirst({
          where: {
            IdAccount: firebaseUid,
            ProviderType: providerType,
            IsActive: true,
          },
        });

        if (existing) {
          const updates: Prisma.PlayerUpdateInput = {};

          if (email && email !== existing.Email) {
            updates.Email = email;
          }

          if (Object.keys(updates).length > 0) {
            return tx.player.update({
              where: { id: existing.id },
              data: updates,
            });
          }

          return existing;
        }

        const player = await tx.player.create({
          data: {
            friendCode: generateFriendCode(),
            IdAccount: firebaseUid,
            Email: email || null,
            ProviderType: providerType,
            PlayerName: email || null,
            Level: 1,
            Exp: 0,
            Body: 1,
            RingBall: 20,
            Money: 0,
            TalentPoint: 0,
            IsActive: true,
          },
        });

        await seedNewPlayerData(tx, player.id);

        return player;
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }

  throw new Error('Failed to login or create social account');
};


