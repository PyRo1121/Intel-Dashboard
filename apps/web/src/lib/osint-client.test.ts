import test from "node:test";
import assert from "node:assert/strict";
import { fetchOsintItems } from "./osint-client.ts";

test("fetchOsintItems normalizes intel items and falls back to empty for invalid payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([
        {
          title: "<b>Alert</b> &amp; update",
          summary: "Alert &amp; update: <i>details</i>",
          source: "Example&nbsp;Feed",
          url: "https://example.com",
          timestamp: "2026-03-09T12:00:00.000Z",
          region: "global",
          category: "news",
          severity: "high",
        },
      ]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const items = await fetchOsintItems();
    assert.equal(items.length, 1);
    assert.equal(items[0]?.title, "Alert & update");
    assert.equal(items[0]?.summary, "details");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.deepEqual(await fetchOsintItems(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
