import { fetchPublicJson } from "./client-json.ts";
import type { Briefing } from "./types.ts";

export async function fetchBriefings(): Promise<Briefing[]> {
  const result = await fetchPublicJson<unknown>("/api/briefings");
  return result.ok && Array.isArray(result.data) ? result.data : [];
}
