import assert from "node:assert/strict";
import test from "node:test";
import {
  queryTelegramSourceHistory,
  resolveTelegramSourceHistoryWindowStart,
} from "../src/telegram-source-history.ts";

test("resolveTelegramSourceHistoryWindowStart returns expected cutoff", () => {
  const nowMs = Date.UTC(2026, 2, 9, 12, 0, 0);
  assert.equal(resolveTelegramSourceHistoryWindowStart(nowMs, "24h"), "2026-03-08T12:00:00.000Z");
});

test("queryTelegramSourceHistory returns normalized summary and events", async () => {
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          if (sql.includes("WITH ranked_source_events AS")) {
            return {
              first: async () => ({
                channel: values[0],
                label: "Alpha",
                source_category: "ukraine",
                source_count_seen: 4,
                lead_count: 2,
                duplicate_count: 1,
                avg_signal_score: 82,
                last_seen_at: "2026-03-09T11:00:00.000Z",
              }),
            };
          }
          if (sql.includes("FROM telegram_source_history")) {
            return {
              first: async () => ({
                score: 88,
                total_events: 10,
                lead_reports: 4,
                follow_on_reports: 3,
                corroborated_reports: 5,
                single_source_reports: 2,
                trust_tier: "core",
                latency_tier: "instant",
              }),
            };
          }
          if (sql.includes("ORDER BY e.datetime DESC")) {
            return {
              all: async () => ({
                results: [
                  {
                    event_id: "evt-1",
                    datetime: "2026-03-09T11:30:00.000Z",
                    text_en: "Recent event",
                    text_original: "",
                    signal_score: 90,
                    signal_grade: "A",
                    signal_reasons_json: JSON.stringify(["first", "fresh"]),
                    message_link: "https://t.me/alpha/1",
                  },
                ],
              }),
            };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
      };
    },
  } as unknown as D1Database;

  const result = await queryTelegramSourceHistory({
    db,
    channelRaw: "alpha",
    windowRaw: "7d",
    owner: true,
    nowMs: Date.UTC(2026, 2, 9, 12, 0, 0),
  });

  assert.ok(result);
  assert.equal(result?.window, "7d");
  assert.equal(result?.source.channel, "alpha");
  assert.equal(result?.summary.score, 88);
  assert.equal(result?.summary.leadCount, 2);
  assert.deepEqual(result?.summary.topReasons, ["first", "fresh"]);
  assert.equal(result?.recentEvents[0]?.eventId, "evt-1");
  assert.equal(result?.ownerDiagnostics?.leadWins, 4);
});

test("queryTelegramSourceHistory returns null for missing sources", async () => {
  const db = {
    prepare() {
      return {
        bind() {
          return {
            first: async () => null,
          };
        },
      };
    },
  } as unknown as D1Database;

  const result = await queryTelegramSourceHistory({
    db,
    channelRaw: "missing",
    windowRaw: "24h",
    owner: false,
  });

  assert.equal(result, null);
});
