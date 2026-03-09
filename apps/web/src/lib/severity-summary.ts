export type SeveritySummaryLike = {
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export function getSeveritySummaryTotal(summary: SeveritySummaryLike): number {
  return summary.critical + summary.high + summary.medium + summary.low;
}

export function getSeveritySummaryAccentClass(summary: SeveritySummaryLike): string {
  if (summary.critical > 0) return "via-red-500/30";
  if (summary.high > 0) return "via-amber-500/25";
  return "via-blue-500/20";
}
