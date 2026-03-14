function normalizeEntitlementValue(value: string | undefined, fallback: string): string {
  return (value || fallback).trim().toLowerCase();
}

export function formatEntitlementTier(value: string | undefined): string {
  const raw = normalizeEntitlementValue(value, "free");
  if (raw === "owner") return "Owner";
  if (raw === "subscriber") return "Subscriber";
  if (raw === "trial") return "Trial";
  return "Free";
}

export function resolveEntitlementRole(role: string | undefined, tier: string | undefined): string {
  return normalizeEntitlementValue(role || tier, "free");
}

export type EntitlementViewInput = {
  role?: string;
  tier?: string;
  entitled?: boolean;
  delayMinutes?: number;
};

export type EntitlementLimitsInput = {
  intelMaxItems?: number | null;
  briefingsMaxItems?: number | null;
  airSeaMaxItems?: number | null;
  telegramTotalMessagesMax?: number | null;
};

const INTEL_FEED_SURFACES = new Set([
  "intel",
  "overview",
  "osint",
  "map",
  "my-feed",
  "my-alerts",
]);

export function resolveEntitlementView(entitlement: EntitlementViewInput | null | undefined): {
  role: string;
  entitled: boolean;
  delayMinutes: number;
  planLabel: string;
  planTone: string;
} {
  const role = resolveEntitlementRole(entitlement?.role, entitlement?.tier);
  const entitled = entitlement?.entitled === true || isEntitledRole(role);
  const rawDelay = entitlement?.delayMinutes;
  const delayMinutes =
    typeof rawDelay === "number" && Number.isFinite(rawDelay) ? Math.max(0, Math.floor(rawDelay)) : 0;
  return {
    role,
    entitled,
    delayMinutes,
    planLabel: formatEntitlementTier(entitlement?.role || entitlement?.tier),
    planTone: entitlementTierTone(entitlement?.role || entitlement?.tier),
  };
}

export function formatEntitlementLimit(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unlimited";
  const numeric = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return String(numeric);
}

export function resolveFeedSurfaceLimit(
  surface: string,
  limits: EntitlementLimitsInput | null | undefined,
): number | null | undefined {
  const scope = normalizeEntitlementValue(surface, "");
  if (scope === "telegram") return limits?.telegramTotalMessagesMax;
  if (scope === "briefings") return limits?.briefingsMaxItems;
  if (scope === "air-sea") return limits?.airSeaMaxItems;
  if (INTEL_FEED_SURFACES.has(scope)) return limits?.intelMaxItems;
  return limits?.intelMaxItems;
}

export function isEntitledRole(value: string | undefined): boolean {
  const raw = normalizeEntitlementValue(value, "");
  return raw === "owner" || raw === "subscriber";
}

export function isOwnerRole(value: string | undefined): boolean {
  return normalizeEntitlementValue(value, "") === "owner";
}

export function entitlementTierTone(value: string | undefined): string {
  const raw = normalizeEntitlementValue(value, "free");
  if (raw === "owner") return "text-emerald-300";
  if (raw === "subscriber") return "text-sky-300";
  if (raw === "trial") return "text-amber-300";
  return "text-zinc-500";
}

export function formatSubscriptionStatus(value: string | undefined): string {
  const raw = normalizeEntitlementValue(value, "none");
  if (raw === "trialing") return "Trialing";
  if (raw === "active") return "Active";
  if (raw === "owner") return "Owner lifetime";
  if (raw === "canceled") return "Canceled";
  if (raw === "expired") return "Expired";
  return "None";
}
