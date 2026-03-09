import assert from "node:assert/strict";
import test from "node:test";
import { fetchOsintSourceProfile } from "./osint-source-client.ts";

test("fetchOsintSourceProfile returns payload on success and null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        generatedAt: "2026-03-09T12:00:00.000Z",
        source: {
          id: "gdelt",
          slug: "gdelt-project",
          name: "GDELT Project",
          trustTier: "core",
          latencyTier: "instant",
          sourceType: "dataset",
          subscriberValueScore: 90,
        },
        summary: {
          currentItemCount: 4,
          criticalCount: 1,
          highCount: 2,
          mediumCount: 1,
          lowCount: 0,
          regions: ["global"],
          categories: ["news"],
          verdict: "High-value rapid source",
        },
        recentItems: [],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal((await fetchOsintSourceProfile("gdelt-project"))?.source.name, "GDELT Project");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal(await fetchOsintSourceProfile("missing"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

