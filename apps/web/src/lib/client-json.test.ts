import test from "node:test";
import assert from "node:assert/strict";
import { fetchClientJson, fetchPublicJson } from "./client-json.ts";

test("fetchClientJson applies authenticated no-store defaults", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await fetchClientJson<{ ok: boolean }>("/api/example");
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, "/api/example");
    assert.equal(calls[0]?.init?.credentials, "include");
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchPublicJson applies no-store defaults without forcing credentials", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const result = await fetchPublicJson<{ ok: boolean }>("/api/public");
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.init?.cache, "no-store");
    assert.ok(calls[0]?.init?.signal instanceof AbortSignal);
    assert.equal(calls[0]?.init?.credentials, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchClientJson returns upstream error payloads when available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    const result = await fetchClientJson("/api/example");
    assert.deepEqual(result, { ok: false, status: 403, error: "Forbidden" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchClientJson normalizes network and invalid JSON failures", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  try {
    const network = await fetchClientJson("/api/example");
    assert.deepEqual(network, { ok: false, error: "network down" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  globalThis.fetch = (async () =>
    new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
  try {
    const invalid = await fetchClientJson("/api/example");
    assert.deepEqual(invalid, { ok: false, status: 200, error: "Invalid JSON response" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
