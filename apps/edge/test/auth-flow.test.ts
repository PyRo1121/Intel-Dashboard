import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAbsoluteAuthProviderUrl,
  buildAuthModeSwitchHref,
  buildAuthPageHref,
  buildAuthProviderHref,
} from "../../../packages/shared/auth-flow.ts";

test("buildAuthPageHref preserves next and optional error state", () => {
  assert.equal(buildAuthPageHref("login", null), "/login");
  assert.equal(buildAuthPageHref("signup", "/crm"), "/signup?next=%2Fcrm");
  assert.equal(
    buildAuthPageHref("login", "/billing", "security_check_required"),
    "/login?error=security_check_required&next=%2Fbilling",
  );
});

test("buildAuthProviderHref generates provider routes with next propagation", () => {
  assert.equal(buildAuthProviderHref("github", "login", null), "/auth/login");
  assert.equal(buildAuthProviderHref("x", "signup", "/briefings"), "/auth/x/signup?next=%2Fbriefings");
});

test("buildAbsoluteAuthProviderUrl generates absolute provider urls", () => {
  assert.equal(buildAbsoluteAuthProviderUrl("x", "login", null), "https://intel.pyro1121.com/auth/x/login");
  assert.equal(
    buildAbsoluteAuthProviderUrl("x", "signup", "/billing", "https://backend.example.com"),
    "https://backend.example.com/auth/x/signup?next=%2Fbilling",
  );
});

test("buildAuthModeSwitchHref flips login/signup while preserving next", () => {
  assert.equal(buildAuthModeSwitchHref("login", "/crm"), "/signup?next=%2Fcrm");
  assert.equal(buildAuthModeSwitchHref("signup", "/overview"), "/login?next=%2Foverview");
});
