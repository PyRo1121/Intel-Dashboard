import test from "node:test";
import assert from "node:assert/strict";
import { fetchIntelFeed } from "./intel-feed.ts";

test("fetchIntelFeed returns array payloads and falls back to empty on errors", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () =>
    new Response(JSON.stringify([{ id: "intel-1" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    const success = await fetchIntelFeed();
    assert.deepEqual(success, [{ id: "intel-1" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = (async () =>
    new Response("upstream down", { status: 503 })) as typeof fetch;
  try {
    const failure = await fetchIntelFeed();
    assert.deepEqual(failure, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

