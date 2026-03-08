export const SITE_ORIGIN = "https://intel.pyro1121.com";
export const BACKEND_E2E_ORIGIN = "https://backend-e2e.pyro1121.com";
export const SITE_NAME = "Intel Dashboard";
export const SITE_PLATFORM_LABEL = "Intelligence Platform";
export const SITE_OPERATIONS_LABEL = "Intel Operations";
export const INTERNAL_LANDING_TAGLINE = "Real-Time OSINT Intelligence Stream";
export const SITE_DESCRIPTION =
  "Real-time OSINT dashboard with Telegram conflict tracking, military movement signals, and premium low-latency intelligence delivery.";

export function siteUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, SITE_ORIGIN).toString();
}

export function backendE2eUrl(path = "/"): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, BACKEND_E2E_ORIGIN).toString();
}
