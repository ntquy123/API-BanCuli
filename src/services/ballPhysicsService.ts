import prisma from '../models/prismaClient';

export interface BallPhysics {
  Mass: number | null;
  GravityScale: number | null;
  Drag: number | null;
  Bounciness: number | null;
  Elasticity: number | null;
  ImpactResistance: number | null;
  level: number;
}

export const getBallPhysicsByPlayer = async (playerId: number): Promise<BallPhysics | null> => {
  const playerItem = await prisma.playerItem.findFirst({
    where: {
      playerId,
      item: { typeGid: 1 },
    },
    include: { item: true },
    orderBy: { seq: 'asc' },
  });

  if (!playerItem) {
    return null;
  }

  const item = playerItem.item;
  const level = playerItem.level;
  const factor = 1 + 0.1 * (level - 1);

  return {
    Mass: item.Mass !== null ? item.Mass * factor : null,
    GravityScale: item.GravityScale !== null ? item.GravityScale * factor : null,
    Drag: item.Drag !== null ? item.Drag / factor : null,
    Bounciness: item.Bounciness !== null ? item.Bounciness * factor : null,
    Elasticity: item.Elasticity !== null ? item.Elasticity * factor : null,
    ImpactResistance: item.ImpactResistance !== null ? item.ImpactResistance * factor : null,
    level,
  };
};

export const getBallPhysicsByPlayers = async (playerIds: number[]): Promise<{ playerId: number; physics: BallPhysics | null }[]> => {
  const results = await Promise.all(
    playerIds.map(async (id) => ({ playerId: id, physics: await getBallPhysicsByPlayer(id) }))
  );
  return results;
};
