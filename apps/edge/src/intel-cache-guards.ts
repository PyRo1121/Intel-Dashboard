export type DurableObjectGuardStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean | void>;
};

export type AdminGuardResult =
  | { ok: true }
  | { ok: false; status: number; reason: string; retryAfterMs?: number };

export async function enforceIntelAdminGuard(args: {
  storage: DurableObjectGuardStorage;
  scope: string;
  nonce: string;
  timestampMs: number;
  clientIp: string;
  nowMs?: number;
  nonceTtlMs: number;
  rateWindowMs: number;
  rateLimitPerWindow: number;
  maxSkewMs: number;
}): Promise<AdminGuardResult> {
  const now = args.nowMs ?? Date.now();
  if (Math.abs(now - args.timestampMs) > args.maxSkewMs) {
    return { ok: false, status: 409, reason: "timestamp_out_of_window" };
  }

  const nonceKey = `admin:nonce:${args.scope}:${args.nonce}`;
  const replaySeen = await args.storage.get<number>(nonceKey);
  if (typeof replaySeen === "number") {
    if (now - replaySeen <= args.nonceTtlMs) {
      return { ok: false, status: 409, reason: "replay_detected" };
    }
    await args.storage.delete(nonceKey);
  }

  const window = Math.floor(now / args.rateWindowMs);
  const rateKey = `admin:rl:${args.scope}:${args.clientIp}:${window}`;
  const hits = (await args.storage.get<number>(rateKey)) ?? 0;
  if (hits >= args.rateLimitPerWindow) {
    return {
      ok: false,
      status: 429,
      reason: "rate_limited",
      retryAfterMs: args.rateWindowMs - (now % args.rateWindowMs),
    };
  }

  await args.storage.put(rateKey, hits + 1);
  await args.storage.put(nonceKey, now);
  return { ok: true };
}

export type WebhookDedupeResult =
  | { ok: true; duplicate: false }
  | { ok: false; status: number; reason: string }
  | { ok: false; duplicate: true; status: 409 };

export async function enforceWebhookDedupe(args: {
  storage: DurableObjectGuardStorage;
  provider: string;
  eventId: string;
  nowMs?: number;
  eventTtlMs: number;
}): Promise<WebhookDedupeResult> {
  const provider = args.provider.trim().toLowerCase();
  const eventId = args.eventId.trim();
  if (!provider || !eventId) {
    return { ok: false, status: 400, reason: "invalid_payload" };
  }

  const now = args.nowMs ?? Date.now();
  const key = `webhook:${provider}:${eventId}`;
  const seen = await args.storage.get<number>(key);
  if (typeof seen === "number") {
    if (now - seen <= args.eventTtlMs) {
      return { ok: false, duplicate: true, status: 409 };
    }
    await args.storage.delete(key);
  }

  await args.storage.put(key, now);
  return { ok: true, duplicate: false };
}
