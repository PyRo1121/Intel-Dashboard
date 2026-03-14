import assert from "node:assert/strict";
import test from "node:test";
import { requiresSessionForApiPath } from "../src/api-session-routing.ts";

test("requiresSessionForApiPath exempts signed collector ingest", () => {
  assert.equal(requiresSessionForApiPath("/api/telegram/collector-ingest"), false);
  assert.equal(requiresSessionForApiPath("/api/intel-dashboard/billing/status"), false);
  assert.equal(requiresSessionForApiPath("/api/telegram"), true);
  assert.equal(requiresSessionForApiPath("/api/status"), true);
  assert.equal(requiresSessionForApiPath("/telegram"), false);
});
