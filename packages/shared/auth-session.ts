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

function normalizeOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const trimmed = trimString(value);
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalNullableNumber(value: unknown): number | null | undefined {
  if (value === null) {
    return null;
  }
  return normalizeOptionalNumber(value);
}

function normalizeOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeAuthSessionEntitlementLimits(value: unknown): AuthSessionEntitlementLimits | undefined {
  if (!isRecord(value)) return undefined;
  const limits: AuthSessionEntitlementLimits = {};
  const intelMaxItems = normalizeOptionalNullableNumber(value.intelMaxItems);
  const briefingsMaxItems = normalizeOptionalNullableNumber(value.briefingsMaxItems);
  const airSeaMaxItems = normalizeOptionalNullableNumber(value.airSeaMaxItems);
  const telegramTotalMessagesMax = normalizeOptionalNullableNumber(value.telegramTotalMessagesMax);
  const telegramChannelMessagesMax = normalizeOptionalNullableNumber(value.telegramChannelMessagesMax);

  if (intelMaxItems !== undefined) limits.intelMaxItems = intelMaxItems;
  if (briefingsMaxItems !== undefined) limits.briefingsMaxItems = briefingsMaxItems;
  if (airSeaMaxItems !== undefined) limits.airSeaMaxItems = airSeaMaxItems;
  if (telegramTotalMessagesMax !== undefined) limits.telegramTotalMessagesMax = telegramTotalMessagesMax;
  if (telegramChannelMessagesMax !== undefined) limits.telegramChannelMessagesMax = telegramChannelMessagesMax;

  return Object.keys(limits).length > 0 ? limits : undefined;
}

function normalizeAuthSessionEntitlement(value: unknown): AuthSessionEntitlement | undefined {
  if (!isRecord(value)) return undefined;
  const entitlement: AuthSessionEntitlement = {};
  const tier = trimString(value.tier);
  const role = trimString(value.role);
  const entitled = normalizeOptionalBoolean(value.entitled);
  const delayMinutes = normalizeOptionalNumber(value.delayMinutes);
  const limits = normalizeAuthSessionEntitlementLimits(value.limits);

  if (tier) entitlement.tier = tier;
  if (role) entitlement.role = role;
  if (entitled !== undefined) entitlement.entitled = entitled;
  if (delayMinutes !== undefined) entitlement.delayMinutes = delayMinutes;
  if (limits) entitlement.limits = limits;

  return Object.keys(entitlement).length > 0 ? entitlement : undefined;
}

export function normalizeAuthSessionUser(value: unknown): AuthSessionUser | null {
  if (!isRecord(value)) return null;
  const login = trimString(value.login);
  const name = trimString(value.name);
  const avatar_url = typeof value.avatar_url === "string" ? value.avatar_url : "";
  const id = value.id;
  const normalizedId = typeof id === "string"
    ? id.trim()
    : typeof id === "number" && Number.isSafeInteger(id)
      ? id
      : null;
  if (!login || !name || normalizedId === null || normalizedId === "") {
    return null;
  }
  return {
    login,
    name,
    avatar_url,
    id: normalizedId,
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
  const entitlement = normalizeAuthSessionEntitlement(value.entitlement);
  if (entitlement) {
    response.entitlement = entitlement;
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
