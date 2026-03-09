import test from "node:test";
import assert from "node:assert/strict";
import {
  freshnessBadgeClass,
  freshnessStateForAge,
  trustBadgeClass,
  trustTierFromSignals,
  verificationLabelFromSignals,
} from "./telegram-entry.ts";

test("telegram freshness helpers map ages to expected states and classes", () => {
  assert.equal(freshnessStateForAge(5 * 60 * 1000), "hot");
  assert.equal(freshnessStateForAge(30 * 60 * 1000), "warm");
  assert.equal(freshnessStateForAge(2 * 60 * 60 * 1000), "cool");
  assert.equal(freshnessStateForAge(7 * 60 * 60 * 1000), "cold");
  assert.match(freshnessBadgeClass("hot"), /rose/);
  assert.match(freshnessBadgeClass("cold"), /zinc/);
});

test("telegram trust helpers map explicit and inferred trust tiers", () => {
  assert.equal(trustTierFromSignals({ trustTier: "core" }), "High");
  assert.equal(trustTierFromSignals({ trustTier: "verified" }), "Medium");
  assert.equal(trustTierFromSignals({ sourceCount: 3 }), "Medium");
  assert.equal(trustTierFromSignals({ sourceCount: 1 }), "Watch");
  assert.match(trustBadgeClass("High"), /emerald/);
});

test("telegram verification helper maps explicit and inferred signals", () => {
  assert.equal(verificationLabelFromSignals({ verificationState: "verified" }), "Cross-confirmed");
  assert.equal(verificationLabelFromSignals({ sourceCount: 2 }), "Multi-source");
  assert.equal(verificationLabelFromSignals({ hasMedia: true }), "Media-backed");
  assert.equal(verificationLabelFromSignals({ hasUsefulImageText: true }), "OCR-backed");
  assert.equal(verificationLabelFromSignals({}), "Single-source");
});

