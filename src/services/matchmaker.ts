import crypto from "crypto";
import { DockerOrchestrator } from "./orchestrator";
import { ensureWarmIdleContainers } from "./orchestratorWarmPool";

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
  players: number[];
  createdAt: number;
  state: MatchState;

  // nếu assign từ warm pool: đây là container name idle được assign
  dsContainerName: string | null;

  serverReadyTimer?: NodeJS.Timeout;
  playerJoinTimer?: NodeJS.Timeout;
};

function makeMatchId() {
  return "m_" + crypto.randomBytes(8).toString("hex");
}

function makeSessionName(region: string) {
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

  // queue per bucket
  private queue = new Map<string, number[]>();
  private queuedUsers = new Set<number>();

  private matches = new Map<string, MatchRecord>();

  // tránh double-assign 1 container IDLE
  private lockedIdleContainers = new Set<string>();

  // CCU approximation: reserve slots khi match allocated
  private reservedCCUSlots = 0;

  // track DS register (warm pool DS báo về)
  private dsRegistry = new Map<
    string,
    {
      region: string;
      status: "IDLE" | "BUSY";
      registeredAt: number;
    }
  >();

  async enqueue(p: EnqueueParams, ctx: EnqueueCtx) {
    const { io } = ctx;

    if (this.queuedUsers.has(p.userId)) {
      return { http: { status: "ALREADY_QUEUED", message: "Bạn đang ở trong hàng chờ" } };
    }

    const key = this.bucketKey(p);
    const arr = this.queue.get(key) ?? [];
    arr.push(p.userId);
    this.queue.set(key, arr);
    this.queuedUsers.add(p.userId);

    io.to(userRoom(p.userId)).emit("queue:update", {
      bucket: key,
      current: Math.min(arr.length, ctx.matchSize),
      required: ctx.matchSize,
    });

    await this.tryAllocate(key, p, ctx);

    return { http: { status: "QUEUED", bucket: key, message: "Đã vào hàng chờ" } };
  }

  cancel(userId: number, io: any) {
    if (!this.queuedUsers.has(userId)) return { status: "NOT_IN_QUEUE" };

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

  onServerReady(args: {
    matchId: string;
    sessionName: string;
    region: string;
    io: any;
    signJoinToken: (payload: object) => string;
    playerJoinDeadlineMs: number;
  }) {
    const m = this.matches.get(args.matchId);
    if (!m) return false;

    if (m.state === "FAILED" || m.state === "CANCELLED" || m.state === "FINISHED") return false;

    if (m.serverReadyTimer) clearTimeout(m.serverReadyTimer);

    m.state = "READY";
    m.sessionName = args.sessionName;
    m.region = args.region;

    // phát ticket
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

    // fail-safe join deadline (nếu bạn chưa có ACK join)
    m.playerJoinTimer = setTimeout(() => {
      const mm = this.matches.get(m.matchId);
      if (!mm) return;
      if (mm.state === "READY" || mm.state === "SERVER_CREATING" || mm.state === "MATCH_ALLOCATED") {
        this.failMatch(mm.matchId, args.io, "PLAYER_JOIN_TIMEOUT");
      }
    }, args.playerJoinDeadlineMs);

    this.matches.set(m.matchId, m);
    return true;
  }

  registerDs(args: { dsId: string; region: string; status: "IDLE" | "BUSY" }) {
    this.dsRegistry.set(args.dsId, {
      region: args.region,
      status: args.status,
      registeredAt: Date.now(),
    });

    if (args.status === "IDLE") {
      this.lockedIdleContainers.delete(args.dsId);
    }

    return { status: "REGISTERED", dsId: args.dsId, region: args.region };
  }

  onMatchResult(args: { matchId: string; result: unknown; io: any }) {
    const m = this.matches.get(args.matchId);
    if (!m) return { status: "NOT_FOUND" };

    m.state = "FINISHED";
    this.matches.set(m.matchId, m);

    // free CCU slots
    this.reservedCCUSlots = Math.max(0, this.reservedCCUSlots - m.players.length);

    // unlock warm DS (container sẽ exit, nhưng unlock để tránh leak)
    if (m.dsContainerName) this.lockedIdleContainers.delete(m.dsContainerName);

    for (const uid of m.players) {
      args.io.to(userRoom(uid)).emit("match:finished", { matchId: m.matchId, result: args.result });
    }

    // Bù warm pool ngay sau khi match dùng xong (best-effort)
    ensureWarmIdleContainers({
      region: m.region,
      types: [m.typeMatchGid],
      minIdlePerType: Number(process.env.MIN_IDLE_DS_PER_TYPE) || 1,
    }).catch(() => {});

    return { status: "RESULT_RECEIVED", matchId: m.matchId };
  }

  // ---------------- Internals ----------------

  private bucketKey(p: EnqueueParams) {
    return `${p.region}|type:${p.typeMatchGid}|bet:${p.bet}`;
  }

  private async tryAllocate(bucketKey: string, p: EnqueueParams, ctx: EnqueueCtx) {
    const arr = this.queue.get(bucketKey) ?? [];
    if (arr.length < ctx.matchSize) return;

    // CCU gate: chỉ allocate nếu còn đủ slot (matchSize)
    if (this.reservedCCUSlots + ctx.matchSize > ctx.maxCCU) {
      for (const uid of arr.slice(0, ctx.matchSize)) {
        ctx.io.to(userRoom(uid)).emit("queue:blocked", { reason: "CCU_FULL", maxCCU: ctx.maxCCU });
      }
      return;
    }

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
      dsContainerName: null,
    };
    this.matches.set(matchId, match);

    // reserve CCU slots
    this.reservedCCUSlots += players.length;

    // UI: match found -> loading
    for (const uid of players) {
      ctx.io.to(userRoom(uid)).emit("match:found", { matchId, required: ctx.matchSize, players: ctx.matchSize });
      ctx.io.to(userRoom(uid)).emit("match:loading", { matchId, stage: "SERVER_CREATING" });
    }

    // Start DS (ưu tiên warm pool assign)
    await this.startDedicatedServerForMatch(match, ctx);

    match.state = "SERVER_CREATING";
    match.serverReadyTimer = setTimeout(() => {
      this.failMatch(matchId, ctx.io, "SERVER_READY_TIMEOUT");
    }, ctx.serverReadyTimeoutMs);

    this.matches.set(matchId, match);
  }

  private async startDedicatedServerForMatch(match: MatchRecord, ctx: EnqueueCtx) {
    // 1) Try pick IDLE container from warm pool
    try {
      const idle = await DockerOrchestrator.listManagedContainers({ region: match.region, mode: "IDLE" });
      const candidates = idle.filter(
        (c) => c.labels.typeMatchGid === String(match.typeMatchGid) && !this.lockedIdleContainers.has(c.name),
      );

      if (candidates.length > 0) {
        const picked = candidates[0];
        this.lockedIdleContainers.add(picked.name);
        match.dsContainerName = picked.name;

        // assign to idle DS (this should be fast)
        await DockerOrchestrator.assignToIdleDs({
          dsContainerName: picked.name,
          matchId: match.matchId,
          sessionName: match.sessionName,
          maxPlayers: ctx.matchSize,
          bet: match.bet,
          region: match.region,
          typeMatchGid: match.typeMatchGid,
        });

        // bù warm pool ngay sau khi consume 1 idle (best-effort)
        ensureWarmIdleContainers({
          region: match.region,
          types: [match.typeMatchGid],
          minIdlePerType: Number(process.env.MIN_IDLE_DS_PER_TYPE) || 1,
        }).catch(() => {});

        return;
      }
    } catch {
      // ignore, fallback spawn below
    }

    // 2) Fallback: spawn match container on-demand
    await DockerOrchestrator.spawnMatchContainer({
      region: match.region,
      typeMatchGid: match.typeMatchGid,
      matchId: match.matchId,
      sessionName: match.sessionName,
      maxPlayers: ctx.matchSize,
      bet: match.bet,
    });
  }

  private async failMatch(matchId: string, io: any, reason: string) {
    const m = this.matches.get(matchId);
    if (!m) return;

    m.state = "FAILED";
    this.matches.set(matchId, m);

    // free CCU slots
    this.reservedCCUSlots = Math.max(0, this.reservedCCUSlots - m.players.length);

    // unlock warm ds if assigned
    if (m.dsContainerName) this.lockedIdleContainers.delete(m.dsContainerName);

    for (const uid of m.players) {
      io.to(userRoom(uid)).emit("match:failed", { matchId: m.matchId, reason });
    }

    // best-effort stop: nếu là match container theo on-demand, tên thường ds_match_<matchId>... không cố định.
    // Nếu bạn muốn stop chắc chắn, hãy truyền DS_ID/ContainerName từ DS callback READY/RESULT (optional).
    // Ở giai đoạn này, fail-safe chính là DS tự exit hoặc orchestrator cleanup theo TTL.
    try {
      // Nếu match dùng warm pool (idle container assigned), nên stop nó để tránh stuck
      if (m.dsContainerName) await DockerOrchestrator.tryStopContainerById(m.dsContainerName);
    } catch {
      // ignore
    }
  }
}
