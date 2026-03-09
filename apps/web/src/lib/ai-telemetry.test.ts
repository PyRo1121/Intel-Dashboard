import test from "node:test";
import assert from "node:assert/strict";
import { computeAiCacheHitRatePercent } from "./ai-telemetry.ts";

test("computeAiCacheHitRatePercent handles empty, clamped, and normal cache stats", () => {
  assert.equal(computeAiCacheHitRatePercent(undefined), 0);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: -5, cacheMisses: 10 }), 0);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: 30, cacheMisses: 10 }), 75);
  assert.equal(computeAiCacheHitRatePercent({ cacheHits: 1, cacheMisses: 3 }), 25);
});
