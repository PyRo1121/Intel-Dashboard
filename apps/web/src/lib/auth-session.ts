import type { AuthUser } from "./auth.tsx";

export const AUTH_SESSION_TIMEOUT_MS = 10_000;

export type AuthSessionState =
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "unavailable"; reason: string };

type AuthMePayload = {
  authenticated?: unknown;
  user?: unknown;
  entitlement?: unknown;
};

type FetchLike = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeAuthSessionPayload(payload: unknown): AuthUser | null {
  if (!isRecord(payload)) return null;
  const data = payload as AuthMePayload;
  if (data.authenticated !== true || !isRecord(data.user)) return null;

  const user = data.user;
  const login = typeof user.login === "string" ? user.login.trim() : "";
  const name = typeof user.name === "string" ? user.name.trim() : "";
  const avatarUrl = typeof user.avatar_url === "string" ? user.avatar_url : "";
  const id = user.id;

  if (!login || !name || (typeof id !== "string" && typeof id !== "number")) {
    return null;
  }

  const provider = typeof user.provider === "string" ? user.provider : null;
  const entitlement = isRecord(data.entitlement)
    ? (data.entitlement as AuthUser["entitlement"])
    : undefined;

  return {
    login,
    name,
    avatar_url: avatarUrl,
    id,
    provider,
    entitlement,
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
