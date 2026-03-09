export type CrmSummaryDegradedState = {
  partial?: boolean;
  stale?: boolean;
  accountsTruncated?: boolean;
  activityTruncated?: boolean;
  reasons?: string[];
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
