export type TelegramSourceLeaderboardWindow = "24h" | "7d" | "30d";

export type TelegramSourceLeaderboardEntry = {
  channel: string;
  label: string;
  leadCount: number;
  avgSignalScore: number;
  highSignalLeadCount: number;
  corroboratedLeadCount: number;
  sourceHistoryScore: number;
  trustTier: "core" | "verified" | "watch";
  latencyTier: "instant" | "fast" | "monitor";
  leaderboardScore: number;
};

const WINDOW_TO_MS: Record<TelegramSourceLeaderboardWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};
const TELEGRAM_LEADERBOARD_RETURN_LIMIT = 25;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeWindow(value: string | null | undefined): TelegramSourceLeaderboardWindow {
  if (value === "7d" || value === "30d") return value;
  return "24h";
}

function normalizeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 100) : 0;
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeTier<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function computeTelegramSourceLeaderboardScore(args: {
  leadCount: number;
  avgSignalScore: number;
  highSignalLeadCount: number;
  corroboratedLeadCount: number;
  sourceHistoryScore: number;
  trustTier: "core" | "verified" | "watch";
}): number {
  const leadCount = normalizeCount(args.leadCount);
  const avgSignalScore = normalizeScore(args.avgSignalScore);
  const highSignalLeadCount = normalizeCount(args.highSignalLeadCount);
  const corroboratedLeadCount = normalizeCount(args.corroboratedLeadCount);
  const sourceHistoryScore = normalizeScore(args.sourceHistoryScore);
  const leadVolumeScore = Math.min(18, Math.round(Math.sqrt(leadCount) * 6));
  const confirmedHitRate = leadCount > 0 ? highSignalLeadCount / leadCount : 0;
  const corroborationRate = leadCount > 0 ? corroboratedLeadCount / leadCount : 0;
  const trustBoost = args.trustTier === "core" ? 10 : args.trustTier === "verified" ? 5 : 0;

  return clamp(
    Math.round(
      leadVolumeScore +
        avgSignalScore * 0.35 +
        confirmedHitRate * 30 +
        corroborationRate * 12 +
        sourceHistoryScore * 0.18 +
        trustBoost,
    ),
    0,
    999,
  );
}

function compareTelegramSourceLeaderboardEntries(
  left: TelegramSourceLeaderboardEntry,
  right: TelegramSourceLeaderboardEntry,
): number {
  if (right.leaderboardScore !== left.leaderboardScore) return right.leaderboardScore - left.leaderboardScore;
  if (right.highSignalLeadCount !== left.highSignalLeadCount) return right.highSignalLeadCount - left.highSignalLeadCount;
  if (right.avgSignalScore !== left.avgSignalScore) return right.avgSignalScore - left.avgSignalScore;
  return right.leadCount - left.leadCount;
}

export function resolveTelegramLeaderboardWindowStart(nowMs: number, window: TelegramSourceLeaderboardWindow): string {
  return new Date(Math.max(0, nowMs - WINDOW_TO_MS[window])).toISOString();
}

export function normalizeTelegramSourceLeaderboardRows(rows: unknown[]): TelegramSourceLeaderboardEntry[] {
  return rows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const channel = typeof record.channel === "string" ? record.channel.trim() : "";
      const label = typeof record.label === "string" && record.label.trim() ? record.label.trim() : channel;
      if (!channel || !label) return null;
      const leadCount = normalizeCount(record.lead_count);
      const avgSignalScore = normalizeScore(record.avg_signal_score);
      const highSignalLeadCount = normalizeCount(record.high_signal_lead_count);
      const corroboratedLeadCount = normalizeCount(record.corroborated_lead_count);
      const sourceHistoryScore = normalizeScore(record.source_history_score);
      const trustTier = normalizeTier(record.trust_tier, ["core", "verified", "watch"] as const, "watch");
      const latencyTier = normalizeTier(record.latency_tier, ["instant", "fast", "monitor"] as const, "monitor");
      const leaderboardScore = typeof record.leaderboard_score === "number" && Number.isFinite(record.leaderboard_score)
        ? clamp(Math.round(record.leaderboard_score), 0, 999)
        : computeTelegramSourceLeaderboardScore({
          leadCount,
          avgSignalScore,
          highSignalLeadCount,
          corroboratedLeadCount,
          sourceHistoryScore,
          trustTier,
        });
      return {
        channel,
        label,
        leadCount,
        avgSignalScore,
        highSignalLeadCount,
        corroboratedLeadCount,
        sourceHistoryScore,
        trustTier,
        latencyTier,
        leaderboardScore,
      } satisfies TelegramSourceLeaderboardEntry;
    })
    .filter((entry): entry is TelegramSourceLeaderboardEntry => entry !== null)
    .sort(compareTelegramSourceLeaderboardEntries)
    .slice(0, TELEGRAM_LEADERBOARD_RETURN_LIMIT);
}

export async function queryTelegramSourceLeaderboard(args: {
  db: D1Database;
  windowRaw: string | null | undefined;
  nowMs?: number;
}): Promise<{
  window: TelegramSourceLeaderboardWindow;
  generatedAt: string;
  entries: TelegramSourceLeaderboardEntry[];
}> {
  const window = normalizeWindow(args.windowRaw);
  const nowMs = Number.isFinite(args.nowMs) ? Math.max(0, Math.floor(args.nowMs as number)) : Date.now();
  const cutoffIso = resolveTelegramLeaderboardWindowStart(nowMs, window);
  const result = await args.db.prepare(
    `WITH ranked_sources AS (
      SELECT
        s.event_id,
        s.channel,
        s.label,
        e.signal_score,
        e.signal_grade,
        e.source_count,
        h.score AS source_history_score,
        h.trust_tier,
        h.latency_tier,
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
      LEFT JOIN telegram_source_history h ON h.channel = s.channel
      WHERE e.datetime >= ?
    )
    SELECT
      channel,
      MAX(label) AS label,
      COUNT(*) AS lead_count,
      AVG(COALESCE(signal_score, 0)) AS avg_signal_score,
      SUM(CASE WHEN signal_grade IN ('A', 'B') THEN 1 ELSE 0 END) AS high_signal_lead_count,
      SUM(CASE WHEN source_count >= 2 THEN 1 ELSE 0 END) AS corroborated_lead_count,
      MAX(COALESCE(source_history_score, 0)) AS source_history_score,
      MAX(COALESCE(trust_tier, 'watch')) AS trust_tier,
      MAX(COALESCE(latency_tier, 'monitor')) AS latency_tier,
      ROUND(
        MIN(18, SQRT(COUNT(*)) * 6) +
        AVG(COALESCE(signal_score, 0)) * 0.35 +
        (CASE
          WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN signal_grade IN ('A', 'B') THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) * 30
          ELSE 0
        END) +
        (CASE
          WHEN COUNT(*) > 0
          THEN (SUM(CASE WHEN source_count >= 2 THEN 1 ELSE 0 END) * 1.0 / COUNT(*)) * 12
          ELSE 0
        END) +
        MAX(COALESCE(source_history_score, 0)) * 0.18 +
        CASE MAX(COALESCE(trust_tier, 'watch')) WHEN 'core' THEN 10 WHEN 'verified' THEN 5 ELSE 0 END
      ) AS leaderboard_score
    FROM ranked_sources
    WHERE rank_in_event = 1
    GROUP BY channel
    ORDER BY
      leaderboard_score DESC,
      SUM(CASE WHEN signal_grade IN ('A', 'B') THEN 1 ELSE 0 END) DESC,
      AVG(COALESCE(signal_score, 0)) DESC,
      COUNT(*) DESC
    LIMIT ${TELEGRAM_LEADERBOARD_RETURN_LIMIT}`,
  ).bind(cutoffIso).all<Record<string, unknown>>();

  return {
    window,
    generatedAt: new Date(nowMs).toISOString(),
    entries: normalizeTelegramSourceLeaderboardRows(Array.isArray(result.results) ? result.results : []),
  };
}
