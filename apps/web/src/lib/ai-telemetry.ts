import { formatEventLabel } from "./event-label.ts";
import { formatPercent, formatWholeNumber } from "./utils.ts";

export type AiTelemetryCacheStatsLike = {
  cacheHits?: number;
  cacheMisses?: number;
} | null | undefined;

export type AiTelemetrySummaryLike = {
  calls?: number;
  promptTokens?: number;
  completionTokens?: number;
  outputInputRatio?: number;
  avgDurationMs?: number;
  p95DurationMs?: number;
} | null | undefined;

export type AiTelemetryLaneLike = {
  label?: string;
  calls?: number;
  failures?: number;
  p95DurationMs?: number;
  outputInputRatio?: number;
} | null | undefined;

export function readAiTelemetryItems<T>(items: readonly T[] | null | undefined): T[] {
  return [...(items ?? [])];
}

export function getAiTelemetryLabel(label: string | undefined): string {
  return formatEventLabel(label);
}

export function getAiTelemetryOutputInputPercent(summary: AiTelemetrySummaryLike): number {
  return (summary?.outputInputRatio ?? 0) * 100;
}

export function getAiTelemetryCalls(summary: AiTelemetrySummaryLike): number | undefined {
  return summary?.calls;
}

export function getAiTelemetryPromptTokens(summary: AiTelemetrySummaryLike): number | undefined {
  return summary?.promptTokens;
}

export function getAiTelemetryCompletionTokens(summary: AiTelemetrySummaryLike): number | undefined {
  return summary?.completionTokens;
}

export function getAiTelemetryAvgDurationMs(summary: AiTelemetrySummaryLike): number | undefined {
  return summary?.avgDurationMs;
}

export function getAiTelemetryP95DurationMs(summary: AiTelemetrySummaryLike): number | undefined {
  return summary?.p95DurationMs;
}

export function getAiTelemetrySummaryRows(summary: AiTelemetrySummaryLike, cacheHitPercent: number): Array<{
  label: string;
  value: string;
  valueTone?: string;
}> {
  return [
    { label: "Calls", value: formatWholeNumber(getAiTelemetryCalls(summary)) },
    { label: "Prompt Tokens", value: formatWholeNumber(getAiTelemetryPromptTokens(summary)) },
    { label: "Completion Tokens", value: formatWholeNumber(getAiTelemetryCompletionTokens(summary)) },
    { label: "Output/Input", value: formatPercent(getAiTelemetryOutputInputPercent(summary)), valueTone: "text-cyan-300" },
    { label: "Avg Latency", value: `${formatWholeNumber(getAiTelemetryAvgDurationMs(summary))}ms` },
    { label: "P95 Latency", value: `${formatWholeNumber(getAiTelemetryP95DurationMs(summary))}ms` },
    { label: "Cache Hit Rate", value: formatPercent(cacheHitPercent), valueTone: "text-emerald-300" },
  ];
}

export function getAiTelemetryHotspotRows(input: {
  worstFailureLane?: AiTelemetryLaneLike;
  slowestLane?: AiTelemetryLaneLike;
  hungriestLane?: AiTelemetryLaneLike;
}): Array<{ label: string; title: string; detail: string }> {
  return [
    {
      label: "Failure Hotspot",
      title: getAiTelemetryLabel(input.worstFailureLane?.label),
      detail: `${formatWholeNumber(input.worstFailureLane?.failures)} failures across ${formatWholeNumber(input.worstFailureLane?.calls)} calls`,
    },
    {
      label: "Slowest Lane (P95)",
      title: getAiTelemetryLabel(input.slowestLane?.label),
      detail: `${formatWholeNumber(input.slowestLane?.p95DurationMs)}ms p95 latency`,
    },
    {
      label: "Most Output-Heavy Lane",
      title: getAiTelemetryLabel(input.hungriestLane?.label),
      detail: `${formatPercent(((input.hungriestLane?.outputInputRatio ?? 0) * 100))} output/input ratio`,
    },
  ];
}

export function getAiTelemetryMaxValue<T>(
  items: readonly T[] | null | undefined,
  select: (item: T) => number | null | undefined,
  minimum = 0,
): number {
  let max = minimum;
  for (const item of items ?? []) {
    const value = select(item);
    if (typeof value === "number" && Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max;
}

export function getAiTelemetryTopEntryBy<T>(
  items: readonly T[] | null | undefined,
  select: (item: T) => number | null | undefined,
): T | null {
  let best: T | null = null;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (const item of items ?? []) {
    const raw = select(item);
    const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
    if (best === null || value > bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

export function computeAiCacheHitRatePercent(input: AiTelemetryCacheStatsLike): number {
  const hits = Math.max(0, input?.cacheHits ?? 0);
  const misses = Math.max(0, input?.cacheMisses ?? 0);
  const total = hits + misses;
  if (total <= 0) return 0;
  return (hits / total) * 100;
}
