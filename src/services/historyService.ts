import prisma from '../models/prismaClient';

export interface HistoryData {
  playerId: number;
  isWin?: boolean;
  turnOrder?: number;
  typeMatchGid?: number;
  statusWin?: number;
  mapGame?: string;
  maxPlayer?: number;
  rounds?: number;
  marbBet?: number;
  marblesWon?: number;
  marblesLost?: number;
  expGained?: number;
  description?: string;
}

const generateTransno = (): number => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const milli = String(now.getMilliseconds()).padStart(3, '0');
  return Number(`${year}${month}${day}${hour}${minute}${second}${milli}`);
};

export const createHistory = async (data: HistoryData) => {
  const transno = generateTransno();

  return prisma.history.create({
    data: {
      playerId: data.playerId,
      transno,
      isWin: data.isWin,
      turnOrder: data.turnOrder,
      typeMatchGid: data.typeMatchGid,
      statusWin: data.statusWin,
      mapGame: data.mapGame,
      maxPlayer: data.maxPlayer,
      rounds: data.rounds,
      marbBet: data.marbBet,
      marblesWon: data.marblesWon,
      marblesLost: data.marblesLost,
      expGained: data.expGained,
      description: data.description,
    },
  });
};
