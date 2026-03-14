import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTelegramSourcePerformanceContribution,
  computeTelegramSourcePerformanceScore,
  createEmptyTelegramSourcePerformanceStats,
  isLeadTelegramSource,
  normalizeTelegramSourcePerformanceRows,
  updateTelegramSourcePerformanceStats,
} from "../src/telegram-source-performance.ts";

test("computeTelegramSourcePerformanceScore rewards faster corroborated sources over follow-on chatter", () => {
  const leader = computeTelegramSourcePerformanceScore({
    baseSubscriberValue: 92,
    trustTier: "verified",
    latencyTier: "instant",
    totalEvents: 10,
    leadReports: 8,
    followOnReports: 1,
    corroboratedReports: 7,
    singleSourceReports: 1,
    lastLeadAtMs: Date.UTC(2026, 2, 9, 11, 30, 0),
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  const follower = computeTelegramSourcePerformanceScore({
    baseSubscriberValue: 92,
    trustTier: "verified",
    latencyTier: "instant",
    totalEvents: 10,
    leadReports: 1,
    followOnReports: 8,
    corroboratedReports: 3,
    singleSourceReports: 1,
    lastLeadAtMs: Date.UTC(2026, 2, 1, 11, 30, 0),
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  assert.ok(leader > follower);
  assert.ok(leader >= 80);
  assert.ok(follower < 80);
});

test("updateTelegramSourcePerformanceStats decays old behavior and applies new lead wins", () => {
  const previous = {
    totalEvents: 20,
    leadReports: 10,
    followOnReports: 10,
    corroboratedReports: 4,
    singleSourceReports: 6,
    score: 60,
    lastLeadAtMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    lastSeenAtMs: Date.UTC(2026, 0, 1, 0, 0, 0),
    updatedAtMs: Date.UTC(2026, 0, 1, 0, 0, 0),
  };

  const next = updateTelegramSourcePerformanceStats({
    previous,
    contribution: {
      totalEvents: 1,
      leadReports: 1,
      followOnReports: 0,
      corroboratedReports: 1,
      singleSourceReports: 0,
      lastLeadAtMs: Date.UTC(2026, 2, 9, 12, 0, 0),
      lastSeenAtMs: Date.UTC(2026, 2, 9, 12, 0, 0),
    },
    baseScore: 90,
    trustTier: "core",
    latencyTier: "instant",
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
    halfLifeDays: 14,
  });

  assert.equal(next.lastLeadAtMs, Date.UTC(2026, 2, 9, 12, 0, 0));
  assert.equal(next.lastSeenAtMs, Date.UTC(2026, 2, 9, 12, 0, 0));
  assert.ok(next.leadReports < 11);
  assert.ok(next.followOnReports < 10);
  assert.ok(next.score > previous.score);
});

test("isLeadTelegramSource treats near-simultaneous reporters as leaders", () => {
  assert.equal(
    isLeadTelegramSource({
      sourceDatetimeMs: Date.UTC(2026, 2, 9, 12, 2, 0),
      earliestDatetimeMs: Date.UTC(2026, 2, 9, 12, 0, 30),
    }),
    true,
  );
  assert.equal(
    isLeadTelegramSource({
      sourceDatetimeMs: Date.UTC(2026, 2, 9, 12, 6, 0),
      earliestDatetimeMs: Date.UTC(2026, 2, 9, 12, 0, 30),
    }),
    false,
  );
  assert.equal(
    isLeadTelegramSource({
      sourceDatetimeMs: Date.UTC(2026, 2, 9, 11, 59, 0),
      earliestDatetimeMs: Date.UTC(2026, 2, 9, 12, 0, 30),
    }),
    false,
  );
});

test("applyTelegramSourcePerformanceContribution preserves a neutral seed state", () => {
  const next = applyTelegramSourcePerformanceContribution({
    current: createEmptyTelegramSourcePerformanceStats(),
    contribution: {
      totalEvents: 1,
      leadReports: 0,
      followOnReports: 1,
      corroboratedReports: 1,
      singleSourceReports: 0,
      lastSeenAtMs: Date.UTC(2026, 2, 9, 12, 0, 0),
    },
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  assert.equal(next.totalEvents, 1);
  assert.equal(next.followOnReports, 1);
  assert.equal(next.corroboratedReports, 1);
  assert.equal(next.lastSeenAtMs, Date.UTC(2026, 2, 9, 12, 0, 0));
});

test("normalizeTelegramSourcePerformanceRows filters malformed entries and normalizes row fields", () => {
  const rows = normalizeTelegramSourcePerformanceRows([
    null,
    {
      channel: "alpha",
      total_events: 10,
      lead_reports: 2,
      follow_on_reports: 4,
      corroborated_reports: 1,
      single_source_reports: 0,
      score: 77,
      last_lead_at: 100,
      last_seen_at: 200,
      updated_at: 300,
    },
    {
      channel: 42,
      total_events: "bad",
      lead_reports: Number.NaN,
      follow_on_reports: 1,
      corroborated_reports: undefined,
      single_source_reports: 2,
      score: Infinity,
      last_lead_at: "bad",
      last_seen_at: 400,
      updated_at: null,
    },
  ]);

  assert.deepEqual(rows, [
    {
      channel: "alpha",
      total_events: 10,
      lead_reports: 2,
      follow_on_reports: 4,
      corroborated_reports: 1,
      single_source_reports: 0,
      score: 77,
      last_lead_at: 100,
      last_seen_at: 200,
      updated_at: 300,
    },
    {
      channel: "",
      total_events: 0,
      lead_reports: 0,
      follow_on_reports: 1,
      corroborated_reports: 0,
      single_source_reports: 2,
      score: 0,
      last_lead_at: null,
      last_seen_at: 400,
      updated_at: null,
    },
  ]);
});


test("computeTelegramSourcePerformanceScore penalizes high-volume low-yield channels", () => {
  const highVolumeLowYield = computeTelegramSourcePerformanceScore({
    baseSubscriberValue: 88,
    trustTier: "verified",
    latencyTier: "instant",
    totalEvents: 60,
    leadReports: 6,
    followOnReports: 48,
    corroboratedReports: 10,
    singleSourceReports: 18,
    lastLeadAtMs: Date.UTC(2026, 2, 9, 11, 30, 0),
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  const lowerVolumeHighYield = computeTelegramSourcePerformanceScore({
    baseSubscriberValue: 80,
    trustTier: "watch",
    latencyTier: "fast",
    totalEvents: 12,
    leadReports: 5,
    followOnReports: 3,
    corroboratedReports: 7,
    singleSourceReports: 1,
    lastLeadAtMs: Date.UTC(2026, 2, 9, 11, 45, 0),
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  assert.ok(lowerVolumeHighYield > highVolumeLowYield);
});
