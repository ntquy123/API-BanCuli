import { ensureEmptyRooms, MAX_ROOMS, resetServerPortPoolIfIdle } from '../services/matchmakingService';
import { TypeMatchGid } from '../config/typeMatchGid';

export interface WarmupSummary {
  warmBuffer: Record<number, Awaited<ReturnType<typeof ensureEmptyRooms>>>;
  minEmptyRooms: number;
  maxRooms: number;
}

const DEFAULT_MIN_ROOMS_PER_TYPE = 2;
const DEFAULT_TYPES_TO_WARM: TypeMatchGid[] = [
  TypeMatchGid.MatchRandomNormal,
  TypeMatchGid.MatchRandomRank,
  TypeMatchGid.MatchRoom,
];

export async function buildWarmupSummary(minRoomsPerType = DEFAULT_MIN_ROOMS_PER_TYPE): Promise<WarmupSummary> {
  await resetServerPortPoolIfIdle();

  const warmedRooms = await Promise.all(
    DEFAULT_TYPES_TO_WARM.map(async (type) => ({
      type,
      rooms: await ensureEmptyRooms(type, minRoomsPerType),
    })),
  );

  const warmBuffer = warmedRooms.reduce<Record<number, (typeof warmedRooms)[number]['rooms']>>(
    (acc, current) => ({ ...acc, [current.type]: current.rooms }),
    {},
  );

  return {
    warmBuffer,
    minEmptyRooms: minRoomsPerType,
    maxRooms: MAX_ROOMS,
  };
}
