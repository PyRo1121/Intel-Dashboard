import { isOwnerRole, resolveEntitlementRole } from "@intel-dashboard/shared/entitlement.ts";

export type AuthUserLike = {
  login?: string;
  name?: string;
  avatar_url?: string;
  entitlement?: {
    role?: string;
    tier?: string;
  };
} | null | undefined;

export function resolveAuthUserRole(user: AuthUserLike): string {
  return resolveEntitlementRole(user?.entitlement?.role, user?.entitlement?.tier);
}

export function isAuthUserOwner(user: AuthUserLike): boolean {
  return isOwnerRole(resolveAuthUserRole(user));
}

export function resolveAuthUserDisplay(user: AuthUserLike | null | undefined): {
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
