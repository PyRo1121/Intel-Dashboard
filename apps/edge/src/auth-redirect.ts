import { DEFAULT_APP_ORIGIN } from "./security-guards.ts";

const ALLOWED_EXTERNAL_AUTH_HOSTS = new Set([
  "x.com",
  "api.x.com",
  "twitter.com",
  "api.twitter.com",
  "github.com",
]);

export function normalizeSafeAuthRedirectLocation(
  rawLocation: string | null | undefined,
  origin = DEFAULT_APP_ORIGIN,
): string | null {
  const compact = (rawLocation ?? "").trim();
  if (!compact) return null;

  let parsed: URL;
  try {
    parsed = new URL(compact, origin);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return null;
  }

  const originHost = (() => {
    try {
      return new URL(origin).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const host = parsed.hostname.toLowerCase();

  if (host === originHost) {
    if (parsed.pathname.startsWith("/auth/") || parsed.pathname.startsWith("/oauth/")) {
      return parsed.toString();
    }
    return null;
  }

  if (!ALLOWED_EXTERNAL_AUTH_HOSTS.has(host)) {
    return null;
  }

  if (host === "github.com" && !parsed.pathname.startsWith("/login/oauth/authorize")) {
    return null;
  }
  if (
    (host === "x.com" || host === "api.x.com" || host === "twitter.com" || host === "api.twitter.com") &&
    !parsed.pathname.includes("/oauth")
  ) {
    return null;
  }

  return parsed.toString();
}
