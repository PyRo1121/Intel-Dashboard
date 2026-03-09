import test from "node:test";
import assert from "node:assert/strict";
import { createRoot, createSignal } from "solid-js";
import { formatAgeCompactFromMs, formatRelativeTimeAt } from "./utils.ts";
import { buildFreshnessStatusAt, useFeedFreshness } from "./freshness.ts";
import { nextWallClockDelay } from "./live-refresh.ts";

test("formatRelativeTimeAt formats relative windows from injected now", () => {
  const base = Date.UTC(2026, 2, 7, 12, 0, 0);
  assert.equal(formatRelativeTimeAt(new Date(base - 15_000).toISOString(), base), "15s ago");
  assert.equal(formatRelativeTimeAt(new Date(base - (2 * 60_000 + 5_000)).toISOString(), base), "2m 05s ago");
  assert.equal(formatRelativeTimeAt(new Date(base - (3 * 60 * 60_000 + 7 * 60_000)).toISOString(), base), "3h 07m ago");
  assert.equal(formatRelativeTimeAt(new Date(base - (2 * 24 * 60 * 60_000 + 4 * 60 * 60_000)).toISOString(), base), "2d 04h ago");
  assert.equal(formatRelativeTimeAt(new Date(base + 5_000).toISOString(), base), "just now");
});

test("buildFreshnessStatusAt computes state from injected now", () => {
  const now = Date.UTC(2026, 2, 7, 12, 0, 0);
  const thresholds = { liveMaxMinutes: 20, delayedMaxMinutes: 90 } as const;

  assert.deepEqual(
    buildFreshnessStatusAt(now, now - 5 * 60_000, thresholds),
    { state: "live", minutes: 5, ageMs: 5 * 60_000, label: "Live" },
  );

  assert.deepEqual(
    buildFreshnessStatusAt(now, now - 45 * 60_000, thresholds),
    { state: "delayed", minutes: 45, ageMs: 45 * 60_000, label: "Delayed" },
  );

  assert.deepEqual(
    buildFreshnessStatusAt(now, now - 120 * 60_000, thresholds),
    { state: "stale", minutes: 120, ageMs: 120 * 60_000, label: "Stale" },
  );

  assert.deepEqual(
    buildFreshnessStatusAt(now, 0, thresholds, { noData: "Missing" }),
    { state: "stale", minutes: null, ageMs: null, label: "Missing" },
  );
});

test("formatAgeCompactFromMs formats second and minute precision labels", () => {
  assert.equal(formatAgeCompactFromMs(null), "n/a");
  assert.equal(formatAgeCompactFromMs(12_000), "12s");
  assert.equal(formatAgeCompactFromMs(125_000), "2m 05s");
  assert.equal(formatAgeCompactFromMs(3 * 60 * 60_000 + 7 * 60_000), "3h 07m");
  assert.equal(formatAgeCompactFromMs(2 * 24 * 60 * 60_000 + 4 * 60 * 60_000), "2d 04h");
});

test("useFeedFreshness derives feed status and age labels from reactive timestamps", () => {
  createRoot((dispose) => {
    const base = Date.UTC(2026, 2, 7, 12, 0, 0);
    const [nowMs] = createSignal(base);
    const [latestTimestampMs] = createSignal(base - 5 * 60_000);
    const freshness = useFeedFreshness({
      nowMs,
      latestTimestampMs,
      thresholds: { liveMaxMinutes: 20, delayedMaxMinutes: 90 },
      subject: "Feed",
      labels: { noData: "Unknown" },
    });

    assert.equal(freshness.feedFreshness().state, "live");
    assert.equal(freshness.latestFeedAgeLabel(), "5m 00s");

    dispose();
  });
});

test("useFeedFreshness handles no-data timestamps", () => {
  createRoot((dispose) => {
    const base = Date.UTC(2026, 2, 7, 12, 0, 0);
    const [nowMs] = createSignal(base);
    const [latestTimestampMs] = createSignal(0);
    const freshness = useFeedFreshness({
      nowMs,
      latestTimestampMs,
      thresholds: { liveMaxMinutes: 20, delayedMaxMinutes: 90 },
      subject: "Feed",
      labels: { noData: "Unknown" },
    });

    assert.equal(freshness.feedFreshness().label, "Unknown");
    assert.equal(freshness.latestFeedAgeMs(), null);

    dispose();
  });
});

test("nextWallClockDelay aligns ticks to the next interval boundary", () => {
  assert.equal(nextWallClockDelay(1000, 1_000), 1000);
  assert.equal(nextWallClockDelay(1000, 1_234), 766);
  assert.equal(nextWallClockDelay(10_000, 27_654), 2_346);
  assert.equal(nextWallClockDelay(100, 1_234), 16);
});
