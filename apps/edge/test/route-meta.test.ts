import test from "node:test";
import assert from "node:assert/strict";
import {
  BILLING_TITLE,
  CRM_TITLE,
  OVERVIEW_TITLE,
  PRODUCTION_HOME_TITLE,
  resolveDashboardShellTitle,
} from "../../../packages/shared/route-meta.ts";

test("dashboard shell route title resolution is shared with worker", () => {
  assert.equal(PRODUCTION_HOME_TITLE, "SentinelStream OSINT Dashboard | Real-Time Geopolitical Intelligence Platform");
  assert.equal(resolveDashboardShellTitle("/overview"), OVERVIEW_TITLE);
  assert.equal(resolveDashboardShellTitle("/billing/settings"), BILLING_TITLE);
  assert.equal(resolveDashboardShellTitle("/crm/customer"), CRM_TITLE);
  assert.equal(resolveDashboardShellTitle("/something-else"), "SentinelStream");
});
