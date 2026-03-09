import { formatEventLabel } from "./event-label.ts";

export type AiTelemetryCacheStatsLike = {
  cacheHits?: number;
  cacheMisses?: number;
} | null | undefined;

export function readAiTelemetryItems<T>(items: readonly T[] | null | undefined): T[] {
  return [...(items ?? [])];
}

export function getAiTelemetryLabel(label: string | undefined): string {
  return formatEventLabel(label);
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
