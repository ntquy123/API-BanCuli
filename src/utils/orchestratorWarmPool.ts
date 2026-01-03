import { TypeMatchGid } from '../config/typeMatchGid';
import { DockerOrchestrator, DockerContainerInfo } from '../services/orchestrator';

export interface WarmupSummary {
  warmBuffer: Record<number, DockerContainerInfo[]>;
  minEmptyRooms: number; // giữ tên cũ để UI/debug không đổi nhiều
  maxRooms: number;
  region: string;
}

const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 20;
const DEFAULT_REGION = process.env.DEFAULT_REGION || 'asia';
const DEFAULT_MIN_IDLE_PER_TYPE = Number(process.env.MIN_IDLE_DS_PER_TYPE) || 2;
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

  // chống bùng nổ container: max warm pool tổng
  const maxIdleTotal = Number(process.env.MAX_IDLE_DS_TOTAL) || 4;

  // list hiện tại
  const current = await DockerOrchestrator.listManagedContainers({
    region,
    mode: 'IDLE',
  });

  if (current.length >= maxIdleTotal) {
    // đã đạt ngưỡng warm tổng, không spawn thêm
    return;
  }

  for (const type of types) {
    const idleOfType = current.filter((c) => c.labels.typeMatchGid === String(type));

    const need = Math.max(0, minIdlePerType - idleOfType.length);

    // spawn bổ sung nhưng không vượt quá maxIdleTotal
    const remainingBudget = Math.max(0, maxIdleTotal - (await DockerOrchestrator.listManagedContainers({ region, mode: 'IDLE' })).length);
    const spawnCount = Math.min(need, remainingBudget);

    for (let i = 0; i < spawnCount; i += 1) {
      // MODE=IDLE: container chỉ boot + register về backend, chưa StartGame
      // DS của bạn cần implement MODE=IDLE và POST /internal/ds/register
      // Nếu DS chưa có, vẫn spawn được nhưng DS sẽ tự tạo match -> không đúng warm pool.
      // Vì vậy hãy cập nhật DS sớm.
      // eslint-disable-next-line no-await-in-loop
      await DockerOrchestrator.startDedicatedServer({
        mode: 'IDLE',
        region,
        typeMatchGid: type,
      });
    }
  }
}

export async function getWarmPoolSummary(params: EnsureWarmParams): Promise<WarmupSummary> {
  const { region, types, minIdlePerType } = params;

  const warmBuffer: Record<number, DockerContainerInfo[]> = {};

  const current = await DockerOrchestrator.listManagedContainers({
    region,
    mode: 'IDLE',
  });

  for (const type of types) {
    warmBuffer[type] = current.filter((c) => c.labels.typeMatchGid === String(type));
  }

  return {
    warmBuffer,
    minEmptyRooms: minIdlePerType, // giữ key cũ
    maxRooms: MAX_ROOMS,
    region,
  };
}

export async function buildWarmPoolSummary({
  region = DEFAULT_REGION,
  types = DEFAULT_TYPES_TO_WARM,
  minIdlePerType = DEFAULT_MIN_IDLE_PER_TYPE,
}: Partial<EnsureWarmParams> = {}): Promise<WarmupSummary> {
  await ensureWarmIdleContainers({
    region,
    types,
    minIdlePerType,
  });

  return getWarmPoolSummary({
    region,
    types,
    minIdlePerType,
  });
}
