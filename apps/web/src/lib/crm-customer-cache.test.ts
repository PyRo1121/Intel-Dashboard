import test from "node:test";
import assert from "node:assert/strict";
import { getCrmCustomerCacheSourceLabel } from "./crm-customer-cache.ts";

test("CRM customer cache source labels stay aligned with backend variants", () => {
  assert.equal(getCrmCustomerCacheSourceLabel("stripe_live"), "Live Stripe");
  assert.equal(getCrmCustomerCacheSourceLabel("crm_customer_cache"), "Cached");
  assert.equal(getCrmCustomerCacheSourceLabel("crm_customer_cache_stale"), "Cached (stale)");
  assert.equal(getCrmCustomerCacheSourceLabel(undefined), "Unknown");
});

