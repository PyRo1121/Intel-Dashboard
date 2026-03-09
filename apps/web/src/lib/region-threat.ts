export type RegionThreatSummaryLike = {
  critical: number;
  high: number;
  medium: number;
};

export type RegionThreatLevel = {
  label: string;
  color: string;
  mapColor: string;
  bgColor: string;
};

export function getRegionThreatLevel(summary: RegionThreatSummaryLike): RegionThreatLevel {
  if (summary.critical >= 3) {
    return { label: "CRITICAL", color: "text-red-400", mapColor: "#ef4444", bgColor: "bg-red-500/10" };
  }
  if (summary.critical >= 1 || summary.high >= 3) {
    return { label: "HIGH", color: "text-amber-400", mapColor: "#f59e0b", bgColor: "bg-amber-500/10" };
  }
  if (summary.high >= 1 || summary.medium >= 2) {
    return { label: "ELEVATED", color: "text-blue-400", mapColor: "#3b82f6", bgColor: "bg-blue-500/10" };
  }
  return { label: "LOW", color: "text-zinc-400", mapColor: "#71717a", bgColor: "bg-zinc-500/10" };
}
