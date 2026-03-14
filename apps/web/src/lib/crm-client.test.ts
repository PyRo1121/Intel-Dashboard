import test from "node:test";
import assert from "node:assert/strict";
import type { CrmAiTelemetryPayload, CrmCustomerOpsPayload, CrmOverviewPayload } from "@intel-dashboard/shared/crm.ts";
import { fetchCrmAiTelemetry, fetchCrmOverview, postCrmAction, readCrmItems } from "./crm-client.ts";

test("crm client helpers normalize overview, action, and telemetry responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/admin/crm/overview")) {
        return new Response(JSON.stringify({ ok: true, result: { generatedAtMs: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/admin/crm/customer")) {
        return new Response(JSON.stringify({ ok: true, result: { cache: { source: "crm_customer_cache" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/api/admin/crm/ai-telemetry")) {
        return new Response(JSON.stringify({ ok: true, result: { summary: { calls: 10 } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    assert.deepEqual(await fetchCrmOverview(), {
      ok: true,
      result: { generatedAtMs: 1 },
    } satisfies CrmOverviewPayload);
    assert.deepEqual(
      await postCrmAction("/api/admin/crm/customer", { targetUserId: "user-1" }),
      {
        ok: true,
        result: { cache: { source: "crm_customer_cache" } },
      } satisfies CrmCustomerOpsPayload,
    );
    assert.deepEqual(
      await fetchCrmAiTelemetry("1h"),
      {
        ok: true,
        result: { summary: { calls: 10 } },
      } satisfies CrmAiTelemetryPayload,
    );
    assert.deepEqual(
      await postCrmAction("/api/admin/crm/forbidden", {}),
      {
        ok: false,
        error: "Forbidden",
      } satisfies CrmCustomerOpsPayload,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("readCrmItems returns a stable array fallback", () => {
  assert.deepEqual(readCrmItems([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(readCrmItems(undefined), []);
});
