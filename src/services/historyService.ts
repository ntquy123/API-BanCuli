import prisma from '../models/prismaClient';

export interface HistoryData {
  playerId: number;
  transno: bigint;
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



export const createHistory = async (data: HistoryData) => {


  return prisma.history.create({
    data: {
      playerId: data.playerId,
      transno: data.transno,
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
