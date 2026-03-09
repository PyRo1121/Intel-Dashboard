import test from "node:test";
import assert from "node:assert/strict";
import {
  getCrmCustomerAccountStatusLabel,
  getCrmCustomerCacheSourceLabel,
  getCrmCustomerCacheFetchedAtMs,
  getCrmCustomerCurrentPeriodEndMs,
  getCrmCustomerStripeCustomerId,
  getCrmCustomerStripeSubscriptionId,
  readCrmCustomerCharges,
} from "./crm-customer-cache.ts";

test("CRM customer cache source labels stay aligned with backend variants", () => {
  assert.equal(getCrmCustomerCacheSourceLabel("stripe_live"), "Live Stripe");
  assert.equal(getCrmCustomerCacheSourceLabel("crm_customer_cache"), "Cached");
  assert.equal(getCrmCustomerCacheSourceLabel("crm_customer_cache_stale"), "Cached (stale)");
  assert.equal(getCrmCustomerCacheSourceLabel(undefined), "Unknown");
});

test("CRM customer cache helpers resolve displayed Stripe ids with route-safe fallbacks", () => {
  assert.equal(
    getCrmCustomerAccountStatusLabel({ account: { status: "active" } }),
    "Active",
  );
  assert.equal(
    getCrmCustomerAccountStatusLabel(undefined),
    "None",
  );
  assert.equal(
    getCrmCustomerStripeCustomerId({ account: { stripeCustomerId: "cus_123" } }),
    "cus_123",
  );
  assert.equal(
    getCrmCustomerStripeCustomerId(undefined),
    "—",
  );

  assert.equal(
    getCrmCustomerStripeSubscriptionId({
      stripe: { subscription: { id: "sub_live" } },
      account: { stripeSubscriptionId: "sub_cached" },
    }),
    "sub_live",
  );
  assert.equal(
    getCrmCustomerStripeSubscriptionId({ account: { stripeSubscriptionId: "sub_cached" } }),
    "sub_cached",
  );
  assert.equal(
    getCrmCustomerStripeSubscriptionId(undefined),
    "—",
  );
  assert.equal(
    getCrmCustomerCurrentPeriodEndMs({ stripe: { subscription: { currentPeriodEndMs: 123 } } }),
    123,
  );
  assert.equal(
    getCrmCustomerCurrentPeriodEndMs(undefined),
    undefined,
  );
  assert.equal(
    getCrmCustomerCacheFetchedAtMs({ cache: { fetchedAtMs: 456 } }),
    456,
  );
  assert.equal(
    getCrmCustomerCacheFetchedAtMs(undefined),
    undefined,
  );
  assert.deepEqual(
    readCrmCustomerCharges({ stripe: { charges: [{ id: "ch_1" }] } }),
    [{ id: "ch_1" }],
  );
  assert.deepEqual(
    readCrmCustomerCharges(undefined),
    [],
  );
});
