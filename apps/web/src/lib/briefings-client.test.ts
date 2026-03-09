import test from "node:test";
import assert from "node:assert/strict";
import { fetchBriefings } from "./briefings-client.ts";

test("fetchBriefings returns array payloads and falls back to empty on invalid responses", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify([
        {
          id: "brief-1",
          timestamp: "2026-03-09T12:00:00.000Z",
          content: "Briefing content",
          severity_summary: { critical: 1, high: 0, medium: 2, low: 3 },
        },
      ]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const list = await fetchBriefings();
    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, "brief-1");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.deepEqual(await fetchBriefings(), []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
