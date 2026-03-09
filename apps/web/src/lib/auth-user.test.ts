import test from "node:test";
import assert from "node:assert/strict";
import { isAuthUserOwner, resolveAuthUserDisplay, resolveAuthUserEntitlementView, resolveAuthUserRole } from "./auth-user.ts";

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

test("resolveAuthUserEntitlementView reuses the shared entitlement view contract", () => {
  assert.deepEqual(
    resolveAuthUserEntitlementView({ entitlement: { tier: "trial", entitled: false, delayMinutes: 15 } }),
    {
      role: "trial",
      entitled: false,
      delayMinutes: 15,
      planLabel: "Trial",
      planTone: "text-amber-300",
    },
  );

  assert.deepEqual(resolveAuthUserEntitlementView(undefined), {
    role: "free",
    entitled: false,
    delayMinutes: 0,
    planLabel: "Free",
    planTone: "text-zinc-500",
  });
});

test("resolveAuthUserDisplay normalizes name, login, and avatar fallbacks", () => {
  assert.deepEqual(
    resolveAuthUserDisplay({ name: "Analyst", login: "intelops", avatar_url: " https://example.com/a.png " }),
    {
      displayName: "Analyst",
      displayLogin: "@intelops",
      avatarUrl: "https://example.com/a.png",
      avatarLetter: "A",
    },
  );

  assert.deepEqual(
    resolveAuthUserDisplay({ login: "owner@example.com" }),
    {
      displayName: "owner@example.com",
      displayLogin: "owner@example.com",
      avatarUrl: "",
      avatarLetter: "O",
    },
  );

  assert.deepEqual(
    resolveAuthUserDisplay(null),
    {
      displayName: "User",
      displayLogin: "",
      avatarUrl: "",
      avatarLetter: "U",
    },
  );
});
