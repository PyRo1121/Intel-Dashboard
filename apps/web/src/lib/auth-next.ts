import { AUTH_NEXT_ROUTE_PREFIXES } from "../../../../packages/shared/auth-next-routes.ts";
import { SITE_ORIGIN } from "../../../../packages/shared/site-config.ts";

export function normalizeClientPostAuthPath(rawValue: string | null | undefined): string | null {
  const compact = (rawValue ?? "").trim();
  if (!compact) return null;

  let parsed: URL;
  try {
    parsed = new URL(compact, SITE_ORIGIN);
  } catch {
    return null;
  }

  if (parsed.origin !== SITE_ORIGIN) return null;
  const pathname = parsed.pathname;
  const allowed = AUTH_NEXT_ROUTE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!allowed) return null;

  return `${pathname}${parsed.search}${parsed.hash}`;
}

export function buildClientAuthHref(basePath: string, nextPath: string | null): string {
  const normalizedBase = basePath.trim() || "/";
  if (!nextPath) return normalizedBase;
  const target = new URL(normalizedBase, SITE_ORIGIN);
  target.searchParams.set("next", nextPath);
  return `${target.pathname}${target.search}${target.hash}`;
}
