import { formatDateTime, formatWholeNumber } from "./utils.ts";

export type CrmSummaryDegradedState = {
  partial?: boolean;
  stale?: boolean;
  accountsTruncated?: boolean;
  activityTruncated?: boolean;
  reasons?: string[];
} | null | undefined;

export type CrmDataQualityState = {
  missingAvatarUsers?: number;
  placeholderNameUsers?: number;
  syntheticLoginUsers?: number;
  orphanTrackedUsers?: number;
  providerCoveragePct?: number;
  billingCoveragePct?: number;
} | null | undefined;

export type CrmSummaryResultLike = {
  generatedAtMs?: number;
  billing?: {
    mrrActiveUsd?: number;
    arrActiveUsd?: number;
    statuses?: {
      active?: number;
    };
    stripe?: {
      statuses?: {
        active?: number;
      };
      syncedAtMs?: number;
      source?: string | null;
      live?: boolean;
      error?: string;
    };
  };
  telemetry?: {
    uniqueUsers24h?: number;
    cancellations7d?: number;
  };
  commandCenter?: {
    revenue?: {
      source?: string | null;
      mrrActiveUsd?: number;
      arrActiveUsd?: number;
      arpuActiveUsd?: number;
    };
    funnel?: {
      trialToPaidRate7dPct?: number;
      subscriberPenetrationPct?: number;
      trialingSharePct?: number;
    };
    risk?: {
      churnRate30dPct?: number;
      netSubscriberDelta7d?: number;
      cancellations7d?: number;
    };
    activity?: {
      uniqueUsers24h?: number;
    };
  };
  directory?: {
    totalUsers?: number;
    newUsers24h?: number;
    newUsers7d?: number;
    orphanTrackedUsers?: number;
  };
  dataQuality?: CrmDataQualityState;
  degraded?: CrmSummaryDegradedState;
} | null | undefined;

export function getCrmSummaryWarningTone(state: CrmSummaryDegradedState): string {
  if (state?.partial) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  if (state?.stale) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

export function getCrmSummaryWarningMessage(state: CrmSummaryDegradedState): string | null {
  if (state?.partial) {
    return "CRM summary is partial. Some aggregates were truncated, so totals may under-report current state.";
  }
  if (state?.stale) {
    return "CRM summary is stale. Metrics are served from maintained cache and may lag the current time window.";
  }
  return null;
}

export function getCrmSummaryStatusLabel(state: CrmSummaryDegradedState): string | null {
  if (state?.partial) {
    return "partial snapshot";
  }
  if (state?.stale) {
    return "stale cache";
  }
  return null;
}

export function getCrmSummaryStatusTone(state: CrmSummaryDegradedState): string | null {
  if (state?.partial) {
    return "text-rose-300";
  }
  if (state?.stale) {
    return "text-amber-300";
  }
  return null;
}

export function getCrmRevenueSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "stripe_live":
      return "Stripe Live";
    case "stripe_cache":
      return "Stripe Cache";
    case "stripe_cache_stale":
      return "Stripe Cache (Stale)";
    default:
      return "Internal Snapshot";
  }
}

function normalizeCoveragePct(value: number | undefined, fallback = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

export function getCrmQualityBadgeTone(state: CrmDataQualityState): string {
  const issues =
    (state?.missingAvatarUsers ?? 0) +
    (state?.placeholderNameUsers ?? 0) +
    (state?.syntheticLoginUsers ?? 0) +
    (state?.orphanTrackedUsers ?? 0);
  const providerCoverage = normalizeCoveragePct(state?.providerCoveragePct, 100);
  const billingCoverage = normalizeCoveragePct(state?.billingCoveragePct, 100);
  const degradedCoverage = providerCoverage < 90 || billingCoverage < 90;
  const severeIssues = issues >= 10 || providerCoverage < 75 || billingCoverage < 75;
  if (severeIssues) {
    return "text-rose-300 border-rose-500/40 bg-rose-500/10";
  }
  return issues > 0
    ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
    : degradedCoverage
    ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
    : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
}

export function getCrmSubscriberCount(result: CrmSummaryResultLike): number | undefined {
  return result?.billing?.stripe?.statuses?.active ?? result?.billing?.statuses?.active;
}

export function getCrmMrrActiveUsd(result: CrmSummaryResultLike): number | undefined {
  return result?.commandCenter?.revenue?.mrrActiveUsd ?? result?.billing?.mrrActiveUsd;
}

export function getCrmArrActiveUsd(result: CrmSummaryResultLike): number | undefined {
  return result?.commandCenter?.revenue?.arrActiveUsd ?? result?.billing?.arrActiveUsd;
}

export function getCrmUniqueUsers24h(result: CrmSummaryResultLike): number | undefined {
  return result?.commandCenter?.activity?.uniqueUsers24h ?? result?.telemetry?.uniqueUsers24h;
}

export function getCrmCancellations7d(result: CrmSummaryResultLike): number | undefined {
  return result?.commandCenter?.risk?.cancellations7d ?? result?.telemetry?.cancellations7d;
}

export function getCrmStripeSyncedAtMs(result: CrmSummaryResultLike): number | undefined {
  const value = result?.billing?.stripe?.syncedAtMs;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getCrmGeneratedAtMs(result: { generatedAtMs?: number } | null | undefined): number | undefined {
  const value = result?.generatedAtMs;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getCrmCustomer360SummaryText(result: CrmSummaryResultLike): string {
  return `Updated ${formatDateTime(getCrmGeneratedAtMs(result))} • New users 24h: ${formatWholeNumber(result?.directory?.newUsers24h)} • New users 7d: ${formatWholeNumber(result?.directory?.newUsers7d)} • Legacy billing-only identities: ${formatWholeNumber(result?.directory?.orphanTrackedUsers)}`;
}

export function getCrmDataQualityRows(state: CrmDataQualityState): Array<{ label: string; value: string }> {
  return [
    { label: "Missing avatars", value: formatWholeNumber(state?.missingAvatarUsers) },
    { label: "Placeholder names", value: formatWholeNumber(state?.placeholderNameUsers) },
    { label: "Synthetic logins", value: formatWholeNumber(state?.syntheticLoginUsers) },
    { label: "Provider coverage", value: `${normalizeCoveragePct(state?.providerCoveragePct, 100).toFixed(1)}%` },
    { label: "Billing identity coverage", value: `${normalizeCoveragePct(state?.billingCoveragePct, 100).toFixed(1)}%` },
  ];
}
