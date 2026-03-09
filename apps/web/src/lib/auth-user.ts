import {
  isEntitledRole,
  isOwnerRole,
  resolveEntitlementRole,
  resolveEntitlementView,
  resolveFeedSurfaceLimit,
} from "@intel-dashboard/shared/entitlement.ts";

export type AuthUserLike = {
  login?: string;
  name?: string;
  avatar_url?: string;
  entitlement?: {
    role?: string;
    tier?: string;
    entitled?: boolean;
    delayMinutes?: number;
    limits?: {
      intelMaxItems?: number | null;
      briefingsMaxItems?: number | null;
      airSeaMaxItems?: number | null;
      telegramTotalMessagesMax?: number | null;
    };
  };
} | null | undefined;

export function resolveAuthUserRole(user: AuthUserLike): string {
  return resolveEntitlementRole(user?.entitlement?.role, user?.entitlement?.tier);
}

export function isAuthUserOwner(user: AuthUserLike): boolean {
  return isOwnerRole(resolveAuthUserRole(user));
}

export function isAuthUserSignalSubscriber(user: AuthUserLike): boolean {
  return isEntitledRole(resolveAuthUserRole(user));
}

export function resolveAuthUserEntitlementView(user: AuthUserLike) {
  return resolveEntitlementView(user?.entitlement);
}

export function resolveAuthUserFeedSurfaceLimit(user: AuthUserLike, surface: string): number | null | undefined {
  return resolveFeedSurfaceLimit(surface, user?.entitlement?.limits);
}

export function resolveAuthUserDisplay(user: AuthUserLike): {
  displayName: string;
  displayLogin: string;
  avatarUrl: string;
  avatarLetter: string;
} {
  const login = (user?.login || "").trim();
  const name = (user?.name || "").trim();
  const avatarUrl = (user?.avatar_url || "").trim();
  const displayName = name || login || "User";
  const displayLogin = !login ? "" : login.includes("@") ? login : `@${login}`;
  const avatarLetter = displayName.slice(0, 1).toUpperCase() || "U";
  return {
    displayName,
    displayLogin,
    avatarUrl,
    avatarLetter,
  };
}
