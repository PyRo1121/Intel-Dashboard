import { fetchPublicJson } from "./client-json.ts";
import type { IntelItem } from "./types.ts";

export async function fetchIntelFeed(): Promise<IntelItem[]> {
  const result = await fetchPublicJson<unknown>("/api/intel");
  return result.ok && Array.isArray(result.data) ? result.data : [];
}
