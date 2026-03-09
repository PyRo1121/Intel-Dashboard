import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TELEGRAM_DATA,
  fetchTelegramDedupeFeedbackStatus,
  fetchTelegramFeed,
  postTelegramDedupeFeedback,
  resolveTelegramFeedData,
} from "./telegram-client.ts";

test("fetchTelegramFeed returns payload on success and null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ timestamp: "2026-03-09T12:00:00.000Z" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.deepEqual(await fetchTelegramFeed<{ timestamp: string }>(), { timestamp: "2026-03-09T12:00:00.000Z" });

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

test("resolveTelegramFeedData provides a stable empty feed fallback", () => {
  const populated = {
    ...EMPTY_TELEGRAM_DATA,
    timestamp: "2026-03-09T12:00:00.000Z",
    total_messages: 3,
  };

  assert.equal(resolveTelegramFeedData(populated).timestamp, "2026-03-09T12:00:00.000Z");
  assert.equal(resolveTelegramFeedData(null), EMPTY_TELEGRAM_DATA);
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
