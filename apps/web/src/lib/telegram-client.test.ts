import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_TELEGRAM_DATA,
  fetchTelegramDedupeFeedbackStatus,
  fetchTelegramFeed,
  fetchTelegramSourceHistory,
  fetchTelegramSourceLeaderboard,
  postTelegramDedupeFeedback,
  resolveTelegramFeedData,
} from "./telegram-client.ts";

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
    assert.ok(signals[1] instanceof AbortSignal);
    assert.notEqual(signals[1], controller.signal);
    controller.abort();
    assert.equal((signals[1] as AbortSignal).aborted, true);
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

test("fetchTelegramSourceLeaderboard returns payload on success and null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ window: "24h", generatedAt: "2026-03-09T12:00:00.000Z", entries: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.deepEqual(await fetchTelegramSourceLeaderboard("24h"), {
      window: "24h",
      generatedAt: "2026-03-09T12:00:00.000Z",
      entries: [],
    });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;
    assert.equal(await fetchTelegramSourceLeaderboard("7d"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchTelegramSourceHistory returns payload on success and null on failure", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({
        window: "24h",
        generatedAt: "2026-03-09T12:00:00.000Z",
        source: {
          channel: "alpha",
          label: "Alpha",
          category: "ukraine",
          trustTier: "core",
          latencyTier: "instant",
        },
        summary: {
          score: 88,
          leadCount: 2,
          duplicateCount: 1,
          recentFirstReports: 2,
          averageSignalScore: 82,
          duplicateRate: 0.25,
          topReasons: ["first", "fresh"],
          lastSeenAt: "2026-03-09T11:00:00.000Z",
          verdict: "High-value first reporter",
        },
        recentEvents: [],
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal((await fetchTelegramSourceHistory("alpha", "24h"))?.source.channel, "alpha");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal(await fetchTelegramSourceHistory("missing", "7d"), null);
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
