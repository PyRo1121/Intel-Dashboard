import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POST_AUTH_PATH } from "@intel-dashboard/shared/auth-next-routes.ts";
import { buildClientAuthHref, normalizeClientPostAuthPath } from "./auth-next.ts";

test("default post-auth path points to dashboard overview", () => {
  assert.equal(DEFAULT_POST_AUTH_PATH, "/overview");
});

test("normalizeClientPostAuthPath accepts only internal dashboard routes", () => {
  assert.equal(normalizeClientPostAuthPath("/crm"), "/crm");
  assert.equal(normalizeClientPostAuthPath("/telegram?focus=abc"), "/telegram?focus=abc");
  assert.equal(normalizeClientPostAuthPath("https://intel.pyro1121.com/overview"), "/overview");
  assert.equal(normalizeClientPostAuthPath("/login"), null);
  assert.equal(normalizeClientPostAuthPath("/"), null);
  assert.equal(normalizeClientPostAuthPath("https://evil.example/crm"), null);
});

test("buildClientAuthHref appends next parameter when present", () => {
  assert.equal(buildClientAuthHref("/auth/login", null), "/auth/login");
  assert.equal(buildClientAuthHref("/auth/login", "/crm"), "/auth/login?next=%2Fcrm");
  assert.equal(buildClientAuthHref("/login", "/telegram?focus=abc"), "/login?next=%2Ftelegram%3Ffocus%3Dabc");
});
