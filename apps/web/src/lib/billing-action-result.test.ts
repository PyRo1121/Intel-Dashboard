import test from "node:test";
import assert from "node:assert/strict";
import {
  getBillingCheckoutBypassNotice,
  getBillingPortalState,
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
  assert.deepEqual(
    getBillingPortalState({ role: "owner", subscription: { portalAvailable: false } }),
    { ownerBypass: true, portalAvailable: false, portalReady: true },
  );
  assert.deepEqual(
    getBillingPortalState({ role: "subscriber", subscription: { portalAvailable: true } }),
    { ownerBypass: false, portalAvailable: true, portalReady: true },
  );
  assert.deepEqual(
    getBillingPortalState({ role: "trial", subscription: { portalAvailable: false } }),
    { ownerBypass: false, portalAvailable: false, portalReady: false },
  );
});
