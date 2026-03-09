import { fetchPublicJson } from "./client-json.ts";
import type { IntelItem } from "./types.ts";

export async function fetchIntelFeed(): Promise<IntelItem[]> {
  const result = await fetchPublicJson<unknown>("/api/intel");
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

export function getVisibleIntelItems<T>(
  items: readonly T[],
  limit = 20,
): T[] {
  return items.slice(0, Math.max(0, limit));
}
