export type Severity = "critical" | "high" | "medium" | "low";
export type IntelRegion = "middle_east" | "ukraine" | "europe" | "pacific" | "africa" | "east_asia" | "central_america" | "military" | "global" | "us";
export type IntelCategory = "news" | "conflict" | "notam" | "military_movement";

export interface IntelItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: IntelRegion | "";
  category: IntelCategory | "";
  severity: Severity | "";
}

export interface Briefing {
  id: string;
  timestamp: string;
  content: string;
  severity_summary: { critical: number; high: number; medium: number; low: number };
}

export const REGION_LABELS: Record<IntelRegion, string> = {
  middle_east: "Middle East",
  ukraine: "Ukraine",
  europe: "Europe",
  pacific: "Pacific",
  africa: "Africa",
  east_asia: "East Asia",
  central_america: "Central America",
  military: "Military",
  global: "Global",
  us: "United States",
};

export const CATEGORY_LABELS: Record<IntelCategory, string> = {
  news: "News",
  conflict: "Conflict",
  notam: "NOTAM",
  military_movement: "Military Movement",
};
