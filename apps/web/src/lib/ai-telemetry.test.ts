import test from "node:test";
import assert from "node:assert/strict";
import { computeAiCacheHitRatePercent, getAiTelemetryMaxValue, getAiTelemetryTopEntryBy, readAiTelemetryItems } from "./ai-telemetry.ts";

test("computeAiCacheHitRatePercent handles empty, clamped, and normal cache stats", () => {
  assert.equal(computeAiCacheHitRatePercent(undefined), 0);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: -5, cacheMisses: 10 }), 0);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: 30, cacheMisses: 10 }), 75);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: 1, cacheMisses: 3 }), 25);
});

test("getAiTelemetryMaxValue respects minimums and ignores invalid values", () => {
  assert.equal(getAiTelemetryMaxValue(undefined, (entry: { value?: number }) => entry.value, 1), 1);
  assert.equal(
    getAiTelemetryMaxValue(
      [{ value: 12 }, { value: Number.NaN }, { value: 7 }],
      (entry) => entry.value,
      1,
    ),
    12,
  );
});

test("getAiTelemetryTopEntryBy selects the highest-scoring entry with null-safe fallback", () => {
  assert.deepEqual(
    getAiTelemetryTopEntryBy(
      [
        { label: "slow", score: 120 },
        { label: "fast", score: 40 },
      ],
      (entry) => entry.score,
    ),
    { label: "slow", score: 120 },
  );
  assert.equal(getAiTelemetryTopEntryBy(undefined, (entry: { score?: number }) => entry.score), null);
});

test("readAiTelemetryItems returns a stable array fallback", () => {
  assert.deepEqual(readAiTelemetryItems([{ value: 1 }]), [{ value: 1 }]);
  assert.deepEqual(readAiTelemetryItems(undefined), []);
});
