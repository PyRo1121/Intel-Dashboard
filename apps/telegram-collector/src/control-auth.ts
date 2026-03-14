import { createHmac, timingSafeEqual } from "node:crypto";

export type ControlNonceGuardStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean | void>;
};

export type ControlNonceGuardResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; retryAfterMs?: number };

export function verifySignedControlRequest(params: {
  request: Request;
  secret?: string;
  maxSkewMs: number;
  nowMs?: number;
}): boolean {
  const cleanSecret = (params.secret || "").trim();
  if (!cleanSecret) return false;

  const timestamp = params.request.headers.get("X-Admin-Timestamp") || "";
  const nonce = params.request.headers.get("X-Admin-Nonce") || "";
  const signature = params.request.headers.get("X-Admin-Signature") || "";
  if (!timestamp || !nonce || !signature) return false;

  const timestampMs = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;

  const nowMs = params.nowMs ?? Date.now();
  if (Math.abs(nowMs - timestampMs) > params.maxSkewMs) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;

  const payload = [
    params.request.method.toUpperCase(),
    new URL(params.request.url).pathname,
    timestamp,
    nonce,
  ].join("\n");

  const expected = createHmac("sha256", cleanSecret).update(payload).digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export async function enforceControlNonceGuard(params: {
  storage: ControlNonceGuardStorage;
  scope: string;
  nonce: string;
  timestampMs: number;
  clientIp: string;
  maxSkewMs: number;
  nonceTtlMs: number;
  rateWindowMs: number;
  rateLimitPerWindow: number;
  nowMs?: number;
}): Promise<ControlNonceGuardResult> {
  if (params.rateWindowMs <= 0) {
    return { ok: false, status: 500, reason: "invalid_rate_window" };
  }
  const now = params.nowMs ?? Date.now();
  if (Math.abs(now - params.timestampMs) > params.maxSkewMs) {
    return { ok: false, status: 409, reason: "timestamp_out_of_window" };
  }

  const nonceKey = `admin:nonce-log:${params.scope}`;
  const nonceLogRaw = await params.storage.get<Record<string, unknown>>(nonceKey);
  const nonceLog = nonceLogRaw && typeof nonceLogRaw === "object" && !Array.isArray(nonceLogRaw)
    ? nonceLogRaw
    : Object.create(null);
  const nextNonceLog: Record<string, number> = Object.create(null);
  for (const [nonce, seenAt] of Object.entries(nonceLog)) {
    if (typeof seenAt !== "number" || !Number.isFinite(seenAt)) continue;
    if (now - seenAt <= params.nonceTtlMs) {
      nextNonceLog[nonce] = seenAt;
    }
  }
  if (Object.prototype.hasOwnProperty.call(nextNonceLog, params.nonce)) {
    return { ok: false, status: 409, reason: "replay_detected" };
  }

  const window = Math.floor(now / params.rateWindowMs);
  const rateKey = `admin:rl:${params.scope}:${params.clientIp}`;
  const rateLogRaw = await params.storage.get<Record<string, unknown>>(rateKey);
  const rateLog = rateLogRaw && typeof rateLogRaw === "object" && !Array.isArray(rateLogRaw)
    ? rateLogRaw
    : Object.create(null);
  const nextRateLog: Record<string, number> = Object.create(null);
  for (const [windowKey, hitsValue] of Object.entries(rateLog)) {
    if (windowKey !== String(window)) continue;
    if (typeof hitsValue !== "number" || !Number.isFinite(hitsValue)) continue;
    nextRateLog[windowKey] = hitsValue;
  }
  const hits = nextRateLog[String(window)] ?? 0;
  if (hits >= params.rateLimitPerWindow) {
    return {
      ok: false,
      status: 429,
      reason: "rate_limited",
      retryAfterMs: params.rateWindowMs - (now % params.rateWindowMs),
    };
  }

  nextRateLog[String(window)] = hits + 1;
  nextNonceLog[params.nonce] = now;
  await params.storage.put(nonceKey, nextNonceLog);
  await params.storage.put(rateKey, nextRateLog);
  return { ok: true };
}
