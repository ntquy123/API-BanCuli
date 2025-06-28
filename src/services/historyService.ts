import prisma from '../models/prismaClient';

interface HistoryData {
  playerId: number;
  opponentId: number;
  isWin: boolean;
  rounds?: number;
  marblesWon?: number;
  marblesLost?: number;
  expGained?: number;
  description?: string;
}

export const createHistory = async (data: HistoryData) => {
  const last = await prisma.history.findFirst({
    where: { playerId: data.playerId },
    orderBy: { seq: 'desc' },
  });
  const seq = last ? last.seq + 1 : 1;

  return prisma.history.create({
    data: {
      playerId: data.playerId,
      seq,
      opponentId: data.opponentId,
      isWin: data.isWin,
      rounds: data.rounds,
      marblesWon: data.marblesWon,
      marblesLost: data.marblesLost,
      expGained: data.expGained,
      description: data.description,
    },
  });
};
