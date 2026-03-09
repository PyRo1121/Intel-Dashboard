import type { IntelRegion } from "./types.ts";

export const REGION_CENTROIDS: Record<IntelRegion, [number, number]> = {
  ukraine: [48.5, 35.0],
  middle_east: [30.0, 44.0],
  east_asia: [35.0, 118.0],
  africa: [5.0, 22.0],
  europe: [50.0, 10.0],
  central_america: [17.0, -88.0],
  pacific: [12.0, 140.0],
  military: [38.9, -77.0],
  us: [39.0, -98.0],
  global: [15.0, 0.0],
};

export const REGION_ACCENT: Record<IntelRegion, string> = {
  ukraine: "#fbbf24",
  middle_east: "#f97316",
  east_asia: "#06b6d4",
  africa: "#a855f7",
  europe: "#3b82f6",
  central_america: "#10b981",
  pacific: "#0ea5e9",
  military: "#6366f1",
  us: "#8b5cf6",
  global: "#71717a",
};
