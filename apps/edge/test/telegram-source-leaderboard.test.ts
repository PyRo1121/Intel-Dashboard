import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTelegramSourceLeaderboardRows,
  queryTelegramSourceLeaderboard,
  resolveTelegramLeaderboardWindowStart,
} from "../src/telegram-source-leaderboard.ts";

test("resolveTelegramLeaderboardWindowStart returns expected cutoff", () => {
  const nowMs = Date.UTC(2026, 2, 9, 12, 0, 0);
  assert.equal(resolveTelegramLeaderboardWindowStart(nowMs, "24h"), "2026-03-08T12:00:00.000Z");
});

test("normalizeTelegramSourceLeaderboardRows ranks and clamps rows", () => {
  const rows = normalizeTelegramSourceLeaderboardRows([
    {
      channel: "alpha",
      label: "Alpha",
      lead_count: 4,
      avg_signal_score: 88,
      high_signal_lead_count: 3,
      corroborated_lead_count: 2,
      source_history_score: 91,
      trust_tier: "core",
      latency_tier: "instant",
    },
    {
      channel: "beta",
      label: "Beta",
      lead_count: 1,
      avg_signal_score: 70,
      high_signal_lead_count: 1,
      corroborated_lead_count: 1,
      source_history_score: 60,
      trust_tier: "watch",
      latency_tier: "monitor",
    },
  ]);

  assert.equal(rows[0]?.channel, "alpha");
  assert.ok((rows[0]?.leaderboardScore ?? 0) > (rows[1]?.leaderboardScore ?? 0));
});

test("queryTelegramSourceLeaderboard queries D1 and normalizes the leaderboard", async () => {
  let boundCutoff = "";
  const db = {
    prepare(_sql: string) {
      return {
        bind(value: string) {
          boundCutoff = value;
          return {
            all: async () => ({
              results: [
                {
                  channel: "alpha",
                  label: "Alpha",
                  lead_count: 3,
                  avg_signal_score: 82,
                  high_signal_lead_count: 2,
                  corroborated_lead_count: 2,
                  source_history_score: 85,
                  trust_tier: "verified",
                  latency_tier: "fast",
                },
              ],
            }),
          };
        },
      };
    },
  } as unknown as D1Database;

  const result = await queryTelegramSourceLeaderboard({
    db,
    windowRaw: "7d",
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  assert.equal(result.window, "7d");
  assert.equal(boundCutoff, "2026-03-02T12:00:00.000Z");
  assert.equal(result.entries[0]?.channel, "alpha");
});
