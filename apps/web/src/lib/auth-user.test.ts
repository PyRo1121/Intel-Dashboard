import test from "node:test";
import assert from "node:assert/strict";
import { isAuthUserOwner, resolveAuthUserRole } from "./auth-user.ts";

test("resolveAuthUserRole falls back from role to tier to free", () => {
  assert.equal(resolveAuthUserRole({ entitlement: { role: "owner", tier: "subscriber" } }), "owner");
  assert.equal(resolveAuthUserRole({ entitlement: { tier: "trial" } }), "trial");
  assert.equal(resolveAuthUserRole({ entitlement: {} }), "free");
  assert.equal(resolveAuthUserRole(null), "free");
});

test("isAuthUserOwner derives owner status from resolved auth role", () => {
  assert.equal(isAuthUserOwner({ entitlement: { role: "owner" } }), true);
  assert.equal(isAuthUserOwner({ entitlement: { tier: "owner" } }), true);
  assert.equal(isAuthUserOwner({ entitlement: { role: "subscriber" } }), false);
  assert.equal(isAuthUserOwner(undefined), false);
});

