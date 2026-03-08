import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTurnstileGateToken, verifyTurnstileGateToken } from "../src/turnstile.ts";

describe("turnstile gate token", () => {
  it("creates and verifies a valid token for matching mode", async () => {
    const nowMs = 1_762_684_000_000;
    const token = await createTurnstileGateToken({
      secret: "test-secret",
      mode: "login",
      nowMs,
      ttlMs: 60_000,
    });

    const verified = await verifyTurnstileGateToken({
      secret: "test-secret",
      token,
      expectedMode: "login",
      nowMs: nowMs + 10_000,
    });
    assert.equal(verified, true);
  });

  it("rejects mode mismatch", async () => {
    const nowMs = 1_762_684_000_000;
    const token = await createTurnstileGateToken({
      secret: "test-secret",
      mode: "signup",
      nowMs,
      ttlMs: 60_000,
    });

    const verified = await verifyTurnstileGateToken({
      secret: "test-secret",
      token,
      expectedMode: "login",
      nowMs: nowMs + 10_000,
    });
    assert.equal(verified, false);
  });

  it("rejects tampered tokens", async () => {
    const token = await createTurnstileGateToken({
      secret: "test-secret",
      mode: "login",
    });
    const tampered = `${token.slice(0, -1)}x`;
    const verified = await verifyTurnstileGateToken({
      secret: "test-secret",
      token: tampered,
      expectedMode: "login",
    });
    assert.equal(verified, false);
  });

  it("rejects expired tokens", async () => {
    const nowMs = 1_762_684_000_000;
    const token = await createTurnstileGateToken({
      secret: "test-secret",
      mode: "login",
      nowMs,
      ttlMs: 30_000,
    });

    const verified = await verifyTurnstileGateToken({
      secret: "test-secret",
      token,
      expectedMode: "login",
      nowMs: nowMs + 31_000,
    });
    assert.equal(verified, false);
  });
});

