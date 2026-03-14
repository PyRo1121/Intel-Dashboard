export type CrmApiErrorPayload = {
  ok: false;
  error: string;
};

export type CrmUser = {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl?: string;
  providers?: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

export type CrmDegradedState = {
  partial?: boolean;
  stale?: boolean;
  accountsTruncated?: boolean;
  activityTruncated?: boolean;
  reasons?: string[];
};

export type CrmBillingAccountSummary = {
  userId?: string;
  status?: string;
  monthlyPriceUsd?: number;
  updatedAtMs?: number;
};

export type CrmStripeSummary = {
  live?: boolean;
  source?: string;
  syncedAtMs?: number;
  error?: string;
  subscriptionsTotal?: number;
  customersTotal?: number;
  statuses?: {
    active?: number;
    trialing?: number;
    pastDue?: number;
    unpaid?: number;
    canceled?: number;
  };
};

export type CrmOverviewResult = {
  generatedAtMs?: number;
  degraded?: CrmDegradedState;
  directory?: {
    totalUsers?: number;
    activeSessions?: number;
    newUsers24h?: number;
    newUsers7d?: number;
    untrackedUsers?: number;
    orphanTrackedUsers?: number;
    users?: CrmUser[];
  };
  billing?: {
    trackedUsers?: number;
    statuses?: {
      active?: number;
      trialing?: number;
      canceled?: number;
      expired?: number;
      none?: number;
    };
    mrrActiveUsd?: number;
    arrActiveUsd?: number;
    accounts?: CrmBillingAccountSummary[];
    stripe?: CrmStripeSummary;
  };
  telemetry?: {
    events24h?: number;
    events7d?: number;
    uniqueUsers24h?: number;
    uniqueUsers7d?: number;
    trialStarts7d?: number;
    paidStarts7d?: number;
    cancellations7d?: number;
    cancellations30d?: number;
    topKinds7d?: Array<{ kind?: string; count?: number }>;
  };
  commandCenter?: {
    revenue?: {
      mrrActiveUsd?: number;
      arrActiveUsd?: number;
      arpuActiveUsd?: number;
      mrrBillableUsd?: number;
      arrBillableUsd?: number;
      source?: string;
    };
    funnel?: {
      trialStarts7d?: number;
      paidStarts7d?: number;
      trialToPaidRate7dPct?: number;
      subscriberPenetrationPct?: number;
      trialingSharePct?: number;
    };
    risk?: {
      cancellations7d?: number;
      cancellations30d?: number;
      churnRate30dPct?: number;
      netSubscriberDelta7d?: number;
    };
    activity?: {
      events24h?: number;
      events7d?: number;
      uniqueUsers24h?: number;
      uniqueUsers7d?: number;
    };
  };
  dataQuality?: {
    missingAvatarUsers?: number;
    placeholderNameUsers?: number;
    syntheticLoginUsers?: number;
    providerCoveragePct?: number;
    billingCoveragePct?: number;
    mappedBillingUsers?: number;
    untrackedUsers?: number;
    orphanTrackedUsers?: number;
  };
  latestEvents?: Array<{
    id?: string;
    userId?: string;
    kind?: string;
    source?: string;
    status?: string;
    note?: string;
    atMs?: number;
  }>;
};

export type CrmOverviewPayload = CrmApiErrorPayload | {
  ok: true;
  result: CrmOverviewResult;
};

export type CrmCustomerOpsResult = {
  targetUserId?: string;
  account?: {
    status?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    monthlyPriceUsd?: number;
  };
  stripe?: {
    customer?: {
      id?: string;
      email?: string | null;
      name?: string | null;
      currency?: string;
      delinquent?: boolean;
      createdAtMs?: number | null;
      balanceUsd?: number;
    };
    subscription?: {
      id?: string | null;
      status?: string | null;
      cancelAtPeriodEnd?: boolean;
      cancelAtMs?: number | null;
      currentPeriodEndMs?: number | null;
      canceledAtMs?: number | null;
    } | null;
    invoices?: Array<{
      id?: string;
      status?: string;
      amountDueUsd?: number;
      amountPaidUsd?: number;
      paid?: boolean;
      createdAtMs?: number;
      hostedInvoiceUrl?: string | null;
    }>;
    charges?: Array<{
      id?: string;
      status?: string;
      amountUsd?: number;
      refundedUsd?: number;
      paid?: boolean;
      refunded?: boolean;
      createdAtMs?: number;
      receiptUrl?: string | null;
      paymentIntentId?: string | null;
    }>;
  };
  cache?: {
    source?: string;
    stale?: boolean;
    fetchedAtMs?: number;
  };
  refundId?: string;
};

export type CrmCustomerOpsPayload = CrmApiErrorPayload | {
  ok: true;
  result: CrmCustomerOpsResult;
};

export type CrmAiTelemetryResult = {
  generatedAtMs?: number;
  window?: string;
  summary?: {
    calls?: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    outputInputRatio?: number;
    avgDurationMs?: number;
    p95DurationMs?: number;
    failures?: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
  lanes?: Array<{
    label?: string;
    calls?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    outputInputRatio?: number;
    avgDurationMs?: number;
    p95DurationMs?: number;
    failures?: number;
    cacheHits?: number;
    cacheMisses?: number;
  }>;
  models?: Array<{
    label?: string;
    calls?: number;
    totalTokens?: number;
    promptTokens?: number;
    completionTokens?: number;
    outputInputRatio?: number;
    avgDurationMs?: number;
    p95DurationMs?: number;
    failures?: number;
    cacheHits?: number;
    cacheMisses?: number;
  }>;
  outcomes?: Array<{
    label?: string;
    calls?: number;
  }>;
  cacheStatuses?: Array<{
    label?: string;
    calls?: number;
  }>;
  series?: Array<{
    bucket?: string;
    calls?: number;
    totalTokens?: number;
    completionTokens?: number;
  }>;
};

export type CrmAiTelemetryPayload = CrmApiErrorPayload | {
  ok: true;
  result: CrmAiTelemetryResult;
};
