import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

const DOCKER_RUNTIME = process.env.DOCKER_BIN || 'docker';
const PODMAN_ALIAS_MESSAGE =
  'Emulate Docker CLI using podman. Create /etc/containers/nodocker to quiet msg.';

export type RunningContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  cpu?: string;
  memory?: string;
};

type ContainerStats = {
  id: string;
  cpu: string;
  memory: string;
};

const parseDockerErrors = (stderr: string) => {
  const stderrLines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredErrors = stderrLines.filter((line) => line !== PODMAN_ALIAS_MESSAGE);

  if (filteredErrors.length > 0) {
    throw new Error(filteredErrors.join('; '));
  }
};

const fetchContainerStats = async (containerIds: string[]): Promise<Record<string, ContainerStats>> => {
  if (containerIds.length === 0) {
    return {};
  }

  const { stdout, stderr } = await execPromise(
    `${DOCKER_RUNTIME} stats --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}" ${containerIds.join(' ')}`,
  );

  parseDockerErrors(stderr);

  const stats: Record<string, ContainerStats> = {};

  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [id, cpu, memory] = line.split('|');
      if (id) {
        stats[id] = {
          id,
          cpu: cpu ?? '—',
          memory: memory ?? '—',
        };
      }
    });

  return stats;
};

export async function listRunningContainers(): Promise<RunningContainer[]> {
  const { stdout, stderr } = await execPromise(
    `${DOCKER_RUNTIME} ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"`,
  );

  parseDockerErrors(stderr);

  const containers = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, name, image, status, ports] = line.split('|');
      return {
        id: id ?? '',
        name: name ?? '',
        image: image ?? '',
        status: status ?? '',
        ports: ports ?? '',
      };
    });

  const statsMap = await fetchContainerStats(containers.map((container) => container.id));

  return containers.map((container) => ({
    ...container,
    cpu: statsMap[container.id]?.cpu ?? '—',
    memory: statsMap[container.id]?.memory ?? '—',
  }));
}

export async function fetchContainerLogs(containerId: string, tail = 200): Promise<string> {
  const sanitizedTail = Number.isFinite(tail) && tail > 0 ? Math.min(tail, 1000) : 200;
  const { stdout, stderr } = await execPromise(
    `${DOCKER_RUNTIME} logs --tail ${sanitizedTail} ${containerId}`,
  );

  parseDockerErrors(stderr);

  return stdout || 'Không có log để hiển thị.';
}
