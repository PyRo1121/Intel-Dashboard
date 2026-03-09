import { summarizeCrmDataQuality } from "./crm-quality.ts";

export type CrmDirectoryUser = {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  providers: string[];
  createdAtMs: number;
  updatedAtMs: number;
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
  backendSummary: Record<string, unknown>;
}) {
  const generatedAtMs =
    typeof args.backendSummary.generatedAtMs === "number" && Number.isFinite(args.backendSummary.generatedAtMs)
      ? args.backendSummary.generatedAtMs
      : Date.now();
  const billing = (args.backendSummary.billing ?? {}) as Record<string, unknown>;
  const trackedUsers = Math.max(0, Math.floor(typeof billing.trackedUsers === "number" ? billing.trackedUsers : 0));
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
