export type CrmDirectoryLikeUser = {
  name: string;
  login: string;
  avatarUrl: string;
  providers: string[];
};

export type CrmDataQualitySummary = {
  missingAvatarUsers: number;
  placeholderNameUsers: number;
  syntheticLoginUsers: number;
  providerCoveragePct: number;
  billingCoveragePct: number;
  mappedBillingUsers: number;
  untrackedUsers: number;
  orphanTrackedUsers: number;
};

function safePct(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function isPlaceholderName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === "x account" ||
    normalized === "x user" ||
    normalized === "user" ||
    normalized === "unknown user" ||
    normalized.startsWith("xacct_")
  );
}

function isSyntheticLogin(login: string): boolean {
  const normalized = login.trim().toLowerCase();
  return normalized.startsWith("xacct_") || normalized.includes("_fallback_");
}

export function summarizeCrmDataQuality(args: {
  users: CrmDirectoryLikeUser[];
  totalUsers: number;
  trackedUsers: number;
}): CrmDataQualitySummary {
  const totalUsers = Math.max(0, Math.floor(args.totalUsers));
  const trackedUsers = Math.max(0, Math.floor(args.trackedUsers));
  const untrackedUsers = Math.max(0, totalUsers - trackedUsers);
  const orphanTrackedUsers = Math.max(0, trackedUsers - totalUsers);
  const mappedBillingUsers = Math.max(0, trackedUsers - orphanTrackedUsers);

  const missingAvatarUsers = args.users.filter((entry) => entry.avatarUrl.trim().length === 0).length;
  const placeholderNameUsers = args.users.filter((entry) => isPlaceholderName(entry.name)).length;
  const syntheticLoginUsers = args.users.filter((entry) => isSyntheticLogin(entry.login)).length;
  const usersWithProvider = args.users.filter((entry) => entry.providers.length > 0).length;

  return {
    missingAvatarUsers,
    placeholderNameUsers,
    syntheticLoginUsers,
    providerCoveragePct: safePct(usersWithProvider, totalUsers),
    billingCoveragePct: safePct(mappedBillingUsers, totalUsers),
    mappedBillingUsers,
    untrackedUsers,
    orphanTrackedUsers,
  };
}
