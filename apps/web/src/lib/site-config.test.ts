import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKEND_E2E_ORIGIN,
  INTERNAL_LANDING_TAGLINE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OPERATIONS_LABEL,
  SITE_ORIGIN,
  SITE_PLATFORM_LABEL,
  backendE2eUrl,
  siteUrl,
} from "../../shared/site-config.ts";

test("shared site config exposes canonical origin and metadata", () => {
  assert.equal(SITE_ORIGIN, "https://intel.pyro1121.com");
  assert.equal(BACKEND_E2E_ORIGIN, "https://backend-e2e.pyro1121.com");
  assert.equal(SITE_NAME, "SentinelStream");
  assert.equal(SITE_PLATFORM_LABEL, "Intelligence Platform");
  assert.equal(SITE_OPERATIONS_LABEL, "Intel Operations");
  assert.equal(INTERNAL_LANDING_TAGLINE, "Real-Time OSINT Intelligence Stream");
  assert.match(SITE_DESCRIPTION, /real-time osint dashboard/i);
});

test("siteUrl builds absolute canonical URLs", () => {
  assert.equal(siteUrl(), "https://intel.pyro1121.com/");
  assert.equal(siteUrl("/overview"), "https://intel.pyro1121.com/overview");
  assert.equal(siteUrl("osint"), "https://intel.pyro1121.com/osint");
  assert.equal(backendE2eUrl(), "https://backend-e2e.pyro1121.com/");
  assert.equal(backendE2eUrl("/api/intel-dashboard/user-info"), "https://backend-e2e.pyro1121.com/api/intel-dashboard/user-info");
});
