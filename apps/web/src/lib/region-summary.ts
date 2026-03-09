import { countBySeverity } from "./utils.ts";
import type { IntelItem, IntelRegion } from "./types.ts";

export type RegionSummary = {
  region: IntelRegion;
  eventCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  topItems: IntelItem[];
  lastUpdate: string;
};

export const REGION_ORDER: IntelRegion[] = [
  "ukraine",
  "middle_east",
  "east_asia",
  "africa",
  "europe",
  "central_america",
  "pacific",
  "military",
  "us",
  "global",
];

export function buildRegionSummaries(items: IntelItem[]): RegionSummary[] {
  const grouped: Record<string, IntelItem[]> = {};
  for (const item of items) {
    const region = item.region || "global";
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push(item);
  }

  return REGION_ORDER.map((region) => {
    const regionItems = grouped[region] ?? [];
    const counts = countBySeverity(regionItems);
    const lastUpdate = regionItems[0]?.timestamp ?? new Date().toISOString();
    return {
      region,
      eventCount: regionItems.length,
      critical: counts.critical,
      high: counts.high,
      medium: counts.medium,
      low: counts.low,
      topItems: regionItems.slice(0, 5),
      lastUpdate,
    };
  });
}

export function sumRegionSeverity(
  summaries: readonly RegionSummary[],
  severity: "critical" | "high" | "medium" | "low",
): number {
  return summaries.reduce((sum, summary) => sum + summary[severity], 0);
}

export function findRegionSummary(
  summaries: readonly RegionSummary[],
  region: IntelRegion | null | undefined,
): RegionSummary | null {
  if (!region) return null;
  return summaries.find((summary) => summary.region === region) ?? null;
}
