import test from "node:test";
import assert from "node:assert/strict";
import {
  entitlementTierTone,
  formatEntitlementTier,
  formatSubscriptionStatus,
  isEntitledRole,
  isOwnerRole,
  resolveEntitlementView,
  resolveEntitlementRole,
} from "@intel-dashboard/shared/entitlement.ts";

test("shared entitlement helpers normalize tier labels and entitlement roles", () => {
  assert.equal(formatEntitlementTier("owner"), "Owner");
  assert.equal(formatEntitlementTier("subscriber"), "Subscriber");
  assert.equal(formatEntitlementTier("trial"), "Trial");
  assert.equal(formatEntitlementTier("free"), "Free");
  assert.equal(formatEntitlementTier(undefined), "Free");

  assert.equal(resolveEntitlementRole("owner", "subscriber"), "owner");
  assert.equal(resolveEntitlementRole(undefined, "trial"), "trial");
  assert.equal(resolveEntitlementRole(undefined, undefined), "free");

  assert.deepEqual(
    resolveEntitlementView({ role: "owner", tier: "subscriber", entitled: false, delayMinutes: 15 }),
    {
      role: "owner",
      entitled: true,
      delayMinutes: 15,
      planLabel: "Owner",
      planTone: "text-emerald-300",
    },
  );
  assert.deepEqual(
    resolveEntitlementView({ tier: "trial", entitled: false }),
    {
      role: "trial",
      entitled: false,
      delayMinutes: 0,
      planLabel: "Trial",
      planTone: "text-amber-300",
    },
  );

  assert.equal(isEntitledRole("owner"), true);
  assert.equal(isEntitledRole("subscriber"), true);
  assert.equal(isEntitledRole("trial"), false);
  assert.equal(isEntitledRole("free"), false);
  assert.equal(isEntitledRole(undefined), false);

  assert.equal(isOwnerRole("owner"), true);
  assert.equal(isOwnerRole("OWNER"), true);
  assert.equal(isOwnerRole("subscriber"), false);
  assert.equal(isOwnerRole(undefined), false);

  assert.equal(entitlementTierTone("owner"), "text-emerald-300");
  assert.equal(entitlementTierTone("subscriber"), "text-sky-300");
  assert.equal(entitlementTierTone("trial"), "text-amber-300");
  assert.equal(entitlementTierTone(undefined), "text-zinc-500");

  assert.equal(formatSubscriptionStatus("trialing"), "Trialing");
  assert.equal(formatSubscriptionStatus("active"), "Active");
  assert.equal(formatSubscriptionStatus("owner"), "Owner lifetime");
  assert.equal(formatSubscriptionStatus("canceled"), "Canceled");
  assert.equal(formatSubscriptionStatus("expired"), "Expired");
  assert.equal(formatSubscriptionStatus(undefined), "None");
});
