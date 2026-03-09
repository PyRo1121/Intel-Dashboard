import { fetchIntelFeed } from "./intel-feed.ts";
import { normalizeIntelItem } from "./intel-text.ts";
import type { IntelItem } from "./types.ts";

export async function fetchOsintItems(): Promise<IntelItem[]> {
  const data = await fetchIntelFeed();
  return Array.isArray(data)
    ? data
      .filter((item): item is IntelItem => item && typeof item === "object")
      .map((item) => normalizeIntelItem(item))
    : [];
}
