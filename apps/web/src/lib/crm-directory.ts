import { formatSubscriptionStatus } from "@intel-dashboard/shared/entitlement.ts";

export type CrmBillingAccountLike = {
  userId?: string;
  status?: string;
  monthlyPriceUsd?: number;
};

export type CrmDirectoryUserLike = {
  id: string;
  login: string;
  name: string;
  email: string;
  providers?: string[];
  createdAtMs?: number;
  updatedAtMs?: number;
};

export function buildCrmAccountStatusMap(
  accounts: Array<CrmBillingAccountLike> | null | undefined,
): Map<string, { status?: string; monthlyPriceUsd?: number }> {
  const map = new Map<string, { status?: string; monthlyPriceUsd?: number }>();
  for (const account of accounts ?? []) {
    if (typeof account.userId === "string" && account.userId.trim().length > 0) {
      map.set(account.userId, {
        status: account.status,
        monthlyPriceUsd: account.monthlyPriceUsd,
      });
    }
  }
  return map;
}

export function findCrmDirectoryUserById<TUser extends CrmDirectoryUserLike>(
  users: Array<TUser> | null | undefined,
  id: string | null | undefined,
): TUser | null {
  if (!id) return null;
  return users?.find((entry) => entry.id === id) ?? null;
}

export function filterCrmDirectoryUsers<TUser extends CrmDirectoryUserLike>(
  users: Array<TUser> | null | undefined,
  args: {
    query: string;
    status: string;
    accounts: Map<string, { status?: string }>;
  },
): TUser[] {
  const query = args.query.trim().toLowerCase();
  const status = args.status.trim().toLowerCase();
  return (users ?? []).filter((entry) => {
    const billingStatus = (args.accounts.get(entry.id)?.status || "none").trim().toLowerCase();
    const matchesStatus = status === "all" ? true : billingStatus === status;
    if (!matchesStatus) return false;
    if (!query) return true;
    const haystack = `${entry.name} ${entry.login} ${entry.email} ${(entry.providers ?? []).join(" ")}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function formatCrmProviders(
  providers: string[] | null | undefined,
  separator = ", ",
  emptyValue = "—",
): string {
  const values = (providers ?? [])
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  if (values.length === 0) {
    return emptyValue;
  }
  return values.join(separator);
}

export function formatCrmAccountStatus(status: string | null | undefined): string {
  return formatSubscriptionStatus(status ?? undefined);
}

export function getCrmUserDisplayName(
  user: Pick<CrmDirectoryUserLike, "name" | "login" | "email"> | null | undefined,
): string {
  return user?.name || user?.login || user?.email || "Unknown user";
}

export function getCrmUserSecondaryLabel(
  user: Pick<CrmDirectoryUserLike, "login" | "email"> | null | undefined,
): string {
  return user?.login || user?.email || "—";
}
