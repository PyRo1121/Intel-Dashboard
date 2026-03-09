import test from "node:test";
import assert from "node:assert/strict";
import {
  getCrmQualityBadgeTone,
  getCrmRevenueSourceLabel,
  getCrmSummaryStatusLabel,
  getCrmSummaryWarningMessage,
  getCrmSummaryWarningTone,
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
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
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
});

test("CRM data quality badge tone reflects whether tracked issues are present", () => {
  assert.equal(
    getCrmQualityBadgeTone({ missingAvatarUsers: 1 }),
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
