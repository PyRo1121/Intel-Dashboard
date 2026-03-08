import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POST_AUTH_PATH } from "../../../packages/shared/auth-next-routes.ts";
import { getDashboardAppRoutePrefixes, normalizeSafePostAuthPath } from "../src/post-auth-path.ts";

test("default post-auth path points to dashboard overview", () => {
  assert.equal(DEFAULT_POST_AUTH_PATH, "/overview");
});

test("getDashboardAppRoutePrefixes exposes the allowed dashboard route roots", () => {
  assert.deepEqual(getDashboardAppRoutePrefixes(), [
    "/overview",
    "/osint",
    "/telegram",
    "/map",
    "/air-sea",
    "/briefings",
    "/billing",
    "/crm",
  ]);
});

test("normalizeSafePostAuthPath accepts only safe internal dashboard routes", () => {
  assert.equal(normalizeSafePostAuthPath("/crm"), "/crm");
  assert.equal(normalizeSafePostAuthPath("/telegram?focus=abc"), "/telegram?focus=abc");
  assert.equal(normalizeSafePostAuthPath("https://intel.pyro1121.com/overview"), "/overview");
  assert.equal(normalizeSafePostAuthPath("/login"), null);
  assert.equal(normalizeSafePostAuthPath("/"), null);
  assert.equal(normalizeSafePostAuthPath("https://evil.example/crm"), null);
});
