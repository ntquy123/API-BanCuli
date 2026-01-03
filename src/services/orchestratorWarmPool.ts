import { TypeMatchGid } from "../config/typeMatchGid";
import { DockerOrchestrator, DockerContainerInfo } from "./orchestrator";

export interface WarmupSummary {
  warmBuffer: Record<number, DockerContainerInfo[]>;
  minEmptyRooms: number; // giữ tên cũ để UI/debug không đổi nhiều
  maxRooms: number;
  region: string;
}

const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 20;
const DEFAULT_REGION = process.env.DEFAULT_REGION || "asia";
const DEFAULT_MIN_IDLE_PER_TYPE = Number(process.env.MIN_IDLE_DS_PER_TYPE) || 1;
const DEFAULT_TYPES_TO_WARM: TypeMatchGid[] = [
  TypeMatchGid.MatchRandomNormal,
  TypeMatchGid.MatchRandomRank,
  TypeMatchGid.MatchRoom,
];

type EnsureWarmParams = {
  region: string;
  types: TypeMatchGid[];
  minIdlePerType: number;
};

export async function ensureWarmIdleContainers(params: EnsureWarmParams) {
  const { region, types, minIdlePerType } = params;

  // Với CCU=20, warm pool tổng 2 là hợp lý
  const maxIdleTotal = Number(process.env.MAX_IDLE_DS_TOTAL) || 2;

  const currentIdle = await DockerOrchestrator.listManagedContainers({
    region,
    mode: "IDLE",
  });

  if (currentIdle.length >= maxIdleTotal) return;

  let remainingBudget = maxIdleTotal - currentIdle.length;

  for (const type of types) {
    if (remainingBudget <= 0) break;

    const idleOfType = currentIdle.filter((c) => c.labels.typeMatchGid === String(type));
    const need = Math.max(0, minIdlePerType - idleOfType.length);
    if (need <= 0) continue;

    const spawnCount = Math.min(need, remainingBudget);

    for (let i = 0; i < spawnCount; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await DockerOrchestrator.startDedicatedServer({
        mode: "IDLE",
        region,
        typeMatchGid: type,
      });
    }

    remainingBudget -= spawnCount;
  }
}

export async function getWarmPoolSummary(params: EnsureWarmParams): Promise<WarmupSummary> {
  const { region, types, minIdlePerType } = params;

  const warmBuffer: Record<number, DockerContainerInfo[]> = {};

  const current = await DockerOrchestrator.listManagedContainers({
    region,
    mode: "IDLE",
  });

  for (const type of types) {
    warmBuffer[type] = current.filter((c) => c.labels.typeMatchGid === String(type));
  }

  return {
    warmBuffer,
    minEmptyRooms: minIdlePerType,
    maxRooms: MAX_ROOMS,
    region,
  };
}

export async function buildWarmPoolSummary({
  region = DEFAULT_REGION,
  types = DEFAULT_TYPES_TO_WARM,
  minIdlePerType = DEFAULT_MIN_IDLE_PER_TYPE,
}: Partial<EnsureWarmParams> = {}): Promise<WarmupSummary> {
  await ensureWarmIdleContainers({ region, types, minIdlePerType });
  return getWarmPoolSummary({ region, types, minIdlePerType });
}
