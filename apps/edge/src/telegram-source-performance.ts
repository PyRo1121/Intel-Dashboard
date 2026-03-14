import type { ChannelConfig } from "./channels";

export interface TelegramSourcePerformanceStats {
  totalEvents: number;
  leadReports: number;
  followOnReports: number;
  corroboratedReports: number;
  singleSourceReports: number;
  score: number;
  lastLeadAtMs: number | null;
  lastSeenAtMs: number | null;
  updatedAtMs: number | null;
}

export interface TelegramSourcePerformanceRow {
  channel: string;
  total_events: number;
  lead_reports: number;
  follow_on_reports: number;
  corroborated_reports: number;
  single_source_reports: number;
  score: number;
  last_lead_at: number | null;
  last_seen_at: number | null;
  updated_at: number | null;
}

export interface TelegramSourcePerformanceContribution {
  totalEvents: number;
  leadReports: number;
  followOnReports: number;
  corroboratedReports: number;
  singleSourceReports: number;
  lastLeadAtMs?: number;
  lastSeenAtMs: number;
}

const DEFAULT_HALF_LIFE_DAYS = 21;
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeMetric(value: number | null | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function normalizeFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeNullableFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function normalizeTelegramSourcePerformanceRows(rows: unknown): TelegramSourcePerformanceRow[] {
  if (!Array.isArray(rows)) return [];
  const normalized: TelegramSourcePerformanceRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    normalized.push({
      channel: typeof record.channel === "string" ? record.channel : "",
      total_events: normalizeFiniteNumber(record.total_events, 0),
      lead_reports: normalizeFiniteNumber(record.lead_reports, 0),
      follow_on_reports: normalizeFiniteNumber(record.follow_on_reports, 0),
      corroborated_reports: normalizeFiniteNumber(record.corroborated_reports, 0),
      single_source_reports: normalizeFiniteNumber(record.single_source_reports, 0),
      score: normalizeFiniteNumber(record.score, 0),
      last_lead_at: normalizeNullableFiniteNumber(record.last_lead_at),
      last_seen_at: normalizeNullableFiniteNumber(record.last_seen_at),
      updated_at: normalizeNullableFiniteNumber(record.updated_at),
    });
  }
  return normalized;
}

function decayFactor(nowMs: number, updatedAtMs: number | null | undefined, halfLifeDays: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedAtMs) || halfLifeDays <= 0) {
    return 1;
  }
  const elapsedMs = Math.max(0, nowMs - Number(updatedAtMs));
  if (elapsedMs <= 0) return 1;
  return Math.pow(0.5, elapsedMs / (halfLifeDays * DAY_MS));
}

function trustBoost(trustTier: ChannelConfig["trustTier"]): number {
  if (trustTier === "core") return 6;
  if (trustTier === "verified") return 3;
  return 0;
}

function latencyBoost(latencyTier: ChannelConfig["latencyTier"]): number {
  if (latencyTier === "instant") return 6;
  if (latencyTier === "fast") return 3;
  return 0;
}

function recentLeadBoost(nowMs: number, lastLeadAtMs: number | null): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(lastLeadAtMs)) return 0;
  const ageMs = Math.max(0, nowMs - Number(lastLeadAtMs));
  if (ageMs <= DAY_MS) return 5;
  if (ageMs <= 3 * DAY_MS) return 2;
  return 0;
}

export function computeTelegramSourcePerformanceScore(args: {
  baseSubscriberValue: number;
  trustTier: ChannelConfig["trustTier"];
  latencyTier: ChannelConfig["latencyTier"];
  totalEvents: number;
  leadReports: number;
  followOnReports: number;
  corroboratedReports: number;
  singleSourceReports: number;
  lastLeadAtMs: number | null;
  nowMs: number;
}): number {
  const totalEvents = normalizeMetric(args.totalEvents);
  const leadReports = normalizeMetric(args.leadReports);
  const followOnReports = normalizeMetric(args.followOnReports);
  const corroboratedReports = normalizeMetric(args.corroboratedReports);
  const singleSourceReports = normalizeMetric(args.singleSourceReports);
  const observedReports = Math.max(1, totalEvents, leadReports + followOnReports + singleSourceReports);
  const leadRate = leadReports / observedReports;
  const followOnRate = followOnReports / observedReports;
  const corroborationRate = corroboratedReports / observedReports;
  const singleSourceRate = singleSourceReports / observedReports;
  const highVolumeFactor = clamp((observedReports - 12) / 36, 0, 1);
  const lowYieldFactor = clamp((0.5 - leadRate) / 0.5, 0, 1);
  const corroborationDeficitFactor = clamp((0.5 - corroborationRate) / 0.5, 0, 1);
  const chatterPenalty = highVolumeFactor * (lowYieldFactor * 10 + corroborationDeficitFactor * 6);

  const rawScore =
    clamp(args.baseSubscriberValue, 0, 100) * 0.55 +
    leadRate * 26 +
    corroborationRate * 10 -
    followOnRate * 18 -
    singleSourceRate * 4 -
    chatterPenalty +
    trustBoost(args.trustTier) +
    latencyBoost(args.latencyTier) +
    recentLeadBoost(args.nowMs, args.lastLeadAtMs);

  return Math.round(clamp(rawScore, 0, 100));
}

export function createEmptyTelegramSourcePerformanceStats(): TelegramSourcePerformanceStats {
  return {
    totalEvents: 0,
    leadReports: 0,
    followOnReports: 0,
    corroboratedReports: 0,
    singleSourceReports: 0,
    score: 0,
    lastLeadAtMs: null,
    lastSeenAtMs: null,
    updatedAtMs: null,
  };
}

export function isLeadTelegramSource(args: {
  sourceDatetimeMs: number;
  earliestDatetimeMs: number;
  leadWindowMs?: number;
}): boolean {
  const sourceDatetimeMs = Number.isFinite(args.sourceDatetimeMs) ? Math.max(0, args.sourceDatetimeMs) : 0;
  const earliestDatetimeMs = Number.isFinite(args.earliestDatetimeMs) ? Math.max(0, args.earliestDatetimeMs) : 0;
  const leadWindowMs = Math.max(0, Math.floor(args.leadWindowMs ?? 3 * 60 * 1000));
  if (sourceDatetimeMs <= 0 || earliestDatetimeMs <= 0) return false;
  return sourceDatetimeMs >= earliestDatetimeMs && sourceDatetimeMs - earliestDatetimeMs <= leadWindowMs;
}

export function applyTelegramSourcePerformanceContribution(args: {
  current: TelegramSourcePerformanceStats;
  contribution: TelegramSourcePerformanceContribution;
  nowMs: number;
  halfLifeDays?: number;
}): TelegramSourcePerformanceStats {
  const halfLifeDays = clamp(Math.floor(args.halfLifeDays ?? DEFAULT_HALF_LIFE_DAYS), 1, 120);
  const previous = args.current;
  const factor = decayFactor(args.nowMs, previous.updatedAtMs ?? null, halfLifeDays);

  const totalEvents = normalizeMetric(previous.totalEvents) * factor + Math.max(0, args.contribution.totalEvents);
  const leadReports = normalizeMetric(previous.leadReports) * factor + Math.max(0, args.contribution.leadReports);
  const followOnReports =
    normalizeMetric(previous.followOnReports) * factor + Math.max(0, args.contribution.followOnReports);
  const corroboratedReports =
    normalizeMetric(previous.corroboratedReports) * factor + Math.max(0, args.contribution.corroboratedReports);
  const singleSourceReports =
    normalizeMetric(previous.singleSourceReports) * factor + Math.max(0, args.contribution.singleSourceReports);
  const lastLeadAtMs =
    Math.max(0, args.contribution.leadReports) > 0
      ? (Number.isFinite(args.contribution.lastLeadAtMs) ? Math.max(0, args.contribution.lastLeadAtMs as number) : args.contribution.lastSeenAtMs)
      : previous.lastLeadAtMs;
  const lastSeenAtMs = Number.isFinite(args.contribution.lastSeenAtMs)
    ? Math.max(0, args.contribution.lastSeenAtMs)
    : previous.lastSeenAtMs;

  return {
    totalEvents,
    leadReports,
    followOnReports,
    corroboratedReports,
    singleSourceReports,
    score: computeTelegramSourcePerformanceScore({
      baseSubscriberValue: 0,
      trustTier: "watch",
      latencyTier: "monitor",
      totalEvents,
      leadReports,
      followOnReports,
      corroboratedReports,
      singleSourceReports,
      lastLeadAtMs,
      nowMs: args.nowMs,
    }),
    lastLeadAtMs,
    lastSeenAtMs,
    updatedAtMs: args.nowMs,
  };
}

export function updateTelegramSourcePerformanceStats(args: {
  previous?: TelegramSourcePerformanceStats | null;
  contribution: TelegramSourcePerformanceContribution;
  baseScore: number;
  trustTier: ChannelConfig["trustTier"];
  latencyTier: ChannelConfig["latencyTier"];
  nowMs: number;
  halfLifeDays?: number;
}): TelegramSourcePerformanceStats {
  const updated = applyTelegramSourcePerformanceContribution({
    current: args.previous ?? createEmptyTelegramSourcePerformanceStats(),
    contribution: args.contribution,
    nowMs: args.nowMs,
    halfLifeDays: args.halfLifeDays,
  });
  return {
    ...updated,
    score: computeTelegramSourcePerformanceScore({
      baseSubscriberValue: args.baseScore,
      trustTier: args.trustTier,
      latencyTier: args.latencyTier,
      totalEvents: updated.totalEvents,
      leadReports: updated.leadReports,
      followOnReports: updated.followOnReports,
      corroboratedReports: updated.corroboratedReports,
      singleSourceReports: updated.singleSourceReports,
      lastLeadAtMs: updated.lastLeadAtMs,
      nowMs: args.nowMs,
    }),
  };
}
