import { Meta, Title } from "@solidjs/meta";
import { Show, createResource, createSignal } from "solid-js";
import { PREMIUM_PRICE_USD, formatDelayMinutesShortLabel } from "@intel-dashboard/shared/access-offers.ts";
import { formatEntitlementTier, formatSubscriptionStatus } from "@intel-dashboard/shared/entitlement.ts";
import {
  getBillingCheckoutBypassNotice,
  getBillingPortalState,
  getBillingPortalBypassNotice,
  getBillingTrialNotice,
} from "~/lib/billing-action-result";
import {
  callBillingAction,
  fetchBillingActivity,
  fetchBillingStatus,
} from "~/lib/billing-client";
import { formatActivityKindLabel } from "~/lib/event-label";
import { useWallClock } from "~/lib/live-refresh";
import { formatAgeAgoAt } from "~/lib/utils";
import { BILLING_DESCRIPTION, BILLING_TITLE } from "@intel-dashboard/shared/route-meta.ts";

export default function BillingRoute() {
  const [status, { refetch }] = createResource(fetchBillingStatus, { initialValue: null });
  const [activity, { refetch: refetchActivity }] = createResource(fetchBillingActivity, { initialValue: null });
  const [busyAction, setBusyAction] = createSignal<"trial" | "checkout" | "portal" | null>(null);
  const [notice, setNotice] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");
  const nowMs = useWallClock(1000);
  const portalState = () => getBillingPortalState(status()?.result);

  const beginAction = (action: "trial" | "checkout" | "portal") => {
    setBusyAction(action);
    setNotice("");
    setError("");
  };

  const refreshBillingState = async () => {
    await refetch();
    await refetchActivity();
  };

  const runStartTrial = async () => {
    beginAction("trial");
    const result = await callBillingAction("/api/billing/start-trial");
    if (!result.ok) {
      setError(result.error || "Unable to start trial.");
      setBusyAction(null);
      return;
    }
    setNotice(getBillingTrialNotice(result.result));
    await refreshBillingState();
    setBusyAction(null);
  };

  const runCheckout = async () => {
    beginAction("checkout");
    const result = await callBillingAction("/api/billing/checkout");
    if (!result.ok) {
      setError(result.error || "Unable to start checkout.");
      setBusyAction(null);
      return;
    }
    if (result.result?.bypassCheckout === true || result.result?.owner === true) {
      setNotice(getBillingCheckoutBypassNotice());
      await refreshBillingState();
      setBusyAction(null);
      return;
    }
    const checkoutUrl = (result.result?.checkoutUrl || "").trim();
    if (checkoutUrl) {
      window.location.assign(checkoutUrl);
      return;
    }
    setError("Checkout URL was not returned by the billing backend.");
    setBusyAction(null);
  };

  const runPortal = async () => {
    beginAction("portal");
    if (!portalState().portalReady) {
      setError("Billing portal is not ready yet for this account. Complete checkout once, then retry.");
      setBusyAction(null);
      return;
    }
    const result = await callBillingAction("/api/billing/portal");
    if (!result.ok) {
      setError(result.error || "Unable to open billing portal.");
      setBusyAction(null);
      return;
    }
    if (result.result?.bypassPortal === true || result.result?.owner === true) {
      setNotice(getBillingPortalBypassNotice());
      await refetchActivity();
      setBusyAction(null);
      return;
    }
    const portalUrl = (result.result?.portalUrl || "").trim();
    if (portalUrl) {
      window.location.assign(portalUrl);
      return;
    }
    setError("Billing portal URL was not returned by the backend.");
    setBusyAction(null);
  };

  return (
    <>
      <Title>{BILLING_TITLE}</Title>
      <Meta name="description" content={BILLING_DESCRIPTION} />

      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <p class="intel-badge mb-2">Subscription</p>
            <h1 class="intel-heading">Billing & Access</h1>
            <p class="intel-subheading">
            Start your trial, open Stripe checkout, and verify your entitlement state.
            </p>
          </div>
        </header>

        <Show when={notice()}>
          {(value) => (
            <div
              class="rounded-sm border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
              data-testid="billing-notice"
              aria-live="polite"
            >
              {value()}
            </div>
          )}
        </Show>
        <Show when={error()}>
          {(value) => (
            <div
              class="rounded-sm border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              data-testid="billing-error"
              aria-live="assertive"
            >
              {value()}
            </div>
          )}
        </Show>

        <section class="surface-card p-5 md:p-6 space-y-4" data-testid="billing-status-surface">
          <Show
            when={status()}
            fallback={
              <div class="text-sm text-zinc-500">
                Loading billing state...
              </div>
            }
          >
            {(payload) => (
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="billing-summary-grid">
                <article class="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4" data-testid="billing-summary-tier">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Tier</p>
                  <p class="mt-1 text-base font-semibold text-white">{formatEntitlementTier(payload().result?.tier)}</p>
                </article>
                <article class="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4" data-testid="billing-summary-status">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Status</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {formatSubscriptionStatus(payload().result?.subscription?.status)}
                  </p>
                </article>
                <article class="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4" data-testid="billing-summary-delay">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Feed Delay</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    {formatDelayMinutesShortLabel(Number(payload().result?.delayMinutes ?? 0))}
                  </p>
                </article>
                <article class="rounded-sm border border-white/[0.06] bg-white/[0.02] p-4" data-testid="billing-summary-plan">
                  <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Plan</p>
                  <p class="mt-1 text-base font-semibold text-white">
                    ${Number(payload().result?.monthlyPriceUsd ?? PREMIUM_PRICE_USD)}/mo
                  </p>
                </article>
              </div>
            )}
          </Show>

          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runStartTrial()}
              disabled={busyAction() !== null}
              data-testid="billing-start-trial"
              class="intel-btn intel-btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Show when={busyAction() === "trial"} fallback="Start Trial">
                Starting...
              </Show>
            </button>
            <button
              type="button"
              onClick={() => void runCheckout()}
              disabled={busyAction() !== null}
              data-testid="billing-open-checkout"
              class="intel-btn intel-btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Show when={busyAction() === "checkout"} fallback="Open Checkout">
                Opening...
              </Show>
            </button>
            <button
              type="button"
              onClick={() => void runPortal()}
              disabled={busyAction() !== null || !portalState().portalReady}
              data-testid="billing-manage-subscription"
              class="intel-btn intel-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Show when={busyAction() === "portal"} fallback={portalState().portalReady ? "Manage Subscription" : "Portal Pending"}>
                Opening...
              </Show>
            </button>
            <button
              type="button"
              onClick={() => {
                void refreshBillingState();
              }}
              disabled={busyAction() !== null}
              data-testid="billing-refresh"
              class="intel-btn intel-btn-ghost disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
          <Show when={!portalState().portalReady}>
            <p class="text-xs text-zinc-500" data-testid="billing-portal-pending">
              Stripe portal unlocks automatically after first successful checkout webhook.
            </p>
          </Show>
        </section>

        <section class="surface-card p-5 md:p-6 space-y-4" data-testid="billing-activity-surface">
          <header class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-600">Activity</p>
              <h2 class="text-lg font-semibold text-white">Billing Timeline</h2>
            </div>
            <p class="text-xs text-zinc-500">
              {Number(activity()?.result?.total ?? 0)} events
            </p>
          </header>
          <Show
            when={(activity()?.result?.events?.length ?? 0) > 0}
            fallback={<p class="text-sm text-zinc-500" data-testid="billing-activity-empty">No billing events recorded yet.</p>}
          >
            <div class="space-y-2" data-testid="billing-activity-list">
              {(activity()?.result?.events || []).map((event) => (
                <article class="rounded-sm border border-white/[0.08] bg-white/[0.02] px-3 py-2.5" data-testid="billing-activity-item">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="inline-flex items-center rounded-none border border-zinc-600 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-300">
                      {formatActivityKindLabel(event.kind)}
                    </span>
                    <span data-e2e="billing-event-age" class="text-xs text-zinc-500">{formatAgeAgoAt(event.atMs, nowMs())}</span>
                    <Show when={event.source}>
                      <span class="text-[11px] text-zinc-500">{event.source}</span>
                    </Show>
                    <Show when={event.status}>
                      <span class="text-[11px] text-zinc-500">status: {event.status}</span>
                    </Show>
                  </div>
                  <Show when={event.note}>
                    <p class="mt-1 text-sm text-zinc-300">{event.note}</p>
                  </Show>
                  <Show when={event.stripeEventType}>
                    <p class="mt-1 text-[11px] text-zinc-500">{event.stripeEventType}</p>
                  </Show>
                </article>
              ))}
            </div>
          </Show>
        </section>
      </div>
    </>
  );
}
