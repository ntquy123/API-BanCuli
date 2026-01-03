import crypto from "crypto";
import { DockerOrchestrator } from "./orchestrator";

type EnqueueParams = {
  userId: number;
  bet: number;
  region: string;
  typeMatchGid: number;
};

type EnqueueCtx = {
  matchSize: number;
  maxCCU: number;
  serverReadyTimeoutMs: number;
  playerJoinDeadlineMs: number;
  io: any;
  signJoinToken: (payload: object) => string;
};

type DsInfo = {
  dsId: string;
  region: string;
  status: "IDLE" | "BUSY";
  lastSeenAt: number;
};

type MatchState =
  | "QUEUED"
  | "MATCH_ALLOCATED"
  | "SERVER_CREATING"
  | "READY"
  | "IN_PROGRESS"
  | "FINISHED"
  | "FAILED"
  | "CANCELLED";

type MatchRecord = {
  matchId: string;
  sessionName: string;
  region: string;
  bet: number;
  typeMatchGid: number;
  players: number[];          // userIds
  createdAt: number;
  state: MatchState;
  dsId: string | null;

  serverReadyTimer?: NodeJS.Timeout;
  playerJoinTimer?: NodeJS.Timeout;
};

function makeMatchId() {
  return "m_" + crypto.randomBytes(8).toString("hex");
}

function makeSessionName(region: string) {
  // mã phòng ngắn: 7 ký tự base32-like, tránh O/0 I/1
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 7; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${region.toUpperCase()}-${s}`;
}

function userRoom(userId: number) {
  return `user:${userId}`;
}

export class Matchmaker {
  static instance = new Matchmaker();

  // Queue theo bucket: region + typeMatchGid + bet
  private queue = new Map<string, number[]>(); // key -> userIds
  private queuedUsers = new Set<number>();

  // Match records
  private matches = new Map<string, MatchRecord>();

  // DS warm pool (optional)
  private dsPool = new Map<string, DsInfo>(); // dsId -> info

  // CCU tracking (approx): chỉ tính khi đã phát ticket (vì lúc đó client sẽ connect)
  private reservedCCUSlots = 0;

  async enqueue(p: EnqueueParams, ctx: EnqueueCtx) {
    const { io } = ctx;

    if (this.queuedUsers.has(p.userId)) {
      return {
        http: {
          status: "ALREADY_QUEUED",
          message: "Bạn đang ở trong hàng chờ",
        },
      };
    }

    const key = this.bucketKey(p);

    const arr = this.queue.get(key) ?? [];
    arr.push(p.userId);
    this.queue.set(key, arr);
    this.queuedUsers.add(p.userId);

    // Push queue:update riêng cho user
    io.to(userRoom(p.userId)).emit("queue:update", {
      bucket: key,
      current: Math.min(arr.length, ctx.matchSize),
      required: ctx.matchSize,
    });

    // Try allocate match if đủ người
    await this.tryAllocate(key, p, ctx);

    return {
      http: {
        status: "QUEUED",
        bucket: key,
        message: "Đã vào hàng chờ",
      },
    };
  }

  cancel(userId: number, io: any) {
    if (!this.queuedUsers.has(userId)) {
      return { status: "NOT_IN_QUEUE" };
    }

    // remove from all buckets (đơn giản)
    for (const [k, arr] of this.queue.entries()) {
      const idx = arr.indexOf(userId);
      if (idx >= 0) {
        arr.splice(idx, 1);
        this.queue.set(k, arr);
        break;
      }
    }

    this.queuedUsers.delete(userId);
    io.to(userRoom(userId)).emit("queue:cancelled", { userId });
    return { status: "CANCELLED" };
  }

  registerDs(ds: { dsId: string; region: string; status: "IDLE" | "BUSY" }) {
    this.dsPool.set(ds.dsId, {
      dsId: ds.dsId,
      region: ds.region,
      status: ds.status,
      lastSeenAt: Date.now(),
    });
  }

  onServerReady(args: {
    matchId: string;
    sessionName: string;
    region: string;
    dsId: string | null;
    io: any;
    signJoinToken: (payload: object) => string;
    playerJoinDeadlineMs: number;
  }) {
    const m = this.matches.get(args.matchId);
    if (!m) return false;

    if (m.state === "FAILED" || m.state === "CANCELLED" || m.state === "FINISHED") {
      return false;
    }

    // Cancel server-ready timeout
    if (m.serverReadyTimer) clearTimeout(m.serverReadyTimer);

    m.state = "READY";
    m.sessionName = args.sessionName;
    m.region = args.region;
    m.dsId = args.dsId ?? m.dsId;

    // Issue join tickets
    for (const uid of m.players) {
      const token = args.signJoinToken({
        matchId: m.matchId,
        userId: uid,
        sessionName: m.sessionName,
        region: m.region,
        exp: Date.now() + args.playerJoinDeadlineMs,
      });

      args.io.to(userRoom(uid)).emit("match:ticket", {
        matchId: m.matchId,
        sessionName: m.sessionName,
        region: m.region,
        joinToken: token,
        deadlineMs: args.playerJoinDeadlineMs,
      });
    }

    // Start join deadline timer (nếu bạn muốn, có thể require client ACK)
    m.playerJoinTimer = setTimeout(() => {
      // Nếu bạn không có ACK join, thì timer này dùng để fail-safe:
      // Sau deadline, nếu match chưa IN_PROGRESS thì fail.
      const mm = this.matches.get(m.matchId);
      if (!mm) return;
      if (mm.state === "READY" || mm.state === "SERVER_CREATING" || mm.state === "MATCH_ALLOCATED") {
        this.failMatch(mm.matchId, args.io, "PLAYER_JOIN_TIMEOUT");
      }
    }, args.playerJoinDeadlineMs);

    this.matches.set(m.matchId, m);
    return true;
  }

  onMatchResult(args: { matchId: string; result: unknown; io: any }) {
    const m = this.matches.get(args.matchId);
    if (!m) return { status: "NOT_FOUND" };

    m.state = "FINISHED";
    this.matches.set(m.matchId, m);

    // Free CCU slots (approx)
    this.reservedCCUSlots = Math.max(0, this.reservedCCUSlots - m.players.length);

    // notify players
    for (const uid of m.players) {
      args.io.to(userRoom(uid)).emit("match:finished", {
        matchId: m.matchId,
        result: args.result,
      });
    }

    return { status: "RESULT_RECEIVED", matchId: m.matchId };
  }

  // ---------------- Internals ----------------

  private bucketKey(p: EnqueueParams) {
    // Bạn có thể “bucket hóa bet” theo khoảng để dễ ghép
    // ví dụ: bet 100/200/500...
    return `${p.region}|type:${p.typeMatchGid}|bet:${p.bet}`;
  }

  private async tryAllocate(bucketKey: string, p: EnqueueParams, ctx: EnqueueCtx) {
    const arr = this.queue.get(bucketKey) ?? [];
    if (arr.length < ctx.matchSize) {
      // update counts for everyone in bucket (optional)
      for (const uid of arr) {
        ctx.io.to(userRoom(uid)).emit("queue:update", {
          bucket: bucketKey,
          current: arr.length,
          required: ctx.matchSize,
        });
      }
      return;
    }

    // CCU gate: chỉ cấp match nếu còn đủ slot để phát ticket cho match này
    if (this.reservedCCUSlots + ctx.matchSize > ctx.maxCCU) {
      // queue vẫn giữ, nhưng không allocate
      for (const uid of arr.slice(0, ctx.matchSize)) {
        ctx.io.to(userRoom(uid)).emit("queue:blocked", {
          reason: "CCU_FULL",
          maxCCU: ctx.maxCCU,
        });
      }
      return;
    }

    // lock players
    const players = arr.splice(0, ctx.matchSize);
    this.queue.set(bucketKey, arr);
    for (const uid of players) this.queuedUsers.delete(uid);

    const matchId = makeMatchId();
    const sessionName = makeSessionName(p.region);

    const match: MatchRecord = {
      matchId,
      sessionName,
      region: p.region,
      bet: p.bet,
      typeMatchGid: p.typeMatchGid,
      players,
      createdAt: Date.now(),
      state: "MATCH_ALLOCATED",
      dsId: null,
    };
    this.matches.set(matchId, match);

    // Reserve CCU slots now (vì sắp phát ticket)
    this.reservedCCUSlots += players.length;

    // Notify match found -> client chuyển Loading ngay
    for (const uid of players) {
      ctx.io.to(userRoom(uid)).emit("match:found", {
        matchId,
        required: ctx.matchSize,
        players: ctx.matchSize,
      });

      ctx.io.to(userRoom(uid)).emit("match:loading", {
        matchId,
        stage: "SERVER_CREATING",
      });
    }

    // Spawn DS container (or take warm pool)
    await this.startDedicatedServerForMatch(match, ctx);

    // Server READY timeout
    match.state = "SERVER_CREATING";
    match.serverReadyTimer = setTimeout(() => {
      this.failMatch(matchId, ctx.io, "SERVER_READY_TIMEOUT");
    }, ctx.serverReadyTimeoutMs);

    this.matches.set(matchId, match);
  }

  private async startDedicatedServerForMatch(match: MatchRecord, ctx: EnqueueCtx) {
    // Option A: nếu bạn có warm DS idle containers, chọn 1 idle cùng region
    const warm = this.pickWarmDs(match.region);
    if (warm) {
      // Mark BUSY
      warm.status = "BUSY";
      warm.lastSeenAt = Date.now();
      this.dsPool.set(warm.dsId, warm);

      match.dsId = warm.dsId;

      // Gửi assign cho DS idle (DS container phải có endpoint internal)
      // Ở đây minh họa: DockerOrchestrator có thể gọi HTTP tới DS nếu bạn expose network nội bộ.
      // Nếu chưa có, bỏ warm pool và dùng spawn container on-demand.
      await DockerOrchestrator.assignToIdleDs({
        dsId: warm.dsId,
        matchId: match.matchId,
        sessionName: match.sessionName,
        maxPlayers: ctx.matchSize,
        bet: match.bet,
        region: match.region,
      });

      return;
    }

    // Option B: spawn container mới on-demand
    await DockerOrchestrator.spawnMatchContainer({
      matchId: match.matchId,
      sessionName: match.sessionName,
      maxPlayers: ctx.matchSize,
      bet: match.bet,
      region: match.region,
    });
  }

  private pickWarmDs(region: string): DsInfo | null {
    const now = Date.now();

    // dọn DS stale (optional)
    for (const [id, ds] of this.dsPool.entries()) {
      if (now - ds.lastSeenAt > 60_000) this.dsPool.delete(id);
    }

    for (const ds of this.dsPool.values()) {
      if (ds.region === region && ds.status === "IDLE") return ds;
    }
    return null;
  }

  private failMatch(matchId: string, io: any, reason: string) {
    const m = this.matches.get(matchId);
    if (!m) return;

    m.state = "FAILED";
    this.matches.set(matchId, m);

    // Free CCU slots (approx)
    this.reservedCCUSlots = Math.max(0, this.reservedCCUSlots - m.players.length);

    // notify players
    for (const uid of m.players) {
      io.to(userRoom(uid)).emit("match:failed", {
        matchId,
        reason,
      });
    }

    // kill container nếu bạn spawn on-demand (optional)
    if (m.dsId) {
      DockerOrchestrator.tryStopContainerById(m.dsId).catch(() => {});
    }
  }
}
