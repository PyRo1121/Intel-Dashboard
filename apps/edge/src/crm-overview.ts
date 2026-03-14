import type { CrmOverviewPayload, CrmOverviewResult, CrmUser } from "@intel-dashboard/shared/crm.ts";
import { summarizeCrmDataQuality } from "./crm-quality.ts";
export type CrmDirectoryUser = CrmUser & {
  avatarUrl: string;
  providers: string[];
};

export type CrmDirectorySnapshot = {
  totalUsers: number;
  activeSessions: number;
  newUsers24h: number;
  newUsers7d: number;
  users: CrmDirectoryUser[];
};

export function buildOwnerCrmOverviewPayload(args: {
  directory: CrmDirectorySnapshot;
  backendSummary: CrmOverviewResult;
}): CrmOverviewPayload {
  const generatedAtMs =
    typeof args.backendSummary.generatedAtMs === "number" && Number.isFinite(args.backendSummary.generatedAtMs)
      ? args.backendSummary.generatedAtMs
      : Date.now();
  const trackedUsers = Math.max(0, Math.floor(args.backendSummary.billing?.trackedUsers ?? 0));
  const qualitySummary = summarizeCrmDataQuality({
    users: args.directory.users,
    totalUsers: args.directory.totalUsers,
    trackedUsers,
  });

  return {
    ok: true,
    result: {
      ...args.backendSummary,
      generatedAtMs,
      directory: {
        ...args.directory,
        untrackedUsers: qualitySummary.untrackedUsers,
        orphanTrackedUsers: qualitySummary.orphanTrackedUsers,
      },
      dataQuality: qualitySummary,
    },
  };
}
