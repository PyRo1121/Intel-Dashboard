import test from "node:test";
import assert from "node:assert/strict";
import {
  freshnessBadgeClass,
  freshnessStateForAge,
  trustBadgeClass,
  trustTierForSignals,
  verificationLabelForSignals,
} from "./telegram-entry-display.ts";

test("telegram entry display helpers map freshness correctly", () => {
  assert.equal(freshnessStateForAge(5 * 60 * 1000), "hot");
  assert.equal(freshnessStateForAge(30 * 60 * 1000), "warm");
  assert.equal(freshnessStateForAge(2 * 60 * 60 * 1000), "cool");
  assert.equal(freshnessStateForAge(8 * 60 * 60 * 1000), "cold");
  assert.match(freshnessBadgeClass("warm"), /amber/);
});

test("telegram entry display helpers map trust tiers and verification labels", () => {
  assert.equal(trustTierForSignals({ trustTier: "core" }), "High");
  assert.equal(trustTierForSignals({ sourceCount: 3 }), "Medium");
  assert.equal(trustTierForSignals({ sourceCount: 1 }), "Watch");
  assert.match(trustBadgeClass("High"), /emerald/);

  assert.equal(verificationLabelForSignals({ verificationState: "verified" }), "Cross-confirmed");
  assert.equal(verificationLabelForSignals({ sourceCount: 2 }), "Multi-source");
  assert.equal(verificationLabelForSignals({ hasMedia: true }), "Media-backed");
  assert.equal(verificationLabelForSignals({ hasUsefulImageText: true }), "OCR-backed");
});

