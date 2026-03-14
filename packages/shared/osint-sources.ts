export const RSS_SOURCE_HEALTH_STATUSES = [
  "healthy",
  "not_modified",
  "http_error",
  "parse_error",
  "timeout",
  "network_error",
  "disabled",
] as const;

export type RssSourceHealthStatus = (typeof RSS_SOURCE_HEALTH_STATUSES)[number];

export type RssSourceHealthRecord = {
  status: RssSourceHealthStatus;
  lastCheckedAtMs: number;
  lastSuccessAtMs?: number;
  lastFailureAtMs?: number;
  lastHttpStatus?: number;
  lastError?: string;
  consecutiveFailures: number;
  lastItemCount: number;
};

export type OsintSourcesCatalogHealthSummary = {
  feedSourceCount: number;
  checkedSourceCount: number;
  failingSourceIds: string[];
  byStatus: Record<RssSourceHealthStatus, number>;
};

export type OsintSourcesCatalogEnvelope<TItem> = {
  returned: number;
  total: number;
  items: TItem[];
  healthSummary: OsintSourcesCatalogHealthSummary;
};
