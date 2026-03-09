export const DASHBOARD_HOME_PATH = "/overview";
export const DEFAULT_POST_AUTH_PATH = DASHBOARD_HOME_PATH;

export const AUTH_NEXT_ROUTE_PREFIXES = [
  DASHBOARD_HOME_PATH,
  "/osint",
  "/my-feed",
  "/my-alerts",
  "/telegram",
  "/map",
  "/air-sea",
  "/briefings",
  "/billing",
  "/crm",
] as const;
