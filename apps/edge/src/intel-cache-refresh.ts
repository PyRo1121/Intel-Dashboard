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
