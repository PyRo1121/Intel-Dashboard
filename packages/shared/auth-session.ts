export type AuthSessionEntitlementLimits = {
  intelMaxItems?: number | null;
  briefingsMaxItems?: number | null;
  airSeaMaxItems?: number | null;
  telegramTotalMessagesMax?: number | null;
  telegramChannelMessagesMax?: number | null;
};

export type AuthSessionEntitlement = {
  tier?: string;
  role?: string;
  entitled?: boolean;
  delayMinutes?: number;
  limits?: AuthSessionEntitlementLimits;
};

export type AuthSessionUser = {
  login: string;
  name: string;
  avatar_url: string;
  id: number | string;
  provider?: string | null;
};

export type AuthSessionAuthenticatedResponse = {
  authenticated: true;
  user: AuthSessionUser;
  entitlement?: AuthSessionEntitlement;
  x_profile_sync?: Record<string, unknown>;
};

export type AuthSessionUnauthenticatedResponse = {
  authenticated: false;
};

export type AuthSessionResponse =
  | AuthSessionAuthenticatedResponse
  | AuthSessionUnauthenticatedResponse;

export type AuthSessionAuthenticatedPayload = AuthSessionAuthenticatedResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAuthSessionUser(value: unknown): AuthSessionUser | null {
  if (!isRecord(value)) return null;
  const login = trimString(value.login);
  const name = trimString(value.name);
  const avatar_url = typeof value.avatar_url === "string" ? value.avatar_url : "";
  const id = value.id;
  if (!login || !name || (typeof id !== "string" && typeof id !== "number")) {
    return null;
  }
  return {
    login,
    name,
    avatar_url,
    id,
    provider: typeof value.provider === "string" ? value.provider : null,
  };
}

export function normalizeAuthSessionResponse(value: unknown): AuthSessionResponse | null {
  if (!isRecord(value)) return null;
  if (value.authenticated === false) {
    return { authenticated: false };
  }
  if (value.authenticated !== true) return null;
  const user = normalizeAuthSessionUser(value.user);
  if (!user) return null;
  const response: AuthSessionAuthenticatedResponse = {
    authenticated: true,
    user,
  };
  if (isRecord(value.entitlement)) {
    response.entitlement = value.entitlement as AuthSessionEntitlement;
  }
  if (isRecord(value.x_profile_sync)) {
    response.x_profile_sync = value.x_profile_sync;
  }
  return response;
}

export function normalizeAuthenticatedAuthSessionPayload(
  value: unknown,
): AuthSessionAuthenticatedPayload | null {
  const normalized = normalizeAuthSessionResponse(value);
  if (!normalized || normalized.authenticated !== true) {
    return null;
  }
  return normalized;
}
