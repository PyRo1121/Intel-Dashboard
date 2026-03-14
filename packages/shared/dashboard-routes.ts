export const DASHBOARD_HOME_PATH = "/overview";
export const DEFAULT_POST_AUTH_PATH = DASHBOARD_HOME_PATH;

export const DASHBOARD_ROUTE_PATHS = {
  overview: DASHBOARD_HOME_PATH,
  osint: "/osint",
  osintSource: "/osint/source",
  telegram: "/telegram",
  telegramSource: "/telegram/source",
  myFeed: "/my-feed",
  myAlerts: "/my-alerts",
  briefings: "/briefings",
  map: "/map",
  airSea: "/air-sea",
  billing: "/billing",
  crm: "/crm",
} as const;

export type SitemapEntry = {
  path: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
};

export const AUTH_NEXT_ROUTE_PREFIXES = [
  DASHBOARD_ROUTE_PATHS.overview,
  DASHBOARD_ROUTE_PATHS.osint,
  DASHBOARD_ROUTE_PATHS.myFeed,
  DASHBOARD_ROUTE_PATHS.myAlerts,
  DASHBOARD_ROUTE_PATHS.telegram,
  DASHBOARD_ROUTE_PATHS.map,
  DASHBOARD_ROUTE_PATHS.airSea,
  DASHBOARD_ROUTE_PATHS.briefings,
  DASHBOARD_ROUTE_PATHS.billing,
  DASHBOARD_ROUTE_PATHS.crm,
] as const;

export const PUBLIC_SITEMAP_ENTRIES: readonly SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: DASHBOARD_ROUTE_PATHS.overview, changefreq: "hourly", priority: "0.8" },
  { path: DASHBOARD_ROUTE_PATHS.osint, changefreq: "hourly", priority: "0.9" },
  { path: DASHBOARD_ROUTE_PATHS.telegram, changefreq: "hourly", priority: "0.9" },
  { path: DASHBOARD_ROUTE_PATHS.map, changefreq: "hourly", priority: "0.8" },
  { path: DASHBOARD_ROUTE_PATHS.airSea, changefreq: "hourly", priority: "0.8" },
  { path: DASHBOARD_ROUTE_PATHS.briefings, changefreq: "hourly", priority: "0.7" },
] as const;
