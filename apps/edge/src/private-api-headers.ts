import { buildCorsHeaders, DEFAULT_APP_ORIGIN } from "./security-guards.ts";

export function mergeVary(existing: string | null, values: string[]): string {
  const set = new Set<string>();
  if (existing) {
    for (const part of existing.split(",")) {
      const key = part.trim();
      if (key) set.add(key);
    }
  }
  for (const value of values) {
    const key = value.trim();
    if (key) set.add(key);
  }
  return [...set].join(", ");
}

export function corsHeaders(origin?: string | null): Record<string, string> {
  return buildCorsHeaders({ origin, fallbackOrigin: DEFAULT_APP_ORIGIN });
}

export function privateApiHeaders(origin: string | null, existingVary: string | null = null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    ...corsHeaders(origin),
  });
  headers.set(
    "Vary",
    mergeVary(existingVary, ["Origin", "Cookie", "Authorization"]),
  );
  return headers;
}
