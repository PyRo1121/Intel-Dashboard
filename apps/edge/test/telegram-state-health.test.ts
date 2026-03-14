import assert from "node:assert/strict";
import test from "node:test";
import { isTelegramStateStale, shouldSelfHealTelegramState } from "../src/telegram-state-health.ts";

test("isTelegramStateStale treats missing or invalid timestamps as stale", () => {
  assert.equal(isTelegramStateStale({ timestamp: null, nowMs: 1_000, maxAgeMs: 100 }), true);
  assert.equal(isTelegramStateStale({ timestamp: "not-a-date", nowMs: 1_000, maxAgeMs: 100 }), true);
});

test("isTelegramStateStale respects the max age threshold", () => {
  assert.equal(
    isTelegramStateStale({
      timestamp: "2026-03-11T13:00:00.000Z",
      nowMs: Date.parse("2026-03-11T13:00:05.000Z"),
      maxAgeMs: 10_000,
    }),
    false,
  );
  assert.equal(
    isTelegramStateStale({
      timestamp: "2026-03-11T13:00:00.000Z",
      nowMs: Date.parse("2026-03-11T13:00:15.000Z"),
      maxAgeMs: 10_000,
    }),
    true,
  );
});

test("shouldSelfHealTelegramState only fires for stale idle state with no usable alarm", () => {
  const nowMs = Date.parse("2026-03-11T13:30:00.000Z");
  assert.equal(
    shouldSelfHealTelegramState({
      timestamp: "2026-03-11T13:29:55.000Z",
      nowMs,
      maxAgeMs: 10_000,
      isRunning: false,
      alarmAt: nowMs + 5_000,
    }),
    false,
  );
  assert.equal(
    shouldSelfHealTelegramState({
      timestamp: "2026-03-11T13:00:00.000Z",
      nowMs,
      maxAgeMs: 10_000,
      isRunning: false,
      alarmAt: nowMs - 1,
    }),
    true,
  );
  assert.equal(
    shouldSelfHealTelegramState({
      timestamp: "2026-03-11T13:00:00.000Z",
      nowMs,
      maxAgeMs: 10_000,
      isRunning: true,
      alarmAt: null,
    }),
    false,
  );
});
