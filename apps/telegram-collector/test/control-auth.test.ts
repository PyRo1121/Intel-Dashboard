import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { enforceControlNonceGuard, verifySignedControlRequest } from "../src/control-auth.ts";

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

function buildSignedRequest(secret: string, nowMs: number, nonce = "nonce-1") {
  const timestamp = String(nowMs);
  const path = "/control/state-update";
  const payload = ["POST", path, timestamp, nonce].join("\n");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return new Request(`https://collector.example${path}`, {
    method: "POST",
    headers: {
      "X-Admin-Timestamp": timestamp,
      "X-Admin-Nonce": nonce,
      "X-Admin-Signature": signature,
    },
  });
}

test("verifySignedControlRequest accepts valid signed requests and rejects tampering", () => {
  const nowMs = Date.now();
  const secret = "shared-secret";
  const request = buildSignedRequest(secret, nowMs, "nonce-accept");
  assert.equal(
    verifySignedControlRequest({
      request,
      secret,
      maxSkewMs: 5 * 60 * 1000,
      nowMs,
    }),
    true,
  );

  const tampered = new Request(request.url, {
    method: request.method,
    headers: {
      ...Object.fromEntries(request.headers.entries()),
      "X-Admin-Signature": "0".repeat(64),
    },
  });
  assert.equal(
    verifySignedControlRequest({
      request: tampered,
      secret,
      maxSkewMs: 5 * 60 * 1000,
      nowMs,
    }),
    false,
  );
});

test("enforceControlNonceGuard rejects replayed nonces", async () => {
  const storage = new MemoryStorage();
  const base = {
    storage,
    scope: "/control/state-update",
    nonce: "nonce-replay",
    timestampMs: 1_000,
    clientIp: "127.0.0.1",
    maxSkewMs: 5_000,
    nonceTtlMs: 10_000,
    rateWindowMs: 60_000,
    rateLimitPerWindow: 8,
    nowMs: 1_000,
  } as const;

  assert.deepEqual(await enforceControlNonceGuard(base), { ok: true });
  assert.deepEqual(await enforceControlNonceGuard(base), {
    ok: false,
    status: 409,
    reason: "replay_detected",
  });
});

test("enforceControlNonceGuard rate limits repeated requests within the same window", async () => {
  const storage = new MemoryStorage();
  for (let index = 0; index < 8; index += 1) {
    const result = await enforceControlNonceGuard({
      storage,
      scope: "/control/state-update",
      nonce: `nonce-${index}`,
      timestampMs: 2_000,
      clientIp: "127.0.0.1",
      maxSkewMs: 5_000,
      nonceTtlMs: 10_000,
      rateWindowMs: 60_000,
      rateLimitPerWindow: 8,
      nowMs: 2_000,
    });
    assert.deepEqual(result, { ok: true });
  }

  const limited = await enforceControlNonceGuard({
    storage,
    scope: "/control/state-update",
    nonce: "nonce-limited",
    timestampMs: 2_000,
    clientIp: "127.0.0.1",
    maxSkewMs: 5_000,
    nonceTtlMs: 10_000,
    rateWindowMs: 60_000,
    rateLimitPerWindow: 8,
    nowMs: 2_000,
  });
  assert.deepEqual(limited, {
    ok: false,
    status: 429,
    reason: "rate_limited",
    retryAfterMs: 58_000,
  });
});
