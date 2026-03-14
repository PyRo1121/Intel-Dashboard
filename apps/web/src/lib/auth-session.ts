import {
  normalizeAuthenticatedAuthSessionPayload,
  type AuthSessionAuthenticatedPayload,
} from "@intel-dashboard/shared/auth-session.ts";
import type { AuthUser } from "./auth.tsx";

export const AUTH_SESSION_TIMEOUT_MS = 10_000;

export type AuthSessionState =
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "unavailable"; reason: string };

type FetchLike = typeof fetch;

export function normalizeAuthSessionPayload(payload: unknown): AuthUser | null {
  const normalized = normalizeAuthenticatedAuthSessionPayload(payload);
  if (!normalized) return null;
  const data: AuthSessionAuthenticatedPayload = normalized;
  return {
    login: data.user.login,
    name: data.user.name,
    avatar_url: data.user.avatar_url,
    id: data.user.id,
    provider: data.user.provider,
    entitlement: data.entitlement as AuthUser["entitlement"] | undefined,
  };
}

export function buildAuthSessionRequestInit(
  signal?: AbortSignal,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
): RequestInit {
  const timeoutSignal = AbortSignal.timeout(Math.max(1, timeoutMs));
  return {
    credentials: "include",
    cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  };
}

export async function fetchAuthSession(
  fetchImpl: FetchLike,
  signal?: AbortSignal,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
): Promise<AuthUser | null> {
  const result = await fetchAuthSessionState(fetchImpl, signal, timeoutMs);
  return result.status === "authenticated" ? result.user : null;
}

export async function fetchAuthSessionState(
  fetchImpl: FetchLike,
  signal?: AbortSignal,
  timeoutMs = AUTH_SESSION_TIMEOUT_MS,
): Promise<AuthSessionState> {
  let res: Response;
  try {
    res = await fetchImpl("/api/auth/me", buildAuthSessionRequestInit(signal, timeoutMs));
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : "network";
    return { status: "unavailable", reason };
  }

  if (res.status === 401 || res.status === 403) {
    return { status: "unauthenticated" };
  }
  if (!res.ok) return { status: "unavailable", reason: `http_${res.status}` };

  const data = await res.json().catch(() => null);
  const user = normalizeAuthSessionPayload(data);
  if (!user) {
    return { status: "unavailable", reason: "invalid_payload" };
  }
  return { status: "authenticated", user };
}
