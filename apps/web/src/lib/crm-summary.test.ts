import test from "node:test";
import assert from "node:assert/strict";
import {
  getCrmArrActiveUsd,
  getCrmCancellations7d,
  getCrmCustomer360SummaryText,
  getCrmDataQualityRows,
  getCrmGeneratedAtMs,
  getCrmQualityBadgeTone,
  getCrmRevenueSourceLabel,
  getCrmMrrActiveUsd,
  getCrmSubscriberCount,
  getCrmStripeSyncedAtMs,
  getCrmSummaryStatusLabel,
  getCrmSummaryStatusTone,
  getCrmSummaryWarningMessage,
  getCrmSummaryWarningTone,
  getCrmUniqueUsers24h,
} from "./crm-summary.ts";

test("CRM summary warning prefers partial state over stale state", () => {
  assert.equal(
    getCrmSummaryWarningMessage({ partial: true, stale: true }),
    "CRM summary is partial. Some aggregates were truncated, so totals may under-report current state.",
  );
  assert.equal(
    getCrmSummaryWarningTone({ partial: true, stale: true }),
    "border-rose-500/30 bg-rose-500/10 text-rose-200",
  );
});

test("CRM summary warning shows stale cache state when partial is false", () => {
  assert.equal(
    getCrmSummaryWarningMessage({ partial: false, stale: true }),
    "CRM summary is stale. Metrics are served from maintained cache and may lag the current time window.",
  );
  assert.equal(
    getCrmSummaryWarningTone({ partial: false, stale: true }),
    "border-amber-500/30 bg-amber-500/10 text-amber-200",
  );
});

test("CRM summary warning stays quiet for healthy snapshots", () => {
  assert.equal(getCrmSummaryWarningMessage({ partial: false, stale: false }), null);
  assert.equal(
    getCrmSummaryWarningTone({ partial: false, stale: false }),
    "border-amber-500/30 bg-amber-500/10 text-amber-200",
  );
  assert.equal(getCrmSummaryWarningMessage(undefined), null);
});

test("CRM revenue source labels stay aligned with backend source variants", () => {
  assert.equal(getCrmRevenueSourceLabel("stripe_live"), "Stripe Live");
  assert.equal(getCrmRevenueSourceLabel("stripe_cache"), "Stripe Cache");
  assert.equal(getCrmRevenueSourceLabel("stripe_cache_stale"), "Stripe Cache (Stale)");
  assert.equal(getCrmRevenueSourceLabel("internal_snapshot"), "Internal Snapshot");
  assert.equal(getCrmRevenueSourceLabel(undefined), "Internal Snapshot");
});

test("CRM summary short status labels stay aligned with degraded state", () => {
  assert.equal(getCrmSummaryStatusLabel({ partial: true, stale: true }), "partial snapshot");
  assert.equal(getCrmSummaryStatusLabel({ partial: false, stale: true }), "stale cache");
  assert.equal(getCrmSummaryStatusLabel({ partial: false, stale: false }), null);
  assert.equal(getCrmSummaryStatusTone({ partial: true, stale: true }), "text-rose-300");
  assert.equal(getCrmSummaryStatusTone({ partial: false, stale: true }), "text-amber-300");
  assert.equal(getCrmSummaryStatusTone({ partial: false, stale: false }), null);
});

test("CRM data quality badge tone reflects whether tracked issues are present", () => {
  assert.equal(
    getCrmQualityBadgeTone({ missingAvatarUsers: 1 }),
    "text-amber-300 border-amber-500/40 bg-amber-500/10",
  );
  assert.equal(
    getCrmQualityBadgeTone({
      missingAvatarUsers: 0,
      placeholderNameUsers: 12,
      syntheticLoginUsers: 0,
      orphanTrackedUsers: 0,
      providerCoveragePct: 98,
      billingCoveragePct: 97,
    }),
    "text-rose-300 border-rose-500/40 bg-rose-500/10",
  );
  assert.equal(
    getCrmQualityBadgeTone({
      missingAvatarUsers: 0,
      placeholderNameUsers: 0,
      syntheticLoginUsers: 0,
      orphanTrackedUsers: 0,
      providerCoveragePct: 88,
      billingCoveragePct: 91,
    }),
    "text-amber-300 border-amber-500/40 bg-amber-500/10",
  );
  assert.equal(
    getCrmQualityBadgeTone({ missingAvatarUsers: 0, placeholderNameUsers: 0, syntheticLoginUsers: 0, orphanTrackedUsers: 0 }),
    "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  );
  assert.equal(
    getCrmQualityBadgeTone(undefined),
    "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  );
});

test("CRM summary selectors prefer command-center or Stripe-backed values when available", () => {
  const result = {
    billing: {
      mrrActiveUsd: 100,
      arrActiveUsd: 1200,
      statuses: { active: 4 },
      stripe: { statuses: { active: 5 } },
    },
    telemetry: { uniqueUsers24h: 20, cancellations7d: 2 },
    commandCenter: {
      revenue: { mrrActiveUsd: 110, arrActiveUsd: 1320 },
      risk: { cancellations7d: 3 },
      activity: { uniqueUsers24h: 25 },
    },
  };

  assert.equal(getCrmSubscriberCount(result), 5);
  assert.equal(getCrmMrrActiveUsd(result), 110);
  assert.equal(getCrmArrActiveUsd(result), 1320);
  assert.equal(getCrmUniqueUsers24h(result), 25);
  assert.equal(getCrmCancellations7d(result), 3);

  assert.equal(getCrmSubscriberCount({ billing: { statuses: { active: 4 } } }), 4);
  assert.equal(getCrmMrrActiveUsd({ billing: { mrrActiveUsd: 100 } }), 100);
  assert.equal(getCrmArrActiveUsd({ billing: { arrActiveUsd: 1200 } }), 1200);
  assert.equal(getCrmUniqueUsers24h({ telemetry: { uniqueUsers24h: 20 } }), 20);
  assert.equal(getCrmCancellations7d({ telemetry: { cancellations7d: 2 } }), 2);
  assert.equal(getCrmStripeSyncedAtMs({ billing: { stripe: { syncedAtMs: 123 } } }), 123);
  assert.equal(getCrmStripeSyncedAtMs(undefined), undefined);
  assert.equal(getCrmGeneratedAtMs({ generatedAtMs: 456 }), 456);
  assert.equal(getCrmGeneratedAtMs(undefined), undefined);
});

test("CRM customer 360 summary text formats generated time and user counters", () => {
  assert.equal(
    getCrmCustomer360SummaryText({
      generatedAtMs: Date.UTC(2026, 2, 9, 12, 0, 0),
      directory: {
        newUsers24h: 4,
        newUsers7d: 12,
        orphanTrackedUsers: 3,
      },
    }),
    `Updated ${new Date(Date.UTC(2026, 2, 9, 12, 0, 0)).toLocaleString()} • New users 24h: 4 • New users 7d: 12 • Legacy billing-only identities: 3`,
  );
});

test("CRM data quality rows expose stable labels and formatted values", () => {
  assert.deepEqual(
    getCrmDataQualityRows({
      missingAvatarUsers: 2,
      placeholderNameUsers: 3,
      syntheticLoginUsers: 4,
      providerCoveragePct: 88.4,
      billingCoveragePct: 91.2,
    }),
    [
      { label: "Missing avatars", value: "2" },
      { label: "Placeholder names", value: "3" },
      { label: "Synthetic logins", value: "4" },
      { label: "Provider coverage", value: "88.4%" },
      { label: "Billing identity coverage", value: "91.2%" },
    ],
  );
});
