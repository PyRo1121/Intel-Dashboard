export type DurableObjectGuardStorage = {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean | void>;
};

type NumberRecord = Record<string, number>;
type WebhookBucketState = {
  bucketStart: number;
  events: NumberRecord;
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

  const nonceKey = `admin:nonce-log:${args.scope}`;
  const nonceLogRaw = await args.storage.get<unknown>(nonceKey);
  const nonceLog = normalizeNumberRecord(nonceLogRaw);
  const nextNonceLog: NumberRecord = Object.create(null);
  for (const [nonce, seenAt] of Object.entries(nonceLog)) {
    if (now - seenAt <= args.nonceTtlMs) {
      nextNonceLog[nonce] = seenAt;
    }
  }
  if (Object.prototype.hasOwnProperty.call(nextNonceLog, args.nonce)) {
    return { ok: false, status: 409, reason: "replay_detected" };
  }

  const window = Math.floor(now / args.rateWindowMs);
  const rateKey = `admin:rl:${args.scope}:${args.clientIp}`;
  const rateLogRaw = await args.storage.get<unknown>(rateKey);
  const rateLog = normalizeNumberRecord(rateLogRaw);
  const nextRateLog: NumberRecord = Object.create(null);
  const currentWindowKey = String(window);
  const hits = rateLog[currentWindowKey] ?? 0;
  if (hits >= args.rateLimitPerWindow) {
    return {
      ok: false,
      status: 429,
      reason: "rate_limited",
      retryAfterMs: args.rateWindowMs - (now % args.rateWindowMs),
    };
  }

  nextRateLog[currentWindowKey] = hits + 1;
  nextNonceLog[args.nonce] = now;
  await args.storage.put(rateKey, nextRateLog);
  await args.storage.put(nonceKey, nextNonceLog);
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
  const bucketMs = resolveWebhookBucketDurationMs(args.eventTtlMs);
  const bucketCount = Math.max(1, Math.ceil(args.eventTtlMs / bucketMs));
  const currentBucketStart = Math.floor(now / bucketMs) * bucketMs;
  const currentBucketSlot = Math.floor(currentBucketStart / bucketMs) % bucketCount;
  const activeStates = new Map<number, WebhookBucketState>();

  for (let slot = 0; slot < bucketCount; slot += 1) {
    const key = getWebhookBucketKey(provider, slot);
    const state = normalizeWebhookBucketState(await args.storage.get<unknown>(key));
    if (!state) {
      await args.storage.delete(key);
      continue;
    }
    if (now - state.bucketStart > args.eventTtlMs || state.bucketStart > now) {
      await args.storage.delete(key);
      continue;
    }

    const events: NumberRecord = Object.create(null);
    for (const [storedEventId, seenAt] of Object.entries(state.events)) {
      if (now - seenAt <= args.eventTtlMs) {
        events[storedEventId] = seenAt;
      }
    }
    if (Object.prototype.hasOwnProperty.call(events, eventId)) {
      return { ok: false, duplicate: true, status: 409 };
    }

    if (Object.keys(events).length === 0 && state.bucketStart !== currentBucketStart) {
      await args.storage.delete(key);
      continue;
    }
    activeStates.set(slot, { bucketStart: state.bucketStart, events });
  }

  const currentState = activeStates.get(currentBucketSlot);
  const nextCurrentState: WebhookBucketState = currentState?.bucketStart === currentBucketStart
    ? currentState
    : { bucketStart: currentBucketStart, events: Object.create(null) };
  nextCurrentState.events[eventId] = now;
  activeStates.set(currentBucketSlot, nextCurrentState);

  for (const [slot, state] of activeStates) {
    await args.storage.put(getWebhookBucketKey(provider, slot), state);
  }
  return { ok: true, duplicate: false };
}

function normalizeNumberRecord(value: unknown): NumberRecord {
  const record: NumberRecord = Object.create(null);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return record;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      record[key] = entry;
    }
  }
  return record;
}

function resolveWebhookBucketDurationMs(eventTtlMs: number): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const normalizedTtlMs = Number.isFinite(eventTtlMs) && eventTtlMs > 0 ? eventTtlMs : dayMs;
  return Math.min(dayMs, normalizedTtlMs);
}

function getWebhookBucketKey(provider: string, slot: number): string {
  return `webhook:${provider}:bucket:${slot}`;
}

function normalizeWebhookBucketState(value: unknown): WebhookBucketState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const bucketStartRaw = (value as { bucketStart?: unknown }).bucketStart;
  const eventsRaw = (value as { events?: unknown }).events;
  if (typeof bucketStartRaw !== "number" || !Number.isFinite(bucketStartRaw)) {
    return null;
  }
  return {
    bucketStart: bucketStartRaw,
    events: normalizeNumberRecord(eventsRaw),
  };
}
