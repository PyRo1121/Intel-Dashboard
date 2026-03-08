import { AUTH_NEXT_ROUTE_PREFIXES } from "../../../packages/shared/auth-next-routes.ts";
import { SITE_ORIGIN } from "../../../packages/shared/site-config.ts";

export function getDashboardAppRoutePrefixes(): readonly string[] {
  return AUTH_NEXT_ROUTE_PREFIXES;
}

export function normalizeSafePostAuthPath(
  rawValue: string | null | undefined,
  origin = SITE_ORIGIN,
): string | null {
  const compact = typeof rawValue === "string" ? rawValue.trim() : "";
  if (!compact) return null;

  let parsed: URL;
  try {
    parsed = new URL(compact, origin);
  } catch {
    return null;
  }

  if (parsed.origin !== origin) {
    return null;
  }

  const pathname = parsed.pathname;
  const allowed = AUTH_NEXT_ROUTE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) {
    return null;
  }

  return `${pathname}${parsed.search}${parsed.hash}`;
}
