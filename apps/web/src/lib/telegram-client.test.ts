import test from "node:test";
import assert from "node:assert/strict";
import { fetchTelegramDedupeFeedbackStatus, fetchTelegramFeed, postTelegramDedupeFeedback } from "./telegram-client.ts";

test("fetchTelegramFeed returns payload on success and null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let firstSignal: AbortSignal | null | undefined;
    globalThis.fetch = (async (_input, init) => {
      firstSignal = init?.signal as AbortSignal | null | undefined;
      return new Response(JSON.stringify({ timestamp: "2026-03-09T12:00:00.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    assert.deepEqual(await fetchTelegramFeed<{ timestamp: string }>(), { timestamp: "2026-03-09T12:00:00.000Z" });
    assert.ok(firstSignal instanceof AbortSignal);

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.equal(await fetchTelegramFeed<{ timestamp: string }>(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("telegram client respects caller signal without disabling default requests", async () => {
  const originalFetch = globalThis.fetch;
  const signals: Array<AbortSignal | null | undefined> = [];
  try {
    globalThis.fetch = (async (_input, init) => {
      signals.push(init?.signal as AbortSignal | null | undefined);
      return new Response(JSON.stringify({ count: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const controller = new AbortController();
    await fetchTelegramDedupeFeedbackStatus();
    await fetchTelegramDedupeFeedbackStatus(controller.signal);

    assert.ok(signals[0] instanceof AbortSignal);
    assert.equal(signals[1], controller.signal);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchTelegramDedupeFeedbackStatus normalizes owner capability and count", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ count: 7.9 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.deepEqual(await fetchTelegramDedupeFeedbackStatus(), { ownerEnabled: true, count: 7 });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.deepEqual(await fetchTelegramDedupeFeedbackStatus(), { ownerEnabled: false, count: 0 });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.equal(await fetchTelegramDedupeFeedbackStatus(), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("postTelegramDedupeFeedback sends the expected action payload", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = "";
  try {
    globalThis.fetch = (async (_input, init) => {
      capturedBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const result = await postTelegramDedupeFeedback({
      action: "merge",
      signatures: ["sig-1", "sig-2"],
      targetCluster: "cluster-a",
    });

    assert.equal(result.ok, true);
    assert.equal(
      capturedBody,
      JSON.stringify({ action: "merge", signatures: ["sig-1", "sig-2"], targetCluster: "cluster-a" }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
