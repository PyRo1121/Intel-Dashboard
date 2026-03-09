import test from "node:test";
import assert from "node:assert/strict";
import {
  getBillingCheckoutBypassNotice,
  getBillingPortalBypassNotice,
  getBillingTrialNotice,
} from "./billing-action-result.ts";

test("billing action result helpers return stable operator notices", () => {
  assert.equal(
    getBillingTrialNotice({ owner: true }),
    "Owner account detected. Trial activation is not required.",
  );
  assert.equal(
    getBillingTrialNotice({ trialStarted: true }),
    "Trial started. Entitlements updated.",
  );
  assert.equal(
    getBillingTrialNotice({ trialEligible: false }),
    "Trial is not available for this account.",
  );
  assert.equal(
    getBillingTrialNotice({}),
    "Trial status updated.",
  );
  assert.equal(
    getBillingCheckoutBypassNotice(),
    "Owner account detected. Checkout bypass is active.",
  );
  assert.equal(
    getBillingPortalBypassNotice(),
    "Owner account detected. Stripe portal is not required.",
  );
});
