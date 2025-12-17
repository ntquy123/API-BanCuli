import { Prisma } from '@prisma/client';
import prisma from '../models/prismaClient';

export interface BetTransactionInput {
  userId: number;
  ringBall: number;
  money?: number;
  description?: string;
  eventType?: string;
}

const getNextSeqForUser = async (
  tx: Prisma.TransactionClient,
  userId: number
): Promise<number> => {
  const latest = await tx.balanceHistory.aggregate({
    where: { userId },
    _max: { seq: true },
  });

  return (latest._max.seq ?? 0) + 1;
};

export const processBetTransactions = async (transactions: BetTransactionInput[]) => {
  if (!transactions.length) {
    return [];
  }

  return prisma.$transaction(async (tx) => {
    const histories = [] as { userId: number; seq: number }[];

    for (const transaction of transactions) {
      const ringBallChange = transaction.ringBall;
      const moneyChange = transaction.money ?? 0;

      if (!Number.isFinite(ringBallChange) || ringBallChange <= 0) {
        throw new Error('ringBall must be a positive number');
      }

      const player = await tx.player.findUnique({
        where: { id: transaction.userId },
        select: { RingBall: true },
      });

      if (!player) {
        throw new Error(`Player ${transaction.userId} not found`);
      }

      const currentRingBall = player.RingBall ?? 0;
      if (currentRingBall < ringBallChange) {
        throw new Error(`Not enough RingBall for player ${transaction.userId}`);
      }

      await tx.player.update({
        where: { id: transaction.userId },
        data: { RingBall: { decrement: ringBallChange } },
      });

      const nextSeq = await getNextSeqForUser(tx, transaction.userId);

      const history = await tx.balanceHistory.create({
        data: {
          userId: transaction.userId,
          seq: nextSeq,
          ringBall: -ringBallChange,
          money: moneyChange,
          description: transaction.description,
          eventType: transaction.eventType ?? 'GAME_BET_DEDUCTION',
        },
      });

      histories.push({ userId: history.userId, seq: history.seq });
    }

    return histories;
  });
};
