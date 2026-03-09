import test from "node:test";
import assert from "node:assert/strict";
import { callBillingAction, fetchBillingActivity, fetchBillingStatus } from "./billing-client.ts";

test("billing client helpers normalize status, activity, and action responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/billing/status")) {
        return new Response(JSON.stringify({ ok: true, result: { tier: "trial" } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/billing/activity")) {
        return new Response(JSON.stringify({ ok: true, result: { total: 2 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/billing/start-trial")) {
        return new Response(JSON.stringify({ ok: true, result: { trialStarted: true } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    assert.deepEqual(await fetchBillingStatus(), { ok: true, result: { tier: "trial" } });
    assert.deepEqual(await fetchBillingActivity(), { ok: true, result: { total: 2 } });
    assert.deepEqual(await callBillingAction("/api/billing/start-trial"), {
      ok: true,
      result: { trialStarted: true },
    });
    assert.deepEqual(await callBillingAction("/api/billing/forbidden"), {
      ok: false,
      error: "Forbidden",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
