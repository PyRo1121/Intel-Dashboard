import { Meta, Title } from "@solidjs/meta";
import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { useAuth } from "~/lib/auth";
import { fetchClientJson } from "~/lib/client-json";
import { getCrmCustomerCacheSourceLabel } from "~/lib/crm-customer-cache";
import { formatEventLabel } from "~/lib/event-label";
import { formatSubscriptionStatus, isOwnerRole, resolveEntitlementRole } from "@intel-dashboard/shared/entitlement.ts";
import {
  getCrmRevenueSourceLabel,
  getCrmSummaryStatusLabel,
  getCrmSummaryWarningMessage,
  getCrmSummaryWarningTone,
} from "~/lib/crm-summary";
import {
  formatDateTime as formatTime,
  formatPercent,
  formatUsd,
  formatWholeNumber as formatNumber,
} from "~/lib/utils";
import { CRM_DESCRIPTION, CRM_TITLE } from "@intel-dashboard/shared/route-meta.ts";

type CrmUser = {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl?: string;
  providers?: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

type CrmPayload = {
  ok?: boolean;
  error?: string;
  result?: {
    generatedAtMs?: number;
    degraded?: {
      partial?: boolean;
      stale?: boolean;
      accountsTruncated?: boolean;
      activityTruncated?: boolean;
      reasons?: string[];
    };
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
      accounts?: Array<{
        userId?: string;
        status?: string;
        monthlyPriceUsd?: number;
        updatedAtMs?: number;
      }>;
      stripe?: {
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
};

type CrmCustomerOpsPayload = {
  ok?: boolean;
  error?: string;
  result?: {
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
  };
};

type AiTelemetryPayload = {
  ok?: boolean;
  error?: string;
  result?: {
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
};

async function fetchCrmOverview(): Promise<CrmPayload> {
  const result = await fetchClientJson<CrmPayload>("/api/admin/crm/overview", {
    method: "GET",
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }
  return result.data;
}

async function postCrmAction(path: string, payload: Record<string, unknown>): Promise<CrmCustomerOpsPayload> {
  const result = await fetchClientJson<CrmCustomerOpsPayload>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }
  return result.data;
}

async function fetchAiTelemetry(window: string): Promise<AiTelemetryPayload> {
  const result = await fetchClientJson<AiTelemetryPayload>(`/api/admin/crm/ai-telemetry?window=${encodeURIComponent(window)}`, {
    method: "GET",
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    };
  }
  return result.data;
}

function computeHitRatePercent(input: { cacheHits?: number; cacheMisses?: number } | null | undefined): number {
  const hits = Math.max(0, input?.cacheHits ?? 0);
  const misses = Math.max(0, input?.cacheMisses ?? 0);
  const total = hits + misses;
  if (total <= 0) return 0;
  return (hits / total) * 100;
}

export default function CrmRoute() {
  const auth = useAuth();
  const role = () => resolveEntitlementRole(auth.user()?.entitlement?.role, auth.user()?.entitlement?.tier);
  const isOwner = () => isOwnerRole(role());
  const [crm, { refetch }] = createResource(fetchCrmOverview);
  const [aiWindow, setAiWindow] = createSignal<"15m" | "1h" | "24h" | "7d" | "30d">("1h");
  const aiTelemetrySource = createMemo(() => (isOwner() ? aiWindow() : undefined));
  const [aiTelemetry, { refetch: refetchAiTelemetry }] = createResource(aiTelemetrySource, fetchAiTelemetry);
  const [searchTerm, setSearchTerm] = createSignal("");
  const [statusFilter, setStatusFilter] = createSignal<"all" | "active" | "trialing" | "canceled" | "expired" | "none">("all");
  const [selectedUserId, setSelectedUserId] = createSignal("");
  const [selectedCustomerOps, setSelectedCustomerOps] = createSignal<CrmCustomerOpsPayload | null>(null);
  const [opsBusy, setOpsBusy] = createSignal(false);
  const [opsError, setOpsError] = createSignal("");
  const [opsNotice, setOpsNotice] = createSignal("");
  const [refundAmountUsd, setRefundAmountUsd] = createSignal("");
  const [refundReason, setRefundReason] = createSignal<"requested_by_customer" | "duplicate" | "fraudulent">("requested_by_customer");

  const accountStatusMap = () => {
    const map = new Map<string, { status?: string; monthlyPriceUsd?: number }>();
    for (const account of crm()?.result?.billing?.accounts ?? []) {
      if (typeof account.userId === "string" && account.userId.trim().length > 0) {
        map.set(account.userId, {
          status: account.status,
          monthlyPriceUsd: account.monthlyPriceUsd,
        });
      }
    }
    return map;
  };

  const selectedUser = createMemo(() => {
    const id = selectedUserId();
    if (!id) return null;
    return (crm()?.result?.directory?.users ?? []).find((entry) => entry.id === id) ?? null;
  });

  const loadCustomerOps = async (targetUserId: string, refresh = false) => {
    if (!targetUserId) return;
    setSelectedUserId(targetUserId);
    setOpsError("");
    setOpsNotice("");
    setOpsBusy(true);
    const payload = await postCrmAction("/api/admin/crm/customer", { targetUserId, ...(refresh ? { refresh: true } : {}) });
    if (payload.ok === false) {
      setOpsError(payload.error || "Unable to load Stripe customer details.");
      setSelectedCustomerOps(null);
      setOpsBusy(false);
      return;
    }
    setSelectedCustomerOps(payload);
    setOpsBusy(false);
  };

  const runCancelSubscription = async (atPeriodEnd: boolean) => {
    const targetUserId = selectedUserId();
    if (!targetUserId) {
      setOpsError("Select a customer first.");
      return;
    }
    setOpsBusy(true);
    setOpsError("");
    setOpsNotice("");
    const payload = await postCrmAction("/api/admin/crm/cancel-subscription", {
      targetUserId,
      atPeriodEnd,
    });
    if (payload.ok === false) {
      setOpsError(payload.error || "Subscription cancel failed.");
      setOpsBusy(false);
      return;
    }
    setOpsNotice(atPeriodEnd ? "Cancellation scheduled at period end." : "Subscription canceled immediately.");
    await refetch();
    await loadCustomerOps(targetUserId);
    setOpsBusy(false);
  };

  const runRefund = async (chargeId?: string) => {
    const targetUserId = selectedUserId();
    if (!targetUserId) {
      setOpsError("Select a customer first.");
      return;
    }
    const amountValue = refundAmountUsd().trim();
    const hasAmount = amountValue.length > 0;
    const parsedAmount = hasAmount ? Number(amountValue) : Number.NaN;
    if (hasAmount && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      setOpsError("Refund amount must be a positive number.");
      return;
    }
    setOpsBusy(true);
    setOpsError("");
    setOpsNotice("");
    const payload = await postCrmAction("/api/admin/crm/refund", {
      targetUserId,
      ...(chargeId ? { chargeId } : {}),
      ...(hasAmount ? { amountUsd: parsedAmount } : {}),
      reason: refundReason(),
    });
    if (payload.ok === false) {
      setOpsError(payload.error || "Refund failed.");
      setOpsBusy(false);
      return;
    }
    const refundId = (payload.result as { refundId?: string } | undefined)?.refundId;
    setOpsNotice(refundId ? `Refund created: ${refundId}` : "Refund created.");
    setRefundAmountUsd("");
    await refetch();
    await loadCustomerOps(targetUserId);
    setOpsBusy(false);
  };

  const latestEventMap = () => {
    const map = new Map<string, { atMs?: number; kind?: string }>();
    for (const event of crm()?.result?.latestEvents ?? []) {
      if (typeof event.userId === "string" && event.userId.trim().length > 0 && !map.has(event.userId)) {
        map.set(event.userId, { atMs: event.atMs, kind: event.kind });
      }
    }
    return map;
  };

  const filteredUsers = createMemo(() => {
    const query = searchTerm().trim().toLowerCase();
    const status = statusFilter();
    const accounts = accountStatusMap();
    return (crm()?.result?.directory?.users ?? []).filter((entry) => {
      const billingStatus = (accounts.get(entry.id)?.status || "none").trim().toLowerCase();
      const matchesStatus = status === "all" ? true : billingStatus === status;
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = `${entry.name} ${entry.login} ${entry.email} ${(entry.providers ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  const exportCustomerCsv = () => {
    const rows = filteredUsers();
    const accounts = accountStatusMap();
    const latestEvents = latestEventMap();
    const header = [
      "user_id",
      "name",
      "login",
      "email",
      "providers",
      "plan_status",
      "monthly_price_usd",
      "last_event_kind",
      "last_event_at",
      "created_at",
      "updated_at",
    ];
    const escapeCell = (value: unknown): string => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
        return `"${text.replaceAll("\"", "\"\"")}"`;
      }
      return text;
    };
    const lines = [header.join(",")];
    for (const entry of rows) {
      const billing = accounts.get(entry.id);
      const latestEvent = latestEvents.get(entry.id);
      lines.push([
        entry.id,
        entry.name,
        entry.login,
        entry.email,
        (entry.providers ?? []).join("|"),
        formatSubscriptionStatus(billing?.status),
        String(billing?.monthlyPriceUsd ?? 0),
        formatEventLabel(latestEvent?.kind),
        formatTime(latestEvent?.atMs),
        formatTime(entry.createdAtMs),
        formatTime(entry.updatedAtMs),
      ].map(escapeCell).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `intel-dashboard-crm-customers-${Date.now()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const qualityBadgeTone = () => {
    const quality = crm()?.result?.dataQuality;
    const issues =
      (quality?.missingAvatarUsers ?? 0) +
      (quality?.placeholderNameUsers ?? 0) +
      (quality?.syntheticLoginUsers ?? 0) +
      (quality?.orphanTrackedUsers ?? 0);
    return issues > 0 ? "text-amber-300 border-amber-500/40 bg-amber-500/10" : "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  };

  const aiLaneMaxTokens = createMemo(() =>
    Math.max(...((aiTelemetry()?.result?.lanes ?? []).map((entry) => entry.totalTokens ?? 0)), 1),
  );
  const aiSeriesMaxCalls = createMemo(() =>
    Math.max(...((aiTelemetry()?.result?.series ?? []).map((entry) => entry.calls ?? 0)), 1),
  );
  const aiCacheHitPct = createMemo(() => computeHitRatePercent(aiTelemetry()?.result?.summary));
  const aiWorstFailureLane = createMemo(() =>
    [...(aiTelemetry()?.result?.lanes ?? [])].sort((left, right) => (right.failures ?? 0) - (left.failures ?? 0))[0] ?? null,
  );
  const aiSlowestLane = createMemo(() =>
    [...(aiTelemetry()?.result?.lanes ?? [])].sort((left, right) => (right.p95DurationMs ?? 0) - (left.p95DurationMs ?? 0))[0] ?? null,
  );
  const aiHungriestLane = createMemo(() =>
    [...(aiTelemetry()?.result?.lanes ?? [])].sort((left, right) => (right.outputInputRatio ?? 0) - (left.outputInputRatio ?? 0))[0] ?? null,
  );
  const crmDegraded = createMemo(() => crm()?.result?.degraded);
  const crmDegradedTone = createMemo(() => getCrmSummaryWarningTone(crmDegraded()));
  const crmDegradedMessage = createMemo(() => getCrmSummaryWarningMessage(crmDegraded()));

  return (
    <>
      <Title>{CRM_TITLE}</Title>
      <Meta name="description" content={CRM_DESCRIPTION} />

      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <p class="intel-badge mb-2">Owner Console</p>
            <h1 class="intel-heading">Revenue Command Center</h1>
            <p class="intel-subheading">
              Customer 360, subscription health, and telemetry quality in one operator surface.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${qualityBadgeTone()}`}>
              Data Quality
            </span>
            <button
              type="button"
              onClick={() => void refetch()}
              class="intel-btn intel-btn-secondary"
            >
              Refresh
            </button>
          </div>
        </header>

        <Show when={!isOwner()}>
          <div class="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Owner access required.
          </div>
        </Show>

        <Show when={isOwner()}>
          <Show when={!crm.loading} fallback={
            <div class="rounded-2xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
              Loading owner CRM data...
            </div>
          }>
            <Show when={crm()?.ok !== false} fallback={
              <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                {crm()?.error || "Unable to load CRM data."}
              </div>
            }>
              <Show when={crmDegradedMessage()}>
                {(message) => (
                  <div class={`mb-4 rounded-2xl border px-4 py-3 text-sm ${crmDegradedTone()}`} data-testid="crm-summary-warning">
                    {message()}
                  </div>
                )}
              </Show>
              <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6" data-testid="crm-summary-grid">
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-total-users">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Total Users</p>
                  <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(crm()?.result?.directory?.totalUsers)}</p>
                </article>
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-subscribers">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Subscribers</p>
                  <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(crm()?.result?.billing?.stripe?.statuses?.active ?? crm()?.result?.billing?.statuses?.active)}</p>
                </article>
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-mrr">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">MRR</p>
                  <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatUsd(crm()?.result?.commandCenter?.revenue?.mrrActiveUsd ?? crm()?.result?.billing?.mrrActiveUsd)}</p>
                </article>
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-trial-paid-7d">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Trial→Paid 7d</p>
                  <p class="mt-1 text-2xl font-semibold text-emerald-300">{formatPercent(crm()?.result?.commandCenter?.funnel?.trialToPaidRate7dPct)}</p>
                </article>
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-churn-30d">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Churn 30d</p>
                  <p class="mt-1 text-2xl font-semibold text-rose-300">{formatPercent(crm()?.result?.commandCenter?.risk?.churnRate30dPct)}</p>
                </article>
                <article class="intel-panel px-4 py-3" data-testid="crm-summary-unique-users-24h">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Unique Users 24h</p>
                  <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(crm()?.result?.commandCenter?.activity?.uniqueUsers24h ?? crm()?.result?.telemetry?.uniqueUsers24h)}</p>
                </article>
              </section>

              <section class="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span>
                  Revenue source: <span class="font-semibold text-zinc-200">{getCrmRevenueSourceLabel(crm()?.result?.commandCenter?.revenue?.source)}</span>
                </span>
                <Show when={crmDegraded()?.partial}>
                  <span class="text-rose-300">Summary status: {getCrmSummaryStatusLabel(crmDegraded())}</span>
                </Show>
                <Show when={!crmDegraded()?.partial && crmDegraded()?.stale}>
                  <span class="text-amber-300">Summary status: {getCrmSummaryStatusLabel(crmDegraded())}</span>
                </Show>
                <Show when={crm()?.result?.billing?.stripe?.syncedAtMs}>
                  <span>Stripe synced: <span class="font-semibold text-zinc-200">{formatTime(crm()?.result?.billing?.stripe?.syncedAtMs)}</span></span>
                </Show>
                <Show when={crm()?.result?.billing?.stripe?.live === false && crm()?.result?.billing?.stripe?.error}>
                  <span class="text-amber-300">Stripe sync warning: {crm()?.result?.billing?.stripe?.error}</span>
                </Show>
              </section>

              <section class="mt-4 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
                <article class="intel-panel p-4">
                  <h2 class="text-base font-semibold text-zinc-100">Revenue Command Center</h2>
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">ARR</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatUsd(crm()?.result?.commandCenter?.revenue?.arrActiveUsd ?? crm()?.result?.billing?.arrActiveUsd)}</p>
                    </div>
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">ARPU Active</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatUsd(crm()?.result?.commandCenter?.revenue?.arpuActiveUsd)}</p>
                    </div>
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">Subscriber Penetration</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatPercent(crm()?.result?.commandCenter?.funnel?.subscriberPenetrationPct)}</p>
                    </div>
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">Trialing Share</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatPercent(crm()?.result?.commandCenter?.funnel?.trialingSharePct)}</p>
                    </div>
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">Net Subscriber Delta 7d</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatNumber(crm()?.result?.commandCenter?.risk?.netSubscriberDelta7d)}</p>
                    </div>
                    <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                      <p class="text-[11px] text-zinc-500">Cancellations 7d</p>
                      <p class="text-lg font-semibold text-zinc-100">{formatNumber(crm()?.result?.commandCenter?.risk?.cancellations7d ?? crm()?.result?.telemetry?.cancellations7d)}</p>
                    </div>
                  </div>
                </article>

                <article class="intel-panel p-4">
                  <h2 class="text-base font-semibold text-zinc-100">Data Quality Console</h2>
                  <div class="mt-3 space-y-2 text-sm">
                    <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span class="text-zinc-400">Missing avatars</span>
                      <span class="font-semibold text-zinc-100">{formatNumber(crm()?.result?.dataQuality?.missingAvatarUsers)}</span>
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span class="text-zinc-400">Placeholder names</span>
                      <span class="font-semibold text-zinc-100">{formatNumber(crm()?.result?.dataQuality?.placeholderNameUsers)}</span>
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span class="text-zinc-400">Synthetic logins</span>
                      <span class="font-semibold text-zinc-100">{formatNumber(crm()?.result?.dataQuality?.syntheticLoginUsers)}</span>
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span class="text-zinc-400">Provider coverage</span>
                      <span class="font-semibold text-zinc-100">{formatPercent(crm()?.result?.dataQuality?.providerCoveragePct)}</span>
                    </div>
                    <div class="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                      <span class="text-zinc-400">Billing identity coverage</span>
                      <span class="font-semibold text-zinc-100">{formatPercent(crm()?.result?.dataQuality?.billingCoveragePct)}</span>
                    </div>
                  </div>
                </article>
              </section>

              <Show when={isOwner()}>
              <section class="intel-panel mt-4 p-4" data-testid="crm-ai-surface">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="text-base font-semibold text-zinc-100">AI Command Surface</h2>
                    <p class="mt-1 text-xs text-zinc-500">Owner-only AI telemetry across dedupe, translate, classify, enrichment, and briefing lanes.</p>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <For each={["15m", "1h", "24h", "7d", "30d"] as const}>
                      {(window) => (
                        <button
                          type="button"
                          onClick={() => setAiWindow(window)}
                          data-testid={`crm-ai-window-${window}`}
                          aria-pressed={aiWindow() === window}
                          class={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            aiWindow() === window
                              ? "border-cyan-400/60 bg-cyan-500/12 text-cyan-200"
                              : "border-white/10 bg-white/[0.03] text-zinc-400 hover:border-cyan-400/40 hover:text-cyan-200"
                          }`}
                        >
                          {window}
                        </button>
                      )}
                    </For>
                    <button
                      type="button"
                      onClick={() => void refetchAiTelemetry()}
                      class="intel-btn intel-btn-secondary"
                      data-testid="crm-ai-refresh"
                    >
                      Refresh AI
                    </button>
                  </div>
                </div>

                <Show when={!aiTelemetry.loading} fallback={
                  <div class="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-400" data-testid="crm-ai-surface-loading">
                    Loading AI telemetry...
                  </div>
                }>
                  <Show when={aiTelemetry() && aiTelemetry()?.ok !== false} fallback={
                    <div class="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" data-testid="crm-ai-surface-unavailable">
                      {aiTelemetry()?.error || "Unable to load AI telemetry."}
                    </div>
                  }>
                    <section class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-6" data-testid="crm-ai-surface-configured">
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Calls</p>
                        <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(aiTelemetry()?.result?.summary?.calls)}</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Prompt Tokens</p>
                        <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(aiTelemetry()?.result?.summary?.promptTokens)}</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Completion Tokens</p>
                        <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(aiTelemetry()?.result?.summary?.completionTokens)}</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Output/Input</p>
                        <p class="mt-1 text-2xl font-semibold text-cyan-300">{formatPercent((aiTelemetry()?.result?.summary?.outputInputRatio ?? 0) * 100)}</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Avg Latency</p>
                        <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(aiTelemetry()?.result?.summary?.avgDurationMs)}ms</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">P95 Latency</p>
                        <p class="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(aiTelemetry()?.result?.summary?.p95DurationMs)}ms</p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Cache Hit Rate</p>
                        <p class="mt-1 text-2xl font-semibold text-emerald-300">{formatPercent(aiCacheHitPct())}</p>
                      </article>
                    </section>

                    <section class="mt-4 grid gap-3 xl:grid-cols-3">
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Failure Hotspot</p>
                        <p class="mt-1 text-sm font-semibold text-zinc-100">{formatEventLabel(aiWorstFailureLane()?.label)}</p>
                        <p class="mt-2 text-xs text-zinc-400">
                          {formatNumber(aiWorstFailureLane()?.failures)} failures across {formatNumber(aiWorstFailureLane()?.calls)} calls
                        </p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Slowest Lane (P95)</p>
                        <p class="mt-1 text-sm font-semibold text-zinc-100">{formatEventLabel(aiSlowestLane()?.label)}</p>
                        <p class="mt-2 text-xs text-zinc-400">
                          {formatNumber(aiSlowestLane()?.p95DurationMs)}ms p95 latency
                        </p>
                      </article>
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                        <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Most Output-Heavy Lane</p>
                        <p class="mt-1 text-sm font-semibold text-zinc-100">{formatEventLabel(aiHungriestLane()?.label)}</p>
                        <p class="mt-2 text-xs text-zinc-400">
                          {formatPercent((aiHungriestLane()?.outputInputRatio ?? 0) * 100)} output/input ratio
                        </p>
                      </article>
                    </section>

                    <section class="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                      <article class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                        <div class="flex items-center justify-between">
                          <h3 class="text-sm font-semibold text-zinc-100">Lane Spend</h3>
                          <span class="text-[11px] text-zinc-500">top lanes by total tokens</span>
                        </div>
                        <div class="mt-3 space-y-2">
                          <For each={aiTelemetry()?.result?.lanes ?? []}>
                            {(item) => {
                              const width = `${Math.max(8, ((item.totalTokens ?? 0) / aiLaneMaxTokens()) * 100)}%`;
                              return (
                                <div class="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                                  <div class="flex items-center justify-between gap-3">
                                    <span class="text-sm font-medium text-zinc-100">{formatEventLabel(item.label)}</span>
                                    <span class="text-xs text-zinc-400">{formatNumber(item.totalTokens)} tokens</span>
                                  </div>
                                  <div class="mt-2 h-2 overflow-hidden rounded-full bg-white/5">
                                    <div class="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-emerald-400" style={{ width }} />
                                  </div>
                                  <div class="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-500">
                                    <span>{formatNumber(item.calls)} calls</span>
                                    <span>{formatNumber(item.failures)} failures</span>
                                    <span>{formatNumber(item.avgDurationMs)}ms avg</span>
                                    <span>{formatNumber(item.p95DurationMs)}ms p95</span>
                                    <span>{formatPercent(computeHitRatePercent(item))} cache hit</span>
                                    <span>{formatPercent((item.outputInputRatio ?? 0) * 100)} output/input</span>
                                  </div>
                                </div>
                              );
                            }}
                          </For>
                        </div>
                      </article>

                      <div class="grid gap-4">
                        <article class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <h3 class="text-sm font-semibold text-zinc-100">Model Spend</h3>
                          <div class="mt-3 space-y-2">
                            <For each={aiTelemetry()?.result?.models ?? []}>
                              {(item) => (
                                <div class="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                                  <span class="text-zinc-300">{formatEventLabel(item.label)}</span>
                                  <span class="font-medium text-zinc-100">{formatNumber(item.totalTokens)} tokens</span>
                                </div>
                              )}
                            </For>
                          </div>
                        </article>

                        <article class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <h3 class="text-sm font-semibold text-zinc-100">Cache + Outcomes</h3>
                          <div class="mt-3 grid gap-2">
                            <For each={aiTelemetry()?.result?.cacheStatuses ?? []}>
                              {(item) => (
                                <div class="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                                  <span class="text-zinc-300">{formatEventLabel(item.label)}</span>
                                  <span class="font-medium text-zinc-100">{formatNumber(item.calls)}</span>
                                </div>
                              )}
                            </For>
                            <For each={aiTelemetry()?.result?.outcomes ?? []}>
                              {(item) => (
                                <div class="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                                  <span class="text-zinc-300">{formatEventLabel(item.label)}</span>
                                  <span class="font-medium text-zinc-100">{formatNumber(item.calls)}</span>
                                </div>
                              )}
                            </For>
                          </div>
                        </article>
                      </div>
                    </section>

                    <section class="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div class="flex items-center justify-between">
                        <h3 class="text-sm font-semibold text-zinc-100">Recent Series</h3>
                        <span class="text-[11px] text-zinc-500">generated {formatTime(aiTelemetry()?.result?.generatedAtMs)}</span>
                      </div>
                      <div class="mt-3 grid gap-2">
                        <For each={aiTelemetry()?.result?.series ?? []}>
                          {(point) => {
                            const width = `${Math.max(4, ((point.calls ?? 0) / aiSeriesMaxCalls()) * 100)}%`;
                            return (
                              <div class="grid gap-1 md:grid-cols-[160px_1fr_auto_auto] md:items-center">
                                <span class="text-[11px] text-zinc-500">{point.bucket || "—"}</span>
                                <div class="h-2 overflow-hidden rounded-full bg-white/5">
                                  <div class="h-full rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-400 to-emerald-400" style={{ width }} />
                                </div>
                                <span class="text-[11px] text-zinc-400">{formatNumber(point.calls)} calls</span>
                                <span class="text-[11px] text-zinc-400">{formatNumber(point.totalTokens)} tokens</span>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </section>
                  </Show>
                </Show>
              </section>
              </Show>

              <section class="intel-panel mt-4 overflow-x-auto p-4" data-testid="crm-customer-360">
                <h2 class="text-base font-semibold text-white">Customer 360</h2>
                <p class="mt-1 text-xs text-zinc-500">
                  Updated {formatTime(crm()?.result?.generatedAtMs)} • New users 24h: {formatNumber(crm()?.result?.directory?.newUsers24h)} • New users 7d: {formatNumber(crm()?.result?.directory?.newUsers7d)} • Legacy billing-only identities: {formatNumber(crm()?.result?.directory?.orphanTrackedUsers)}
                </p>
                <div class="mt-3 grid gap-2 md:grid-cols-[1fr_220px_auto]">
                  <input
                    type="search"
                    aria-label="CRM user search"
                    data-testid="crm-user-search"
                    value={searchTerm()}
                    onInput={(event) => setSearchTerm(event.currentTarget.value)}
                    placeholder="Search name, login, email, provider"
                    class="h-10 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/60"
                  />
                  <select
                    aria-label="CRM status filter"
                    data-testid="crm-status-filter"
                    value={statusFilter()}
                    onChange={(event) => setStatusFilter(event.currentTarget.value as "all" | "active" | "trialing" | "canceled" | "expired" | "none")}
                    class="h-10 rounded-xl border border-white/10 bg-white/[0.02] px-3 text-sm text-zinc-100 outline-none transition focus:border-sky-400/60"
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="trialing">Trialing</option>
                    <option value="canceled">Canceled</option>
                    <option value="expired">Expired</option>
                    <option value="none">None</option>
                  </select>
                  <button
                    type="button"
                    aria-label="Export CRM CSV"
                    data-testid="crm-export-csv"
                    onClick={exportCustomerCsv}
                    class="intel-btn intel-btn-ghost"
                  >
                    Export CSV
                  </button>
                </div>
                <table class="mt-3 w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr class="border-b border-white/10 text-left text-zinc-500">
                      <th class="px-2 py-2 font-medium">User</th>
                      <th class="px-2 py-2 font-medium">Email</th>
                      <th class="px-2 py-2 font-medium">Providers</th>
                      <th class="px-2 py-2 font-medium">Plan</th>
                      <th class="px-2 py-2 font-medium">MRR</th>
                      <th class="px-2 py-2 font-medium">Last Billing Event</th>
                      <th class="px-2 py-2 font-medium">Created</th>
                      <th class="px-2 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={filteredUsers()}>
                      {(entry) => {
                        const billing = accountStatusMap().get(entry.id);
                        const latestEvent = latestEventMap().get(entry.id);
                        return (
                          <tr class="border-b border-white/[0.04] text-zinc-300">
                            <td class="px-2 py-2">
                              <p class="font-medium text-zinc-100">{entry.name}</p>
                              <p class="text-xs text-zinc-500">{entry.login}</p>
                            </td>
                            <td class="px-2 py-2 text-xs text-zinc-400">{entry.email}</td>
                            <td class="px-2 py-2 text-xs text-zinc-400">{(entry.providers ?? []).join(", ") || "—"}</td>
                            <td class="px-2 py-2 text-xs text-zinc-200">{formatSubscriptionStatus(billing?.status)}</td>
                            <td class="px-2 py-2 text-xs text-zinc-200">{formatUsd(billing?.monthlyPriceUsd)}</td>
                            <td class="px-2 py-2 text-xs text-zinc-400">
                              <p>{formatEventLabel(latestEvent?.kind)}</p>
                              <p>{formatTime(latestEvent?.atMs)}</p>
                            </td>
                            <td class="px-2 py-2 text-xs text-zinc-400">{formatTime(entry.createdAtMs)}</td>
                            <td class="px-2 py-2 text-xs text-zinc-400">
                              <button
                                type="button"
                                aria-label={`Manage ${entry.name}`}
                                onClick={() => void loadCustomerOps(entry.id)}
                                class={`rounded-lg border px-2 py-1 text-xs transition ${
                                  selectedUserId() === entry.id
                                    ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-200"
                                    : "border-white/15 bg-white/[0.03] text-zinc-200 hover:border-cyan-400/40 hover:text-cyan-200"
                                }`}
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </section>

              <section class="intel-panel mt-4 p-4" data-testid="crm-customer-operations">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="text-base font-semibold text-zinc-100">Customer Operations</h2>
                    <p class="mt-1 text-xs text-zinc-500">Direct Stripe operations: inspect customer, schedule cancellation, immediate cancellation, and refunds.</p>
                  </div>
                  <Show when={selectedUser()}>
                    <button
                      type="button"
                      aria-label={`Refresh customer ${selectedUser()?.name || "selection"}`}
                      data-testid="crm-refresh-customer"
                      onClick={() => void loadCustomerOps(selectedUserId(), true)}
                      disabled={opsBusy()}
                      class="intel-btn intel-btn-secondary"
                    >
                      Refresh Customer
                    </button>
                  </Show>
                </div>

                <Show when={selectedUser()} fallback={
                  <div class="mt-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-400" data-testid="crm-no-selected-user">
                    Select a user from Customer 360 and click <span class="font-semibold text-zinc-200">Manage</span> to unlock Stripe operations.
                  </div>
                }>
                  <div class="mt-3 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                    <article class="rounded-xl border border-white/10 bg-white/[0.02] p-3" data-testid="crm-selected-user-panel">
                      <p class="text-xs uppercase tracking-[0.11em] text-zinc-500">Selected User</p>
                      <p class="mt-1 text-sm font-semibold text-zinc-100">{selectedUser()?.name} <span class="text-zinc-400">({selectedUser()?.login})</span></p>
                      <p class="text-xs text-zinc-400">{selectedUser()?.email}</p>
                      <div class="mt-3 grid gap-2 sm:grid-cols-2">
                        <div class="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2">
                          <p class="text-[11px] text-zinc-500">Account Status</p>
                          <p class="text-sm font-medium text-zinc-100">{formatSubscriptionStatus(selectedCustomerOps()?.result?.account?.status)}</p>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2">
                          <p class="text-[11px] text-zinc-500">Stripe Customer</p>
                          <p class="truncate text-sm font-medium text-zinc-100">{selectedCustomerOps()?.result?.account?.stripeCustomerId || "—"}</p>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2">
                          <p class="text-[11px] text-zinc-500">Stripe Subscription</p>
                          <p class="truncate text-sm font-medium text-zinc-100">{selectedCustomerOps()?.result?.stripe?.subscription?.id || selectedCustomerOps()?.result?.account?.stripeSubscriptionId || "—"}</p>
                        </div>
                        <div class="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2">
                          <p class="text-[11px] text-zinc-500">Current Period End</p>
                          <p class="text-sm font-medium text-zinc-100">{formatTime(selectedCustomerOps()?.result?.stripe?.subscription?.currentPeriodEndMs ?? undefined)}</p>
                        </div>
                      </div>
                      <Show when={selectedCustomerOps()?.result?.cache}>
                        {(cache) => (
                          <p class="mt-3 text-xs text-zinc-400" data-testid="crm-customer-cache-status">
                            Customer snapshot:{" "}
                            <span class="font-semibold text-zinc-200">
                              {getCrmCustomerCacheSourceLabel(cache().source)}
                            </span>
                            {" • "}
                            fetched {formatTime(cache().fetchedAtMs)}
                          </p>
                        )}
                      </Show>
                    </article>

                    <article class="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <p class="text-xs uppercase tracking-[0.11em] text-zinc-500">Billing Actions</p>
                      <div class="mt-3 grid gap-2">
                        <button
                          type="button"
                          onClick={() => void runCancelSubscription(true)}
                          disabled={opsBusy()}
                          class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-left text-sm font-medium text-amber-200 transition hover:border-amber-400/60 disabled:opacity-60"
                        >
                          Cancel At Period End
                        </button>
                        <button
                          type="button"
                          onClick={() => void runCancelSubscription(false)}
                          disabled={opsBusy()}
                          class="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-left text-sm font-medium text-rose-200 transition hover:border-rose-400/60 disabled:opacity-60"
                        >
                          Cancel Immediately
                        </button>
                        <div class="mt-1 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                          <p class="text-[11px] text-zinc-500">Refund Controls</p>
                          <div class="mt-2 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                            <input
                              type="text"
                              inputmode="decimal"
                              aria-label="Refund amount in USD"
                              value={refundAmountUsd()}
                              onInput={(event) => setRefundAmountUsd(event.currentTarget.value)}
                              placeholder="Amount USD (blank=full)"
                              class="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-400/60"
                            />
                            <select
                              aria-label="Refund reason"
                              value={refundReason()}
                              onChange={(event) => setRefundReason(event.currentTarget.value as "requested_by_customer" | "duplicate" | "fraudulent")}
                              class="h-9 rounded-lg border border-white/10 bg-black/20 px-2 text-xs text-zinc-100 outline-none transition focus:border-cyan-400/60"
                            >
                              <option value="requested_by_customer">Requested by customer</option>
                              <option value="duplicate">Duplicate</option>
                              <option value="fraudulent">Fraudulent</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => void runRefund()}
                              disabled={opsBusy()}
                              class="h-9 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/60 disabled:opacity-60"
                            >
                              Refund Latest
                            </button>
                          </div>
                        </div>
                      </div>
                      <Show when={opsBusy()}>
                        <p class="mt-2 text-xs text-cyan-200" data-testid="crm-ops-busy">Running Stripe operation...</p>
                      </Show>
                      <Show when={opsError()}>
                        <p class="mt-2 text-xs text-rose-300" data-testid="crm-ops-error">{opsError()}</p>
                      </Show>
                      <Show when={opsNotice()}>
                        <p class="mt-2 text-xs text-emerald-300" data-testid="crm-ops-notice">{opsNotice()}</p>
                      </Show>
                    </article>
                  </div>

                  <Show when={(selectedCustomerOps()?.result?.stripe?.charges?.length ?? 0) > 0}>
                    <div class="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <p class="text-xs uppercase tracking-[0.11em] text-zinc-500">Recent Charges</p>
                      <div class="mt-2 space-y-2">
                        <For each={selectedCustomerOps()?.result?.stripe?.charges ?? []}>
                          {(charge) => (
                            <div class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs">
                              <div>
                                <p class="font-medium text-zinc-100">{charge.id} • {formatUsd(charge.amountUsd)}</p>
                                <p class="text-zinc-400">{charge.status} • {formatTime(charge.createdAtMs)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void runRefund(charge.id)}
                                disabled={opsBusy() || charge.refunded === true}
                                class="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-200 transition hover:border-cyan-400/60 disabled:opacity-60"
                              >
                                {charge.refunded ? "Already Refunded" : "Refund This Charge"}
                              </button>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </Show>
                </Show>
              </section>

              <section class="intel-panel mt-4 p-4">
                <h2 class="text-base font-semibold text-zinc-100">Telemetry Event Mix (7d)</h2>
                <div class="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  <For each={crm()?.result?.telemetry?.topKinds7d ?? []}>
                    {(item) => (
                      <div class="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
                        <p class="text-xs text-zinc-500">{formatEventLabel(item.kind)}</p>
                        <p class="text-lg font-semibold text-zinc-100">{formatNumber(item.count)}</p>
                      </div>
                    )}
                  </For>
                </div>
              </section>
            </Show>
          </Show>
        </Show>
      </div>
    </>
  );
}
