import { isOwnerRole, resolveEntitlementRole } from "@intel-dashboard/shared/entitlement.ts";

export type AuthUserLike = {
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

