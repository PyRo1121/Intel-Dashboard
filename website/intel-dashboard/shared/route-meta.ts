import { DASHBOARD_HOME_PATH } from "./auth-next-routes.ts";
import { SITE_NAME } from "./site-config.ts";

export const PRODUCTION_HOME_TITLE = `${SITE_NAME} OSINT Dashboard | Real-Time Geopolitical Intelligence Platform`;
export const PRODUCTION_HOME_DESCRIPTION = "Real-time OSINT dashboard for SentinelStream with Telegram conflict tracking, military movement signals, and premium low-latency intelligence delivery.";
export const PRODUCTION_HOME_OG_DESCRIPTION = "Track high-priority geopolitical signals in one OSINT platform with fast analyst workflows and premium instant feed delivery.";
export const PRODUCTION_HOME_TWITTER_DESCRIPTION = "Real-time OSINT intelligence with analyst-ready prioritization, threat timelines, and premium instant delivery.";
export const APP_LANDING_TITLE = `${SITE_NAME} | OSINT Intelligence Platform`;
export const APP_LANDING_DESCRIPTION = `${SITE_NAME} delivers real-time OSINT intelligence with AI-assisted prioritization and premium instant feeds.`;
export const OVERVIEW_TITLE = `${SITE_NAME} — Real-Time OSINT & Conflict Intelligence Dashboard`;
export const OVERVIEW_DESCRIPTION = `${SITE_NAME} live intelligence from Telegram conflict channels, military tracking, OSINT aggregation, and AI briefings with premium instant delivery.`;
export const OVERVIEW_OG_DESCRIPTION = `${SITE_NAME} live intelligence from Telegram conflict channels, military tracking, OSINT aggregation, and AI briefings.`;
export const OVERVIEW_TWITTER_DESCRIPTION = `${SITE_NAME} live intelligence from Telegram conflict channels, military tracking, and AI briefings.`;
export const OSINT_TITLE = `OSINT Feed — Real-Time Conflict Events & Intelligence | ${SITE_NAME}`;
export const OSINT_DESCRIPTION = "Aggregated OSINT feed from GDELT, RSS sources, and milblogger channels. Severity-rated conflict events across Ukraine, Middle East, Africa, and global hotspots.";
export const TELEGRAM_TITLE = `Telegram OSINT Monitor — 250+ Global Conflict Channels | ${SITE_NAME}`;
export const TELEGRAM_DESCRIPTION = "Monitor 250+ global Telegram OSINT and conflict channels in real-time. Unified feed with regional filtering, media isolation, cyber tagging, and deep-linking.";
export const BRIEFINGS_TITLE = `AI Intelligence Briefings — Conflict Analysis & Summaries | ${SITE_NAME}`;
export const BRIEFINGS_DESCRIPTION = "AI-generated intelligence briefings delivered every 4 hours. Automated conflict analysis, severity summaries, and strategic insights from global OSINT data.";
export const MAP_TITLE = `Global Threat Map — Live Conflict Monitoring by Region | ${SITE_NAME}`;
export const MAP_DESCRIPTION = "Interactive global threat map with live conflict monitoring by region. Real-time OSINT intelligence on critical, high, and medium severity events worldwide.";
export const AIR_SEA_TITLE = `Military Aircraft Tracker & Air-Sea Operations | ${SITE_NAME}`;
export const AIR_SEA_DESCRIPTION = "Live military aircraft tracking via ADS-B with milblogger air and naval intelligence. Monitor military flights, naval movements, and airspace activity worldwide.";
export const AIR_SEA_SOCIAL_DESCRIPTION = "Live military aircraft tracking via ADS-B with milblogger air and naval intelligence.";
export const BILLING_TITLE = `Billing | ${SITE_NAME}`;
export const BILLING_DESCRIPTION = `Manage ${SITE_NAME} trial, subscription, and entitlement status.`;
export const CRM_TITLE = `Owner CRM | ${SITE_NAME}`;
export const CRM_DESCRIPTION = "Owner CRM command center for subscriptions, growth, and data quality operations.";
export const LOGIN_TITLE = `${SITE_NAME} | Login`;
export const LOGIN_DESCRIPTION = `Sign in to ${SITE_NAME} with secure OAuth using X or GitHub.`;
export const SIGNUP_TITLE = `${SITE_NAME} | Create Account`;
export const SIGNUP_DESCRIPTION = `Create ${SITE_NAME} access with OAuth authentication via X or GitHub.`;
export const NOT_FOUND_TITLE = `Page Not Found | ${SITE_NAME}`;
export const NOT_FOUND_DESCRIPTION = `The page you're looking for doesn't exist or has been moved. Return to the home page to continue exploring ${SITE_NAME}.`;

const DASHBOARD_SHELL_TITLES = [
  { prefix: DASHBOARD_HOME_PATH, title: OVERVIEW_TITLE },
  { prefix: "/osint", title: OSINT_TITLE },
  { prefix: "/telegram", title: TELEGRAM_TITLE },
  { prefix: "/briefings", title: BRIEFINGS_TITLE },
  { prefix: "/map", title: MAP_TITLE },
  { prefix: "/air-sea", title: AIR_SEA_TITLE },
  { prefix: "/billing", title: BILLING_TITLE },
  { prefix: "/crm", title: CRM_TITLE },
] as const;

export function resolveDashboardShellTitle(path: string): string {
  for (const entry of DASHBOARD_SHELL_TITLES) {
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      return entry.title;
    }
  }
  return SITE_NAME;
}
