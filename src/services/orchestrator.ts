import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type SpawnParams = {
  matchId: string;
  sessionName: string;
  maxPlayers: number;
  bet: number;
  region: string;
};

export class DockerOrchestrator {
  // TODO: đổi thành image DS thực tế của bạn
  private static DS_IMAGE = process.env.DS_IMAGE || "your-ds-image:latest";

  // Backend URL để DS callback READY/RESULT
  private static BACKEND_URL = process.env.BACKEND_URL || "http://backend:3000";

  // Spawn container cho 1 match (1 container = 1 match)
  static async spawnMatchContainer(p: SpawnParams) {
    // NOTE: bạn cần đảm bảo node chạy backend có quyền chạy docker (hoặc gọi qua orchestrator riêng)
    const env = [
      `MATCH_ID=${p.matchId}`,
      `SESSION_NAME=${p.sessionName}`,
      `MAX_PLAYERS=${p.maxPlayers}`,
      `BET=${p.bet}`,
      `REGION=${p.region}`,
      `BACKEND_URL=${this.BACKEND_URL}`,
      // Nếu muốn: JOIN_SECRET/TOKEN_ID
      `MODE=MATCH`,
    ];

    const args = [
      "run",
      "--rm",
      "--name",
      `ds_${p.matchId}`,
      ...env.flatMap((e) => ["-e", e]),
      this.DS_IMAGE,
    ];

    // Không await “container chạy xong”; chỉ cần fire-and-forget.
    // Container sẽ callback READY về backend khi sẵn sàng.
    execFile("docker", args, (err, stdout, stderr) => {
      if (err) {
        // Log lỗi để debug
        console.error("[DockerOrchestrator] docker run failed", err, stderr);
      } else {
        console.log("[DockerOrchestrator] docker run started", stdout);
      }
    });

    return { ok: true };
  }

  // Warm pool assign (chỉ dùng nếu DS idle có endpoint nhận assign)
  static async assignToIdleDs(_p: {
    dsId: string;
    matchId: string;
    sessionName: string;
    maxPlayers: number;
    bet: number;
    region: string;
  }) {
    // Placeholder: phụ thuộc bạn expose HTTP nội bộ như thế nào.
    // Bạn có thể bỏ warm pool phần "assign" nếu chưa implement DS idle endpoint.
    return { ok: true };
  }

  static async tryStopContainerById(containerIdOrName: string) {
    try {
      await execFileAsync("docker", ["stop", containerIdOrName], { timeout: 5000 });
    } catch {
      // ignore
    }
  }
}
