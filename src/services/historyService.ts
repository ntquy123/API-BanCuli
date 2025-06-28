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
const getTodayTransdate = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return Number(`${year}${month}${day}`);
};

export const createHistory = async (data: HistoryData) => {
  const transdate = getTodayTransdate();
  const last = await prisma.history.findFirst({
    where: { playerId: data.playerId, transdate },
    orderBy: { seq: 'desc' },
  });
  const seq = last ? last.seq + 1 : 1;

  return prisma.history.create({
    data: {
      playerId: data.playerId,
      transdate,
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
