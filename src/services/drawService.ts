import prisma from '../models/prismaClient';
import { addItemToInventory } from './playerItemService';

interface RewardResult {
  type: 'item' | 'culi';
  itemId?: number;
  amount?: number;
}

const getStartOfDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const drawReward = async (playerId: number): Promise<RewardResult> => {
  const histories = await prisma.history.findMany({
    where: { playerId, marbBet: { gte: 5 } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  let winStreak = 0;
  if (histories.length > 0) {
    const status = histories[0].statusWin;
    for (const h of histories) {
      if (h.statusWin === status) {
        winStreak += 1;
      } else {
        break;
      }
    }
  }

  let winBonus = 0;
  if (winStreak >= 5) winBonus = 30;
  else if (winStreak >= 4) winBonus = 20;
  else if (winStreak >= 3) winBonus = 10;

  const lastThree = histories.slice(0, 3);
  const totalBet = lastThree.reduce((sum, h) => sum + (h.marbBet ?? 0), 0);
  let betBonus = 0;
  if (totalBet >= 60) betBonus = 50;
  else if (totalBet >= 30) betBonus = 25;
  else betBonus = 10;

  let probability = winBonus + betBonus;
  if (probability > 100) probability = 100;

  const randomValue = Math.random() * 100;
  let isRare = randomValue < probability;

  if (isRare) {
    const day = getStartOfDay();
    let daily = await prisma.dailyRareItem.findUnique({
      where: { playerId_date: { playerId, date: day } },
    });
    if (!daily) {
      daily = await prisma.dailyRareItem.create({
        data: { playerId, date: day, count: 0 },
      });
    }

    if (daily.count >= 3) {
      isRare = false;
    } else {
      const items = await prisma.item.findMany({ where: { locationGid: 3 } });
      if (items.length > 0) {
        const chosen = items[Math.floor(Math.random() * items.length)];
        await addItemToInventory(playerId, chosen.id);
        await prisma.dailyRareItem.update({
          where: { playerId_date: { playerId, date: day } },
          data: { count: { increment: 1 } },
        });
        return { type: 'item', itemId: chosen.id };
      } else {
        isRare = false;
      }
    }
  }

  // Fallback to common reward
   let amount = 0;
  const rand = Math.random() * 100;
  if (rand < 30) amount = 0;         // 30% được 0 viên
  else if (rand < 60) amount = 1;    // 30% được 1 viên
  else if (rand < 80) amount = 2;    // 20% được 2 viên
  else if (rand < 95) amount = 3;    // 15% được 3 viên
  else amount = 4;   
  if (amount > 0) {
    await prisma.player.update({
      where: { id: playerId },
      data: { RingBall: { increment: amount } },
    });
  }
  return { type: 'culi', amount };
};
