import test from "node:test";
import assert from "node:assert/strict";
import { enforceIntelAdminGuard, enforceWebhookDedupe } from "../src/intel-cache-guards.ts";

class MemoryStorage {
  private readonly store = new Map<string, unknown>();

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}

test("enforceIntelAdminGuard rejects replayed nonces", async () => {
  const storage = new MemoryStorage();
  const base = {
    storage,
    scope: "/api/cache-bust",
    nonce: "nonce-1",
    timestampMs: 1_000,
    clientIp: "127.0.0.1",
    nowMs: 1_000,
    nonceTtlMs: 10_000,
    rateWindowMs: 60_000,
    rateLimitPerWindow: 8,
    maxSkewMs: 5_000,
  } as const;

  assert.deepEqual(await enforceIntelAdminGuard(base), { ok: true });
  assert.deepEqual(await enforceIntelAdminGuard(base), {
    ok: false,
    status: 409,
    reason: "replay_detected",
  });
});

test("enforceIntelAdminGuard rate limits within the same window", async () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 8; index += 1) {
    assert.deepEqual(
      await enforceIntelAdminGuard({
        storage,
        scope: "/api/cache-bust",
        nonce: `nonce-${index}`,
        timestampMs: 2_000,
        clientIp: "127.0.0.1",
        nowMs: 2_000,
        nonceTtlMs: 10_000,
        rateWindowMs: 60_000,
        rateLimitPerWindow: 8,
        maxSkewMs: 5_000,
      }),
      { ok: true },
    );
  }

  assert.deepEqual(
    await enforceIntelAdminGuard({
      storage,
      scope: "/api/cache-bust",
      nonce: "nonce-limited",
      timestampMs: 2_000,
      clientIp: "127.0.0.1",
      nowMs: 2_000,
      nonceTtlMs: 10_000,
      rateWindowMs: 60_000,
      rateLimitPerWindow: 8,
      maxSkewMs: 5_000,
    }),
    {
      ok: false,
      status: 429,
      reason: "rate_limited",
      retryAfterMs: 58_000,
    },
  );
});

test("enforceWebhookDedupe rejects duplicate webhook events inside the ttl", async () => {
  const storage = new MemoryStorage();

  assert.deepEqual(
    await enforceWebhookDedupe({
      storage,
      provider: "stripe",
      eventId: "evt_1",
      nowMs: 1_000,
      eventTtlMs: 10_000,
    }),
    { ok: true, duplicate: false },
  );

  assert.deepEqual(
    await enforceWebhookDedupe({
      storage,
      provider: "stripe",
      eventId: "evt_1",
      nowMs: 2_000,
      eventTtlMs: 10_000,
    }),
    { ok: false, duplicate: true, status: 409 },
  );
});
