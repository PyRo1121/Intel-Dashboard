export function isCurrentCacheGeneration(startGeneration: number, currentGeneration: number): boolean {
  return startGeneration === currentGeneration;
}

export function buildCacheBustRefreshEndpoints(
  baseEndpoints: readonly string[],
  chatHistoryEndpoints: readonly string[],
): string[] {
  const endpoints = new Set<string>(baseEndpoints);
  endpoints.add("/api/whales");
  for (const endpoint of chatHistoryEndpoints) {
    endpoints.add(endpoint);
  }
  return [...endpoints];
}

export function buildCacheBustRefreshBatches(
  refreshTargets: readonly string[],
  maxParallelism: number,
): string[][] {
  const flooredMaxParallelism = Math.floor(maxParallelism);
  const normalizedMaxParallelism = Number.isFinite(flooredMaxParallelism) && flooredMaxParallelism > 0
    ? flooredMaxParallelism
    : 1;
  const batches: string[][] = [];
  for (let index = 0; index < refreshTargets.length; index += normalizedMaxParallelism) {
    batches.push(refreshTargets.slice(index, index + normalizedMaxParallelism));
  }
  return batches;
}

export function formatCacheBustRefreshFailure(endpoint: string, error: unknown): string {
  if (error instanceof Error) {
    return `${endpoint}: ${error.message}`;
  }
  if (typeof error === "string" && error.trim()) {
    return `${endpoint}: ${error}`;
  }
  return `${endpoint}: refresh_unavailable`;
}
