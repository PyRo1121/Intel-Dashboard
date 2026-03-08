import { SITE_ORIGIN } from "./site-config.ts";

export type AuthFlowMode = "login" | "signup";
export type AuthFlowProvider = "github" | "x";

export function buildAuthPageHref(
  mode: AuthFlowMode,
  nextPath: string | null,
  errorCode?: string,
): string {
  const target = new URL(`/${mode}`, SITE_ORIGIN);
  if (errorCode) target.searchParams.set("error", errorCode);
  if (nextPath) target.searchParams.set("next", nextPath);
  return `${target.pathname}${target.search}`;
}

export function buildAuthProviderHref(
  provider: AuthFlowProvider,
  mode: AuthFlowMode,
  nextPath: string | null,
): string {
  const target = new URL(buildAbsoluteAuthProviderUrl(provider, mode, nextPath));
  return `${target.pathname}${target.search}`;
}

export function buildAbsoluteAuthProviderUrl(
  provider: AuthFlowProvider,
  mode: AuthFlowMode,
  nextPath: string | null,
  origin = SITE_ORIGIN,
): string {
  const basePath = provider === "x"
    ? mode === "signup" ? "/auth/x/signup" : "/auth/x/login"
    : mode === "signup" ? "/auth/signup" : "/auth/login";
  const target = new URL(basePath, origin);
  if (nextPath) target.searchParams.set("next", nextPath);
  return target.toString();
}

export function buildAuthModeSwitchHref(
  mode: AuthFlowMode,
  nextPath: string | null,
): string {
  return buildAuthPageHref(mode === "signup" ? "login" : "signup", nextPath);
}
