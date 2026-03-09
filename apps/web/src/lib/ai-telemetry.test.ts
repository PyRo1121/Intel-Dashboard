import test from "node:test";
import assert from "node:assert/strict";
import {
  computeAiCacheHitRatePercent,
  getAiTelemetryAvgDurationMs,
  getAiTelemetryCalls,
  getAiTelemetryCompletionTokens,
  getAiTelemetryHotspotRows,
  getAiTelemetryLabel,
  getAiTelemetryMaxValue,
  getAiTelemetryOutputInputPercent,
  getAiTelemetryP95DurationMs,
  getAiTelemetryPromptTokens,
  getAiTelemetrySummaryRows,
  getAiTelemetryTopEntryBy,
  readAiTelemetryItems,
} from "./ai-telemetry.ts";

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

test("getAiTelemetryLabel formats lane/model labels with shared event-label rules", () => {
  assert.equal(getAiTelemetryLabel("briefing.generate"), "briefing generate");
  assert.equal(getAiTelemetryLabel(undefined), "—");
});

test("AI telemetry summary selectors expose raw values and derived output/input percent", () => {
  const summary = {
    calls: 10,
    promptTokens: 100,
    completionTokens: 40,
    outputInputRatio: 0.4,
    avgDurationMs: 250,
    p95DurationMs: 900,
  };

  assert.equal(getAiTelemetryCalls(summary), 10);
  assert.equal(getAiTelemetryPromptTokens(summary), 100);
  assert.equal(getAiTelemetryCompletionTokens(summary), 40);
  assert.equal(getAiTelemetryOutputInputPercent(summary), 40);
  assert.equal(getAiTelemetryAvgDurationMs(summary), 250);
  assert.equal(getAiTelemetryP95DurationMs(summary), 900);
});

test("AI telemetry summary rows expose stable labels, values, and tones", () => {
  assert.deepEqual(
    getAiTelemetrySummaryRows(
      {
        calls: 10,
        promptTokens: 100,
        completionTokens: 40,
        outputInputRatio: 0.4,
        avgDurationMs: 250,
        p95DurationMs: 900,
      },
      75,
    ),
    [
      { label: "Calls", value: "10" },
      { label: "Prompt Tokens", value: "100" },
      { label: "Completion Tokens", value: "40" },
      { label: "Output/Input", value: "40.0%", valueTone: "text-cyan-300" },
      { label: "Avg Latency", value: "250ms" },
      { label: "P95 Latency", value: "900ms" },
      { label: "Cache Hit Rate", value: "75.0%", valueTone: "text-emerald-300" },
    ],
  );
});

test("AI telemetry hotspot rows expose stable titles and formatted details", () => {
  assert.deepEqual(
    getAiTelemetryHotspotRows({
      worstFailureLane: { label: "briefing.generate", failures: 2, calls: 10 },
      slowestLane: { label: "translate", p95DurationMs: 900 },
      hungriestLane: { label: "dedupe", outputInputRatio: 0.4 },
    }),
    [
      {
        label: "Failure Hotspot",
        title: "briefing generate",
        detail: "2 failures across 10 calls",
      },
      {
        label: "Slowest Lane (P95)",
        title: "translate",
        detail: "900ms p95 latency",
      },
      {
        label: "Most Output-Heavy Lane",
        title: "dedupe",
        detail: "40.0% output/input ratio",
      },
    ],
  );
});
