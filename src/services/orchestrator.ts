import { execFile } from "child_process";
import { promisify } from "util";
import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const execFileAsync = promisify(execFile);

export type DsMode = "IDLE" | "MATCH";

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
      mode: "IDLE";
      region: string;
      typeMatchGid: number;
    }
  | {
      mode: "MATCH";
      region: string;
      typeMatchGid: number;
      matchId: string;
      sessionName: string;
      maxPlayers: number;
      bet: number;
    };

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function stripIgnorableDockerStderr(stderr: string) {
  const lines = stderr
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const nonIgnorable = lines.filter(
    (l) =>
      !l.startsWith("Emulate Docker CLI using podman.") &&
      !l.includes("Create /etc/containers/nodocker to quiet msg."),
  );

  return nonIgnorable.join("\n");
}

function postJson(urlStr: string, payload: any, timeoutMs = 5000): Promise<{ ok: boolean; status: number; body: string }> {
  const u = new URL(urlStr);
  const data = Buffer.from(JSON.stringify(payload), "utf8");
  const lib = u.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80,
        path: u.pathname + u.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": data.length,
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
            status: res.statusCode ?? 0,
            body,
          }),
        );
      },
    );

    req.on("timeout", () => req.destroy(new Error("HTTP_TIMEOUT")));
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

export class DockerOrchestrator {
  private static DOCKER_BIN = process.env.DOCKER_BIN || "docker";
  private static DS_IMAGE = process.env.ROOM_DOCKER_IMAGE || "banculi/unity-dedicated:latest";

  // DS callback READY/RESULT về backend theo URL này
  private static BACKEND_URL = process.env.BACKEND_URL || "http://backend:3000";

  // Backend và DS phải cùng network để gọi bằng container name
  private static DOCKER_NETWORK = process.env.DOCKER_NETWORK || "banculi-net";

  // Port HTTP nội bộ DS (IDLE nhận assign). DS phải listen port này trong container.
  private static DS_INTERNAL_HTTP_PORT = Number(process.env.DS_INTERNAL_HTTP_PORT) || 8080;

  // Linux: nếu BACKEND_URL dùng host.docker.internal thì cần map host
  private static ADD_HOST_LINUX = process.env.DOCKER_ADD_HOST || ""; // ví dụ "host.docker.internal:172.17.0.1"

  // label để list/cleanup
  private static APP_LABEL = process.env.DS_APP_LABEL || "banculi-ds";

  static async startDedicatedServer(p: StartDsParams) {
    const name =
      p.mode === "IDLE"
        ? `ds_idle_${safeName(p.region)}_${p.typeMatchGid}_${Date.now()}`
        : `ds_match_${safeName(p.matchId)}_${Date.now()}`;

    const env: string[] = [
      `MODE=${p.mode}`,
      `REGION=${p.region}`,
      `TYPE_MATCH_GID=${p.typeMatchGid}`,
      `BACKEND_URL=${this.BACKEND_URL}`,
      `DS_INTERNAL_HTTP_PORT=${this.DS_INTERNAL_HTTP_PORT}`,
      ...(process.env.JOIN_SECRET ? [`JOIN_SECRET=${process.env.JOIN_SECRET}`] : []),
      ...(process.env.TOKEN_ID ? [`TOKEN_ID=${process.env.TOKEN_ID}`] : []),
    ];

    if (p.mode === "MATCH") {
      env.push(
        `MATCH_ID=${p.matchId}`,
        `SESSION_NAME=${p.sessionName}`,
        `MAX_PLAYERS=${p.maxPlayers}`,
        `BET=${p.bet}`,
      );
    }

    const labels: string[] = [
      "--label",
      `app=${this.APP_LABEL}`,
      "--label",
      `region=${p.region}`,
      "--label",
      `mode=${p.mode}`,
      "--label",
      `typeMatchGid=${p.typeMatchGid}`,
    ];

    if (p.mode === "MATCH") {
      labels.push("--label", `matchId=${p.matchId}`, "--label", `sessionName=${p.sessionName}`);
    }

    const args: string[] = [
      "run",
      "-d",
      "--rm",
      "--name",
      name,
      ...labels,
      ...env.flatMap((e) => ["-e", e]),
    ];

    if (this.DOCKER_NETWORK) args.push("--network", this.DOCKER_NETWORK);
    if (this.ADD_HOST_LINUX) args.push("--add-host", this.ADD_HOST_LINUX);

    // Không cần publish port ra host; backend gọi bằng container name trong cùng network.
    args.push(this.DS_IMAGE);

    try {
      const { stdout, stderr } = await execFileAsync(this.DOCKER_BIN, args, { timeout: 60_000 });
      const nonIgnorable = stripIgnorableDockerStderr(stderr ?? "");
      if (nonIgnorable) throw new Error(`Docker start error: ${nonIgnorable}`);

      const containerId = (stdout || "").trim();
      if (!containerId) throw new Error("Docker start error: missing container id");

      return { containerId, name };
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "Unknown";
      if (msg.includes("ENOENT") || msg.includes("not found")) throw new Error("DOCKER_NOT_AVAILABLE");
      throw e;
    }
  }

  static async spawnMatchContainer(p: {
    region: string;
    typeMatchGid: number;
    matchId: string;
    sessionName: string;
    maxPlayers: number;
    bet: number;
  }) {
    return this.startDedicatedServer({
      mode: "MATCH",
      region: p.region,
      typeMatchGid: p.typeMatchGid,
      matchId: p.matchId,
      sessionName: p.sessionName,
      maxPlayers: p.maxPlayers,
      bet: p.bet,
    });
  }

  // Warm pool đúng nghĩa: assign match vào container IDLE đang chạy sẵn
  static async assignToIdleDs(p: {
    dsContainerName: string; // container NAME để gọi nội bộ
    matchId: string;
    sessionName: string;
    maxPlayers: number;
    bet: number;
    region: string;
    typeMatchGid: number;
  }) {
    const assignUrl = `http://${p.dsContainerName}:${this.DS_INTERNAL_HTTP_PORT}/internal/assign`;

    const payload = {
      matchId: p.matchId,
      sessionName: p.sessionName,
      maxPlayers: p.maxPlayers,
      bet: p.bet,
      region: p.region,
      typeMatchGid: p.typeMatchGid,
    };

    const resp = await postJson(assignUrl, payload, 5000);
    if (!resp.ok) {
      throw new Error(`ASSIGN_FAILED status=${resp.status} body=${resp.body}`);
    }
    return { ok: true };
  }

  static async tryStopContainerById(containerIdOrName: string) {
    try {
      await execFileAsync(this.DOCKER_BIN, ["stop", containerIdOrName], { timeout: 10_000 });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  }

  static async listManagedContainers(params: { region?: string; mode?: DsMode }): Promise<DockerContainerInfo[]> {
    const filters: string[] = ["--filter", `label=app=${this.APP_LABEL}`];
    if (params.region) filters.push("--filter", `label=region=${params.region}`);
    if (params.mode) filters.push("--filter", `label=mode=${params.mode}`);

    // id|name|region|mode|typeMatchGid|matchId|sessionName|createdAt
    const format =
      '{{.ID}}|{{.Names}}|{{.Label "region"}}|{{.Label "mode"}}|{{.Label "typeMatchGid"}}|{{.Label "matchId"}}|{{.Label "sessionName"}}|{{.CreatedAt}}';

    const args = ["ps", ...filters, "--format", format];

    const { stdout } = await execFileAsync(this.DOCKER_BIN, args, { timeout: 15_000 });
    const lines = (stdout || "")
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return lines.map((line) => {
      const [id, name, region, mode, typeMatchGid, matchId, sessionName, createdAt] = line.split("|");
      return {
        id,
        name,
        createdAt,
        labels: {
          app: this.APP_LABEL,
          region: region || "",
          mode: (mode as DsMode) || "IDLE",
          typeMatchGid: typeMatchGid || "0",
          matchId: matchId || undefined,
          sessionName: sessionName || undefined,
        },
      };
    });
  }
}
