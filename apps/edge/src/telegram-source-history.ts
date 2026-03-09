import type {
  TelegramSourceHistoryEvent,
  TelegramSourceHistoryOwnerDiagnostics,
  TelegramSourceHistoryResponse,
  TelegramSourceHistorySource,
  TelegramSourceHistorySummary,
  TelegramSourceHistoryWindow,
} from "@intel-dashboard/shared/telegram-source-history.ts";

const WINDOW_TO_MS: Record<TelegramSourceHistoryWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeWindow(value: string | null | undefined): TelegramSourceHistoryWindow {
  if (value === "7d" || value === "30d") return value;
  return "24h";
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 100) : 0;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTier<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function resolveTelegramSourceHistoryWindowStart(nowMs: number, window: TelegramSourceHistoryWindow): string {
  return new Date(Math.max(0, nowMs - WINDOW_TO_MS[window])).toISOString();
}

function summarizeTopReasons(rows: Array<Record<string, unknown>>): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const raw = normalizeString(row.signal_reasons_json);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const value of parsed) {
        if (typeof value !== "string") continue;
        const normalized = value.trim();
        if (!normalized) continue;
        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }
    } catch {
      // ignore malformed reason payloads
    }
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 4)
    .map(([reason]) => reason);
}

function buildVerdict(summary: {
  score: number;
  leadCount: number;
  duplicateRate: number;
}): TelegramSourceHistorySummary["verdict"] {
  if (summary.score >= 80 && summary.leadCount >= 2 && summary.duplicateRate <= 0.45) {
    return "High-value first reporter";
  }
  if (summary.score >= 60 && summary.duplicateRate <= 0.7) {
    return "Reliable corroborator";
  }
  return "Watch source";
}

export async function queryTelegramSourceHistory(args: {
  db: D1Database;
  channelRaw: string;
  windowRaw: string | null | undefined;
  owner: boolean;
  nowMs?: number;
}): Promise<TelegramSourceHistoryResponse | null> {
  const channel = normalizeString(args.channelRaw).toLowerCase();
  if (!channel) return null;

  const window = normalizeWindow(args.windowRaw);
  const nowMs = Number.isFinite(args.nowMs) ? Math.max(0, Math.floor(args.nowMs as number)) : Date.now();
  const cutoffIso = resolveTelegramSourceHistoryWindowStart(nowMs, window);

  const summaryRow = await args.db.prepare(
    `WITH ranked_source_events AS (
      SELECT
        s.event_id,
        s.channel,
        s.label,
        s.category AS source_category,
        s.message_link,
        s.datetime AS source_datetime,
        e.datetime,
        e.text_en,
        e.text_original,
        e.signal_score,
        e.signal_grade,
        e.signal_reasons_json,
        e.source_count,
        ROW_NUMBER() OVER (
          PARTITION BY s.event_id
          ORDER BY
            CASE WHEN s.datetime IS NULL OR s.datetime = '' THEN 1 ELSE 0 END,
            s.datetime ASC,
            s.channel ASC,
            s.signature ASC
        ) AS rank_in_event
      FROM telegram_canonical_event_sources s
      JOIN telegram_canonical_events e ON e.event_id = s.event_id
      WHERE s.channel = ? AND e.datetime >= ?
    )
    SELECT
      channel,
      MAX(label) AS label,
      MAX(source_category) AS source_category,
      COUNT(*) AS source_count_seen,
      SUM(CASE WHEN rank_in_event = 1 THEN 1 ELSE 0 END) AS lead_count,
      SUM(CASE WHEN rank_in_event > 1 THEN 1 ELSE 0 END) AS duplicate_count,
      AVG(COALESCE(signal_score, 0)) AS avg_signal_score,
      MAX(datetime) AS last_seen_at
    FROM ranked_source_events`,
  ).bind(channel, cutoffIso).first<Record<string, unknown>>();

  if (!summaryRow || normalizeString(summaryRow.channel) !== channel) {
    return null;
  }

  const historyRow = await args.db.prepare(
    `SELECT
      score,
      total_events,
      lead_reports,
      follow_on_reports,
      corroborated_reports,
      single_source_reports,
      trust_tier,
      latency_tier
    FROM telegram_source_history
    WHERE channel = ?`,
  ).bind(channel).first<Record<string, unknown>>();

  const recentEventsResult = await args.db.prepare(
    `SELECT
      s.event_id,
      e.datetime,
      e.text_en,
      e.text_original,
      e.signal_score,
      e.signal_grade,
      e.signal_reasons_json,
      s.message_link
    FROM telegram_canonical_event_sources s
    JOIN telegram_canonical_events e ON e.event_id = s.event_id
    WHERE s.channel = ? AND e.datetime >= ?
    ORDER BY e.datetime DESC
    LIMIT 20`,
  ).bind(channel, cutoffIso).all<Record<string, unknown>>();

  const recentRows = Array.isArray(recentEventsResult.results) ? recentEventsResult.results : [];
  const source: TelegramSourceHistorySource = {
    channel,
    label: normalizeString(summaryRow.label) || channel,
    category: normalizeString(summaryRow.source_category) || "uncategorized",
    trustTier: normalizeTier(historyRow?.trust_tier, ["core", "verified", "watch"] as const, "watch"),
    latencyTier: normalizeTier(historyRow?.latency_tier, ["instant", "fast", "monitor"] as const, "monitor"),
  };

  const summaryCore = {
    score: normalizeScore(historyRow?.score),
    leadCount: normalizeCount(summaryRow.lead_count),
    duplicateCount: normalizeCount(summaryRow.duplicate_count),
    recentFirstReports: normalizeCount(summaryRow.lead_count),
    averageSignalScore: normalizeScore(summaryRow.avg_signal_score),
    duplicateRate: 0,
  };
  const totalSeen = normalizeCount(summaryRow.source_count_seen);
  const duplicateRate = totalSeen > 0 ? clamp(summaryCore.duplicateCount / totalSeen, 0, 1) : 0;
  const summary: TelegramSourceHistorySummary = {
    ...summaryCore,
    duplicateRate,
    topReasons: summarizeTopReasons(recentRows),
    lastSeenAt: normalizeString(summaryRow.last_seen_at),
    verdict: buildVerdict({
      score: summaryCore.score,
      leadCount: summaryCore.leadCount,
      duplicateRate,
    }),
  };

  const recentEvents: TelegramSourceHistoryEvent[] = recentRows
    .map((row) => ({
      eventId: normalizeString(row.event_id),
      datetime: normalizeString(row.datetime),
      title: [normalizeString(row.text_en), normalizeString(row.text_original)].find(Boolean) ?? "",
      signalScore: normalizeScore(row.signal_score),
      signalGrade: normalizeString(row.signal_grade) || undefined,
      rankReasons: (() => {
        try {
          const parsed = JSON.parse(normalizeString(row.signal_reasons_json) || "[]");
          return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
        } catch {
          return [];
        }
      })(),
      link: normalizeString(row.message_link),
    }))
    .filter((event) => Boolean(event.title) || Boolean(event.link));

  let ownerDiagnostics: TelegramSourceHistoryOwnerDiagnostics | undefined;
  if (args.owner) {
    ownerDiagnostics = {
      bestSourceScore: normalizeScore(historyRow?.score),
      averageSourceScore: normalizeScore(summaryRow.avg_signal_score),
      sourceCountSeen: totalSeen,
      leadWins: normalizeCount(historyRow?.lead_reports),
      followOnCount: normalizeCount(historyRow?.follow_on_reports),
      duplicatePenaltyCount: normalizeCount(summaryRow.duplicate_count),
      totalEvents: normalizeCount(historyRow?.total_events),
    };
  }

  return {
    window,
    generatedAt: new Date(nowMs).toISOString(),
    source,
    summary,
    recentEvents,
    ...(ownerDiagnostics ? { ownerDiagnostics } : {}),
  };
}
