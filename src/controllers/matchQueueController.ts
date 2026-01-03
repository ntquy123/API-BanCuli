import { RequestHandler } from "express";
import crypto from "crypto";
import { Matchmaker } from "/services/matchmaker";

type QueueJoinBody = {
  userId?: number;
  bet?: number;         // ví dụ: 100
  region?: string;      // ví dụ: "asia"
  typeMatchGid?: number; // bucket theo mode
};

type QueueCancelBody = {
  userId?: number;
};

type MatchReadyBody = {
  matchId?: string;
  sessionName?: string;
  region?: string;
  dsId?: string; // optional: id của container DS
};

type MatchResultBody = {
  matchId?: string;
  result?: unknown;
};

type DsRegisterBody = {
  dsId?: string;       // container id / instance id
  region?: string;     // region nó phục vụ
  status?: "IDLE" | "BUSY";
};

function getIO(req: any) {
  // server.ts nên set: app.set("io", io);
  const io = req.app.get("io");
  if (!io) throw new Error("Socket.IO instance not found. Ensure app.set('io', io)");
  return io;
}

// ==== CONFIG ====
const MATCH_SIZE = 3;
const MAX_CCU = 20; // gói free Photon
const SERVER_READY_TIMEOUT_MS = 15_000; // bạn đo 4s, set 15s an toàn
const PLAYER_JOIN_DEADLINE_MS = 12_000;

const JOIN_TOKEN_SECRET = process.env.JOIN_TOKEN_SECRET || "dev_secret_change_me";

// Tạo token đơn giản (HMAC) để “ai không có ticket” không join được.
// (Nếu bạn đã dùng jose/JWT thì có thể thay bằng JWT).
function signJoinToken(payload: object) {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", JOIN_TOKEN_SECRET).update(json).digest("hex");
  return Buffer.from(json).toString("base64url") + "." + sig;
}

export const joinQueue: RequestHandler = async (req, res) => {
  const { userId, bet, region, typeMatchGid } = req.body as QueueJoinBody;

  if (!userId) {
    res.status(400).json({ error: "userId là bắt buộc" });
    return;
  }

  const io = getIO(req);

  const result = await Matchmaker.instance.enqueue({
    userId,
    bet: bet ?? 0,
    region: region ?? "asia",
    typeMatchGid: typeMatchGid ?? 0,
  }, {
    matchSize: MATCH_SIZE,
    maxCCU: MAX_CCU,
    serverReadyTimeoutMs: SERVER_READY_TIMEOUT_MS,
    playerJoinDeadlineMs: PLAYER_JOIN_DEADLINE_MS,
    io,
    signJoinToken,
  });

  // enqueue luôn trả về trạng thái hiện tại của user
  res.status(202).json(result.http);
};

export const cancelQueue: RequestHandler = async (req, res) => {
  const { userId } = req.body as QueueCancelBody;
  if (!userId) {
    res.status(400).json({ error: "userId là bắt buộc" });
    return;
  }

  const io = getIO(req);
  const out = Matchmaker.instance.cancel(userId, io);
  res.json(out);
};

// Dedicated Server callback: báo session đã sẵn sàng
export const matchReady: RequestHandler = async (req, res) => {
  const { matchId, sessionName, region, dsId } = req.body as MatchReadyBody;

  if (!matchId || !sessionName || !region) {
    res.status(400).json({ error: "matchId, sessionName, region là bắt buộc" });
    return;
  }

  const io = getIO(req);

  const ok = Matchmaker.instance.onServerReady({
    matchId,
    sessionName,
    region,
    dsId: dsId ?? null,
    io,
    signJoinToken,
    playerJoinDeadlineMs: PLAYER_JOIN_DEADLINE_MS,
  });

  res.json({ status: ok ? "OK" : "IGNORED", matchId });
};

// Dedicated Server callback: báo kết quả trận (backend settle)
export const matchResult: RequestHandler = async (req, res) => {
  const { matchId, result } = req.body as MatchResultBody;

  if (!matchId) {
    res.status(400).json({ error: "matchId là bắt buộc" });
    return;
  }

  const io = getIO(req);

  const out = Matchmaker.instance.onMatchResult({
    matchId,
    result: result ?? null,
    io,
  });

  res.json(out);
};

// DS idle register (warm pool). DS container “idle” boot xong thì gọi endpoint này.
export const dsRegister: RequestHandler = async (req, res) => {
  const { dsId, region, status } = req.body as DsRegisterBody;
  if (!dsId || !region) {
    res.status(400).json({ error: "dsId, region là bắt buộc" });
    return;
  }

  Matchmaker.instance.registerDs({
    dsId,
    region,
    status: status ?? "IDLE",
  });

  res.json({ status: "REGISTERED", dsId, region });
};
