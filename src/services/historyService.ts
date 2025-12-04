import prisma from '../models/prismaClient';

export interface HistoryData {
  playerId: number;
  transno: bigint;
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
  rankPoints?: number;
  description?: string;
}



export const createHistory = async (data: HistoryData) => {


  return prisma.history.create({
    data: {
      playerId: data.playerId,
      transno: data.transno,
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
      rankPoints: data.rankPoints,
      description: data.description,
    },
  });
};

export const getHistoryStatsByPlayer = async (playerId: number) => {
  const [totalMatches, totalWins, rankAggregate] = await Promise.all([
    prisma.history.count({ where: { playerId } }),
    prisma.history.count({ where: { playerId, statusWin: 1 } }),
    prisma.history.aggregate({ where: { playerId }, _sum: { rankPoints: true } }),
  ]);

  const winRateRaw = totalMatches > 0 ? (totalWins / totalMatches) * 100 : 0;
  return {
    playerId,
    totalMatches,
    winRate: parseFloat(winRateRaw.toFixed(2)),
    totalRankPoints: rankAggregate._sum.rankPoints ?? 0,
  };
};

export const getHistories = async (skip = 0, take = 10) => {
  return prisma.history.findMany({
    include: {
      player: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    skip,
    take,
  });
};

// Keep for backward compatibility if other modules use it
export const getAllHistories = async () => {
  return prisma.history.findMany({
    include: {
      player: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

export const getRankLeaderboard = async (limit = 100) => {
  const groupedHistories = await prisma.history.groupBy({
    by: ['playerId'],
    _sum: {
      rankPoints: true,
    },
    orderBy: {
      _sum: {
        rankPoints: 'desc',
      },
    },
    take: limit,
  });

  const playerIds = groupedHistories.map((history) => history.playerId);

  const players = await prisma.player.findMany({
    where: {
      id: {
        in: playerIds,
      },
    },
    select: {
      id: true,
      PlayerName: true,
      Level: true,
      RingBall: true,
    },
  });

  const playerMap = new Map(players.map((player) => [player.id, player]));

  return groupedHistories.map((history) => {
    const player = playerMap.get(history.playerId);

    return {
      playerId: history.playerId,
      totalRankPoints: history._sum.rankPoints ?? 0,
      playerName: player?.PlayerName ?? null,
      level: player?.Level ?? null,
      ringBall: player?.RingBall ?? null,
    };
  });
};
