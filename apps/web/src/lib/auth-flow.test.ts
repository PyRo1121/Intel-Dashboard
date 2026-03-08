import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAbsoluteAuthProviderUrl,
  buildAuthModeSwitchHref,
  buildAuthPageHref,
  buildAuthProviderHref,
} from "@intel-dashboard/shared/auth-flow.ts";

test("buildAuthPageHref preserves next and error state", () => {
  assert.equal(buildAuthPageHref("login", null), "/login");
  assert.equal(buildAuthPageHref("signup", "/crm"), "/signup?next=%2Fcrm");
  assert.equal(
    buildAuthPageHref("login", "/billing", "security_check_required"),
    "/login?error=security_check_required&next=%2Fbilling",
  );
});

test("buildAuthProviderHref builds provider routes with optional next", () => {
  assert.equal(buildAuthProviderHref("github", "login", null), "/auth/login");
  assert.equal(buildAuthProviderHref("x", "signup", "/briefings"), "/auth/x/signup?next=%2Fbriefings");
});

test("buildAbsoluteAuthProviderUrl builds canonical absolute auth urls", () => {
  assert.equal(buildAbsoluteAuthProviderUrl("x", "login", null), "https://intel.pyro1121.com/auth/x/login");
  assert.equal(
    buildAbsoluteAuthProviderUrl("github", "signup", "/overview", "https://backend-e2e.pyro1121.com"),
    "https://backend-e2e.pyro1121.com/auth/signup?next=%2Foverview",
  );
});

test("buildAuthModeSwitchHref flips between login and signup while preserving next", () => {
  assert.equal(buildAuthModeSwitchHref("login", "/crm"), "/signup?next=%2Fcrm");
  assert.equal(buildAuthModeSwitchHref("signup", "/overview"), "/login?next=%2Foverview");
});
