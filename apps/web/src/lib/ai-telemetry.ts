export type AiTelemetryCacheStatsLike = {
  cacheHits?: number;
  cacheMisses?: number;
} | null | undefined;

export function computeAiCacheHitRatePercent(input: AiTelemetryCacheStatsLike): number {
  const hits = Math.max(0, input?.cacheHits ?? 0);
  const misses = Math.max(0, input?.cacheMisses ?? 0);
  const total = hits + misses;
  if (total <= 0) return 0;
  return (hits / total) * 100;
}
