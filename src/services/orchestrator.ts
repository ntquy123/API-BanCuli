import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type DsMode = 'IDLE' | 'MATCH';

export type DockerContainerInfo = {
  id: string;
  name: string;
  createdAt?: string;
  labels: {
    app: string;
    region: string;
    mode: DsMode;
    typeMatchGid: string;
    matchId?: string;
    sessionName?: string;
  };
};

type StartDsParams =
  | {
      mode: 'IDLE';
      region: string;
      typeMatchGid: number;
    }
  | {
      mode: 'MATCH';
      region: string;
      typeMatchGid: number;
      matchId: string;
      sessionName: string;
      maxPlayers: number;
      bet: number;
    };

function stripIgnorableDockerStderr(stderr: string) {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const nonIgnorable = lines.filter(
    (l) => !l.startsWith('Emulate Docker CLI using podman.') &&
           !l.includes('Create /etc/containers/nodocker to quiet msg.'),
  );

  return nonIgnorable.join('\n');
}

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

export class DockerOrchestrator {
  private static DOCKER_BIN = process.env.DOCKER_BIN || 'docker';
  private static DS_IMAGE = process.env.ROOM_DOCKER_IMAGE || 'banculi/unity-dedicated:latest';

  // Nếu backend chạy trong docker network, set BACKEND_URL = http://backend:3000
  // Nếu backend chạy ngoài host, dùng http://host.docker.internal:3000 (Linux cần thêm --add-host)
  private static BACKEND_URL = process.env.BACKEND_URL || 'http://backend:3000';

  private static DOCKER_NETWORK = process.env.DOCKER_NETWORK || ''; // ví dụ: "banculi-net"
  private static ADD_HOST_LINUX = process.env.DOCKER_ADD_HOST || ''; // ví dụ: "host.docker.internal:172.17.0.1"

  // Labels để lọc/quan sát/cleanup
  private static APP_LABEL = process.env.DS_APP_LABEL || 'banculi-ds';

  static async startDedicatedServer(p: StartDsParams) {
    // container name
    const name =
      p.mode === 'IDLE'
        ? `ds_idle_${safeName(p.region)}_${p.typeMatchGid}_${Date.now()}`
        : `ds_match_${safeName(p.matchId)}_${Date.now()}`;

    const env: string[] = [
      `MODE=${p.mode}`,
      `REGION=${p.region}`,
      `TYPE_MATCH_GID=${p.typeMatchGid}`,
      `BACKEND_URL=${this.BACKEND_URL}`,
    ];

    if (p.mode === 'MATCH') {
      env.push(
        `MATCH_ID=${p.matchId}`,
        `SESSION_NAME=${p.sessionName}`,
        `MAX_PLAYERS=${p.maxPlayers}`,
        `BET=${p.bet}`,
      );
    }

    // Optional security/env
    if (process.env.JOIN_SECRET) env.push(`JOIN_SECRET=${process.env.JOIN_SECRET}`);
    if (process.env.TOKEN_ID) env.push(`TOKEN_ID=${process.env.TOKEN_ID}`);

    // Labels
    const labels: string[] = [
      `--label`, `app=${this.APP_LABEL}`,
      `--label`, `region=${p.region}`,
      `--label`, `mode=${p.mode}`,
      `--label`, `typeMatchGid=${p.typeMatchGid}`,
    ];

    if (p.mode === 'MATCH') {
      labels.push(`--label`, `matchId=${p.matchId}`, `--label`, `sessionName=${p.sessionName}`);
    }

    const args: string[] = [
      'run',
      '-d',
      '--rm',
      '--name', name,
      ...labels,
      ...env.flatMap((e) => ['-e', e]),
    ];

    // network
    if (this.DOCKER_NETWORK) {
      args.push('--network', this.DOCKER_NETWORK);
    }

    // Linux: nếu bạn dùng BACKEND_URL=host.docker.internal thì cần map host
    if (this.ADD_HOST_LINUX) {
      args.push('--add-host', this.ADD_HOST_LINUX);
    }

    // image
    args.push(this.DS_IMAGE);

    // Nếu DS của bạn có entrypoint/args riêng, bạn thêm tại đây.
    // Ví dụ bạn đang dùng EXTRA_SERVER_ARGS trong service cũ, hãy giữ trong image/entrypoint thay vì truyền ở đây.
    // Nếu vẫn cần, bạn có thể args.push(...)

    try {
      const { stdout, stderr } = await execFileAsync(this.DOCKER_BIN, args, { timeout: 60_000 });

      const nonIgnorable = stripIgnorableDockerStderr(stderr ?? '');
      if (nonIgnorable) {
        throw new Error(`Docker start error: ${nonIgnorable}`);
      }

      const containerId = (stdout || '').trim();
      if (!containerId) {
        throw new Error('Docker start error: missing container id');
      }

      return { containerId, name };
    } catch (e: any) {
      // Nếu docker không có hoặc permission sai
      const msg = e?.message ? String(e.message) : 'Unknown';
      if (msg.includes('ENOENT') || msg.includes('not found')) {
        throw new Error('DOCKER_NOT_AVAILABLE');
      }
      throw e;
    }
  }

  static async listManagedContainers(params: { region?: string; mode?: DsMode }): Promise<DockerContainerInfo[]> {
    const filters: string[] = [
      '--filter', `label=app=${this.APP_LABEL}`,
    ];

    if (params.region) filters.push('--filter', `label=region=${params.region}`);
    if (params.mode) filters.push('--filter', `label=mode=${params.mode}`);

    // format: id|name|label-region|label-mode|label-typeMatchGid|label-matchId|label-sessionName|createdAt
    const format =
      '{{.ID}}|{{.Names}}|{{.Label "region"}}|{{.Label "mode"}}|{{.Label "typeMatchGid"}}|{{.Label "matchId"}}|{{.Label "sessionName"}}|{{.CreatedAt}}';

    const args = ['ps', ...filters, '--format', format];

    const { stdout } = await execFileAsync(this.DOCKER_BIN, args, { timeout: 15_000 });
    const lines = (stdout || '').trim().split('\n').map((l) => l.trim()).filter(Boolean);

    return lines.map((line) => {
      const [id, name, region, mode, typeMatchGid, matchId, sessionName, createdAt] = line.split('|');
      return {
        id,
        name,
        createdAt,
        labels: {
          app: this.APP_LABEL,
          region: region || '',
          mode: (mode as DsMode) || 'IDLE',
          typeMatchGid: typeMatchGid || '0',
          matchId: matchId || undefined,
          sessionName: sessionName || undefined,
        },
      };
    });
  }

  static async stopContainerByNameOrId(idOrName: string) {
    try {
      await execFileAsync(this.DOCKER_BIN, ['stop', idOrName], { timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  // helper cho match flow (spawn match container)
  static async spawnMatchContainer(p: {
    region: string;
    typeMatchGid: number;
    matchId: string;
    sessionName: string;
    maxPlayers: number;
    bet: number;
  }) {
    return this.startDedicatedServer({
      mode: 'MATCH',
      region: p.region,
      typeMatchGid: p.typeMatchGid,
      matchId: p.matchId,
      sessionName: p.sessionName,
      maxPlayers: p.maxPlayers,
      bet: p.bet,
    });
  }
}
