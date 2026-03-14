export type IntelCacheHealthEntry = {
  timestamp: number;
};

export type IntelCacheHealthReport = {
  status: "ok" | "degraded";
  missingEndpoints: string[];
  staleEndpoints: string[];
};

export function evaluateIntelCacheHealth(args: {
  cache: ReadonlyMap<string, IntelCacheHealthEntry>;
  nowMs: number;
  staleWindowByEndpoint: Record<string, number>;
  requiredEndpoints: readonly string[];
}): IntelCacheHealthReport {
  const missingEndpoints: string[] = [];
  const staleEndpoints: string[] = [];

  for (const endpoint of args.requiredEndpoints) {
    const cached = args.cache.get(endpoint);
    if (!cached) {
      missingEndpoints.push(endpoint);
      continue;
    }
    const staleWindowMs = args.staleWindowByEndpoint[endpoint];
    if (
      !Number.isFinite(cached.timestamp) ||
      (Number.isFinite(staleWindowMs) && args.nowMs - cached.timestamp > staleWindowMs)
    ) {
      staleEndpoints.push(endpoint);
    }
  }

  return {
    status: missingEndpoints.length === 0 && staleEndpoints.length === 0 ? "ok" : "degraded",
    missingEndpoints,
    staleEndpoints,
  };
}
