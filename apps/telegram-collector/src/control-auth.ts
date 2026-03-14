import { createHmac, timingSafeEqual } from "node:crypto";

export type ControlNonceGuardStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean | void>;
};

export type ControlNonceGuardResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; retryAfterMs?: number };

export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
}

export function hasCollectorControlAccess(request: Request, configuredSecret: string | undefined): boolean {
  const expected = configuredSecret?.trim() || "";
  if (!expected) {
    return false;
  }
  const provided = parseBearerToken(request) || "";
  return provided.length > 0 && provided === expected;
}

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
  const now = params.nowMs ?? Date.now();
  if (Math.abs(now - params.timestampMs) > params.maxSkewMs) {
    return { ok: false, status: 409, reason: "timestamp_out_of_window" };
  }

  const nonceKey = `admin:nonce:${params.scope}:${params.nonce}`;
  const replaySeen = await params.storage.get<number>(nonceKey);
  if (typeof replaySeen === "number") {
    if (now - replaySeen <= params.nonceTtlMs) {
      return { ok: false, status: 409, reason: "replay_detected" };
    }
    await params.storage.delete(nonceKey);
  }

  const window = Math.floor(now / params.rateWindowMs);
  const rateKey = `admin:rl:${params.scope}:${params.clientIp}:${window}`;
  const hits = (await params.storage.get<number>(rateKey)) ?? 0;
  if (hits >= params.rateLimitPerWindow) {
    return {
      ok: false,
      status: 429,
      reason: "rate_limited",
      retryAfterMs: params.rateWindowMs - (now % params.rateWindowMs),
    };
  }

  await params.storage.put(rateKey, hits + 1);
  await params.storage.put(nonceKey, now);
  return { ok: true };
}
