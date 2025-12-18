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
};

export async function listRunningContainers(): Promise<RunningContainer[]> {
  const { stdout, stderr } = await execPromise(
    `${DOCKER_RUNTIME} ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"`,
  );

  const stderrLines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredErrors = stderrLines.filter((line) => line !== PODMAN_ALIAS_MESSAGE);

  if (filteredErrors.length > 0) {
    throw new Error(filteredErrors.join('; '));
  }

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

  return containers;
}
