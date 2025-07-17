import prisma from '../models/prismaClient';

// Location id used in EquipPlayer to mark the equipped ball slot
const BALL_SLOT_LOCATION_ID = 2;

export interface BallPhysics {
  Mass: number | null;
  GravityScale: number | null;
  Drag: number | null;
  Bounciness: number | null;
  Elasticity: number | null;
  ImpactResistance: number | null;
  level: number;
}

<<<<<<< HEAD
export const getBallPhysicsByPlayer = async (playerId: number): Promise<BallPhysics | null> => {
  const playerItem = await prisma.playerItem.findFirst({
    where: {
      playerId,
      item: { typeGid: 1 },
    },
    include: { item: true },
    orderBy: { seq: 'asc' },
=======
export const getBallPhysicsByPlayer = async (
  playerId: number
): Promise<BallPhysics | null> => {
  // Get equipped ball from EquipPlayer table based on location
  const equip = await (prisma as any).equipPlayer.findFirst({
    where: { playerId, locationId: BALL_SLOT_LOCATION_ID },
    select: { itemId: true, seq: true },
  });

  if (!equip) {
    return null;
  }

  const playerItem = await prisma.playerItem.findUnique({
    where: {
      playerId_itemId_seq: {
        playerId,
        itemId: equip.itemId,
        seq: equip.seq,
      },
    },
    select: { level: true },
>>>>>>> origin/codex/update-getballphysicsbyplayer-method
  });

  if (!playerItem) {
    return null;
  }

<<<<<<< HEAD
  const item = playerItem.item;
=======
  const item = await prisma.item.findUnique({
    where: { id: equip.itemId },
    select: {
      Mass: true,
      GravityScale: true,
      Drag: true,
      Bounciness: true,
      Elasticity: true,
      ImpactResistance: true,
    },
  });

  if (!item) {
    return null;
  }

>>>>>>> origin/codex/update-getballphysicsbyplayer-method
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
