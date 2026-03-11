import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index.js";
import { DISABLED_OSINT_SOURCE_IDS, OSINT_SOURCE_CATALOG } from "./osint-sources.js";
import { FREE_FEED_DELAY_MINUTES } from "@intel-dashboard/shared/access-offers.ts";
import { BACKEND_LANDING_HERO, BACKEND_OPERATOR_CARDS, BACKEND_OPERATOR_PANEL, BACKEND_OPERATOR_PRICING } from "@intel-dashboard/shared/landing-content.ts";

describe("intel-dashboard backend worker", () => {
  it("excludes disabled OSINT sources from the active catalog", () => {
    const ids = new Set(OSINT_SOURCE_CATALOG.map((source) => source.id));
    for (const id of DISABLED_OSINT_SOURCE_IDS) {
      expect(ids.has(id)).toBe(false);
    }
    expect(ids.size).toBe(OSINT_SOURCE_CATALOG.length);
  });

  function expectSecurityHeaders(response: Response) {
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy") || "").toContain("geolocation=()");
    expect(response.headers.get("strict-transport-security") || "").toContain("max-age=");
    expect(response.headers.get("content-security-policy") || "").toContain("default-src 'self'");
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function createKvMapBinding(initial?: Record<string, unknown>): {
    data: Map<string, string>;
    binding: {
      get: (key: string) => Promise<string | null>;
      put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
      delete: (key: string) => Promise<void>;
      list: (options?: { prefix?: string; cursor?: string; limit?: number }) => Promise<{
        keys: Array<{ name: string }>;
        list_complete: boolean;
        cursor?: string;
      }>;
    };
  } {
    const data = new Map<string, string>();
    if (initial) {
      for (const [key, value] of Object.entries(initial)) {
        data.set(key, JSON.stringify(value));
      }
    }
    return {
      data,
      binding: {
        get: async (key: string) => data.get(key) ?? null,
        put: async (key: string, value: string) => {
          data.set(key, value);
        },
        delete: async (key: string) => {
          data.delete(key);
        },
        list: async (options) => {
          const prefix = options?.prefix ?? "";
          const limit = Math.max(1, Math.min(1000, Math.floor(options?.limit ?? 1000)));
          const keys = [...data.keys()]
            .filter((name) => name.startsWith(prefix))
            .sort();
          const startIndexRaw = Number.parseInt(options?.cursor ?? "0", 10);
          const startIndex = Number.isFinite(startIndexRaw) && startIndexRaw >= 0 ? startIndexRaw : 0;
          const page = keys.slice(startIndex, startIndex + limit).map((name) => ({ name }));
          const nextIndex = startIndex + page.length;
          const listComplete = nextIndex >= keys.length;
          return {
            keys: page,
            list_complete: listComplete,
            ...(listComplete ? {} : { cursor: String(nextIndex) }),
          };
        },
      },
    };
  }

  function readRssSourceHealthRecords(data: Map<string, string>): Array<{
    sourceId: string;
    status: string;
    lastCheckedAtMs: number;
    lastSuccessAtMs?: number;
    lastFailureAtMs?: number;
    lastHttpStatus?: number;
    lastError?: string;
    consecutiveFailures: number;
    lastItemCount: number;
  }> {
    return [...data.entries()]
      .filter(([key]) => key.includes(":news:rss:health:"))
      .map(([key, value]) => {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        return {
          sourceId: key.split(":").at(-1) ?? "",
          status: String(parsed.status ?? ""),
          lastCheckedAtMs: Number(parsed.lastCheckedAtMs ?? 0),
          consecutiveFailures: Number(parsed.consecutiveFailures ?? 0),
          lastItemCount: Number(parsed.lastItemCount ?? 0),
          ...(typeof parsed.lastSuccessAtMs === "number" ? { lastSuccessAtMs: parsed.lastSuccessAtMs } : {}),
          ...(typeof parsed.lastFailureAtMs === "number" ? { lastFailureAtMs: parsed.lastFailureAtMs } : {}),
          ...(typeof parsed.lastHttpStatus === "number" ? { lastHttpStatus: parsed.lastHttpStatus } : {}),
          ...(typeof parsed.lastError === "string" ? { lastError: parsed.lastError } : {}),
        };
      })
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  }

  function createWebhookDedupeCoordinatorNamespace() {
    const locks = new Map<string, { state: "processing" | "completed"; expiresAtMs: number }>();
    const fetch = vi.fn(async (_input?: RequestInfo | URL, init?: RequestInit) => {
      const rawBody = typeof init?.body === "string" ? init.body : "";
      const parsed = JSON.parse(rawBody) as { provider?: string; eventId?: string; action?: string };
      const provider = parsed.provider ?? "";
      const eventId = parsed.eventId ?? "";
      const action = parsed.action ?? "";
      const key = `${provider}:${eventId}`;
      const nowMs = Date.now();
      const existing = locks.get(key);

      if (action === "reserve") {
        if (existing && existing.expiresAtMs > nowMs) {
          return new Response(JSON.stringify({ ok: false, duplicate: true }), {
            status: 409,
            headers: { "content-type": "application/json" },
          });
        }
        locks.set(key, { state: "processing", expiresAtMs: nowMs + 300_000 });
        return new Response(JSON.stringify({ ok: true, result: { reserved: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (action === "complete") {
        locks.set(key, { state: "completed", expiresAtMs: nowMs + 7 * 24 * 60 * 60 * 1000 });
        return new Response(JSON.stringify({ ok: true, result: { completed: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (action === "release") {
        if (existing?.state === "processing") {
          locks.delete(key);
        }
        return new Response(JSON.stringify({ ok: true, result: { released: true } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: false, error: "invalid_action" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    });

    const namespace = {
      idFromName: vi.fn(() => ({ id: "global" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    return { namespace, fetch, locks };
  }

  async function buildStripeSignature(rawBody: string, secret: string, timestamp: number): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signedPayload = `${timestamp}.${rawBody}`;
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const bytes = new Uint8Array(signatureBuffer);
    let hex = "";
    for (const byte of bytes) {
      hex += byte.toString(16).padStart(2, "0");
    }
    return `t=${timestamp},v1=${hex}`;
  }

  it("returns 404 for non-endpoint paths", async () => {
    const response = await worker.fetch(new Request("https://backend.example.com/health"), {
      USAGE_BACKEND_BASE_URL: "https://origin.example.com",
    });

    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
  });

  it("enforces bearer token auth when configured", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "sessionExists", params: { sessionId: "s1" } }),
      }),
      {
        USAGE_BACKEND_BASE_URL: "https://origin.example.com",
        USAGE_DATA_SOURCE_TOKEN: "expected-token",
      },
    );

    expect(response.status).toBe(401);
    expectSecurityHeaders(response);
  });

  it("fails closed when usage token is not configured", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId: "u-1" }),
      }),
      {
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Server misconfiguration: USAGE_DATA_SOURCE_TOKEN is required.",
    });
  });

  it("forwards request to backend and clamps untrusted limits", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true, result: [{ timestamp: 1 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer gateway-token",
        },
        body: JSON.stringify({
          method: "loadSessionUsageTimeSeries",
          params: { sessionId: "session-1", agentId: "agent-1", maxPoints: 9001 },
        }),
      }),
      {
        USAGE_BACKEND_BASE_URL: "https://origin.example.com",
        USAGE_BACKEND_PATH: "rpc/usage",
        USAGE_DATA_SOURCE_TOKEN: "gateway-token",
        USAGE_BACKEND_TOKEN: "origin-token",
      },
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [_urlArg, initArg] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit | undefined];
    const body = typeof initArg?.body === "string" ? JSON.parse(initArg.body) : null;
    expect(body).toEqual({
      method: "loadSessionUsageTimeSeries",
      params: { sessionId: "session-1", agentId: "agent-1", maxPoints: 1000 },
    });
  });

  it("reads usage from kv mode and applies output bounds", async () => {
    const kvGet = vi.fn(async (key: string) => {
      if (key === "intel-dashboard:usage:cost-summary:1:2") {
        return JSON.stringify({ updatedAt: 1, days: 1, daily: [], totals: { totalTokens: 33 } });
      }
      if (key === "intel-dashboard:usage:session-logs:agent-a:s-1") {
        return JSON.stringify({
          logs: [
            { timestamp: 1, role: "assistant", content: "a" },
            { timestamp: 2, role: "assistant", content: "b" },
          ],
        });
      }
      return null;
    });

    const summaryResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: "loadCostUsageSummary", params: { startMs: 1, endMs: 2 } }),
      }),
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV: { get: kvGet },
      },
    );

    expect(summaryResponse.status).toBe(200);
    await expect(summaryResponse.json()).resolves.toMatchObject({ ok: true, result: { totals: { totalTokens: 33 } } });

    const logsResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: "loadSessionLogs",
          params: { sessionId: "s-1", agentId: "agent-a", limit: 1 },
        }),
      }),
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV: { get: kvGet },
      },
    );

    expect(logsResponse.status).toBe(200);
    await expect(logsResponse.json()).resolves.toMatchObject({
      ok: true,
      result: { logs: [{ content: "a" }] },
    });
  });

  it("supports authenticated seed writes", async () => {
    const putMock = vi.fn(async () => {});

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source/seed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          entries: [
            {
              key: "intel-dashboard:usage:cost-summary:1:2",
              value: { totals: { totalTokens: 10 } },
            },
          ],
        }),
      }),
      {
        USAGE_ADMIN_TOKEN: "admin-token",
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV_SEED_TTL_SECONDS: "600",
        USAGE_KV: {
          get: async () => null,
          put: putMock,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-json requests with 415", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "hello",
      }),
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV: { get: async () => null },
      },
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects oversized payloads with 413", async () => {
    const hugeBody = JSON.stringify({ method: "sessionExists", params: { sessionId: "x".repeat(3000) } });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(new TextEncoder().encode(hugeBody).length),
        },
        body: hugeBody,
      }),
      {
        USAGE_MAX_REQUEST_BYTES: "256",
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV: { get: async () => null },
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects oversized chunked JSON payloads without content-length", async () => {
    const hugeBody = JSON.stringify({ userId: "u-1", pad: "x".repeat(5_000) });
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(hugeBody));
        controller.close();
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: stream,
        duplex: "half",
      } as RequestInit),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        USAGE_MAX_REQUEST_BYTES: "256",
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("rejects oversized chunked raw payloads on webhook path", async () => {
    const hugeRaw = "x".repeat(4_096);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(hugeRaw));
        controller.close();
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
          "stripe-signature": "t=1,v1=abc",
        },
        body: stream,
        duplex: "half",
      } as RequestInit),
      {
        USAGE_MAX_REQUEST_BYTES: "128",
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("returns allow header on method-not-allowed responses", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "GET",
      }),
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_KV: { get: async () => null },
      },
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("queues seed writes asynchronously when enabled", async () => {
    const sendBatchMock = vi.fn(async () => {});
    const putMock = vi.fn(async () => {});

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source/seed", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          entries: [
            { key: "intel-dashboard:usage:cost-summary:1:2", value: { totals: { totalTokens: 1 } } },
            { key: "intel-dashboard:usage:discover:1:2", value: { sessions: [] } },
          ],
        }),
      }),
      {
        USAGE_ADMIN_TOKEN: "admin-token",
        USAGE_SEED_ASYNC: "true",
        USAGE_SEED_QUEUE: {
          sendBatch: sendBatchMock,
        },
        USAGE_KV: {
          get: async () => null,
          put: putMock,
        },
      },
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { queued: 2, batches: 1 },
    });
    expect(sendBatchMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledTimes(0);
  });

  it("writes analytics datapoint when analytics binding is configured", async () => {
    const analyticsWrite = vi.fn();

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/usage-data-source", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          method: "loadCostUsageSummary",
          params: { startMs: 1, endMs: 2 },
        }),
      }),
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_ANALYTICS_SAMPLE_RATE: "1",
        USAGE_ANALYTICS: {
          writeDataPoint: analyticsWrite,
        },
        USAGE_KV: {
          get: async () => JSON.stringify({ updatedAt: 1, days: 1, daily: [], totals: { totalTokens: 1 } }),
        },
      },
    );

    expect(response.status).toBe(200);
    expect(analyticsWrite).toHaveBeenCalledTimes(1);
  });

  it("processes async queue messages into kv writes", async () => {
    const putMock = vi.fn(async () => {});
    const ack1 = vi.fn();
    const ack2 = vi.fn();
    const retry1 = vi.fn();

    await worker.queue(
      {
        messages: [
          {
            body: {
              key: "intel-dashboard:usage:cost-summary:1:2",
              value: { totals: { totalTokens: 2 } },
              ttlSeconds: 600,
            },
            ack: ack1,
            retry: retry1,
          },
          {
            body: {
              key: "bad:key",
              value: {},
            },
            ack: ack2,
          },
        ],
      },
      {
        USAGE_KV_PREFIX: "intel-dashboard:usage",
        USAGE_KV: {
          get: async () => null,
          put: putMock,
        },
      },
    );

    expect(putMock).toHaveBeenCalledTimes(1);
    expect(ack1).toHaveBeenCalledTimes(1);
    expect(ack2).toHaveBeenCalledTimes(1);
    expect(retry1).toHaveBeenCalledTimes(0);
  });

  it("warms KV cache on scheduled events when enabled", async () => {
    const cachePut = vi.fn(async () => {});
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn(async () => undefined),
        put: cachePut,
      },
    });

    const analyticsWrite = vi.fn();
    await worker.scheduled(
      {
        cron: "*/10 * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_TTL_SECONDS: "30",
        USAGE_CACHE_WARM_ENABLED: "true",
        NEWS_RSS_INGEST_ENABLED: "false",
        USAGE_KV: {
          get: async () => null,
        },
        USAGE_ANALYTICS_SAMPLE_RATE: "1",
        USAGE_ANALYTICS: {
          writeDataPoint: analyticsWrite,
        },
      },
    );

    expect(cachePut).toHaveBeenCalled();
    expect(analyticsWrite.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("skips scheduled warmup when disabled", async () => {
    const cachePut = vi.fn(async () => {});
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn(async () => undefined),
        put: cachePut,
      },
    });

    await worker.scheduled(
      {
        cron: "*/10 * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_TTL_SECONDS: "30",
        USAGE_CACHE_WARM_ENABLED: "false",
        NEWS_RSS_INGEST_ENABLED: "false",
        USAGE_KV: {
          get: async () => null,
        },
      },
    );

    expect(cachePut).toHaveBeenCalledTimes(0);
  });

  it("caps RSS ingest fanout in free-tier mode", async () => {
    const kvData = new Map<string, string>();
    const fetchedUrls: string[] = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        fetchedUrls.push(url);
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      }),
    );

    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        FREE_TIER_MODE: "true",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "999",
        NEWS_RSS_ITEMS_PER_SOURCE: "999",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );

    expect(fetchedUrls.length).toBe(20);
  });

  it("does not silently default to free-tier RSS caps when FREE_TIER_MODE is unset", async () => {
    const kvData = new Map<string, string>();
    const fetchedUrls: string[] = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        fetchedUrls.push(url);
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      }),
    );

    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "36",
        NEWS_RSS_ITEMS_PER_SOURCE: "4",
        NEWS_RSS_ROTATION_WINDOW_SECONDS: "60",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );

    expect(fetchedUrls.length).toBe(36);
  });

  it("rotates the non-fast-lane RSS subset when the per-run budget exceeds the fast lane", async () => {
    const kvData = new Map<string, string>();
    const fetchedUrls: string[] = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        fetchedUrls.push(url);
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      }),
    );

    const nowSpy = vi.spyOn(Date, "now");

    nowSpy.mockReturnValue(1_000_000);
    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: 1_000_000,
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        FREE_TIER_MODE: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "36",
        NEWS_RSS_ITEMS_PER_SOURCE: "3",
        NEWS_RSS_ROTATION_WINDOW_SECONDS: "60",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );
    const firstRun = [...fetchedUrls];
    fetchedUrls.length = 0;

    nowSpy.mockReturnValue(1_061_000);
    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: 1_061_000,
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        FREE_TIER_MODE: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "36",
        NEWS_RSS_ITEMS_PER_SOURCE: "3",
        NEWS_RSS_ROTATION_WINDOW_SECONDS: "60",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );
    const secondRun = [...fetchedUrls];

    expect(firstRun.length).toBe(36);
    expect(secondRun.length).toBe(36);
    expect(secondRun.join("|")).not.toBe(firstRun.join("|"));
  });

  it("maintains regional diversity in free-tier RSS selection", async () => {
    const kvData = new Map<string, string>();
    const fetchedUrls: string[] = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        fetchedUrls.push(url);
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      }),
    );

    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        FREE_TIER_MODE: "true",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "20",
        NEWS_RSS_ITEMS_PER_SOURCE: "2",
        NEWS_RSS_ROTATION_WINDOW_SECONDS: "60",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );

    const regionByFeedUrl = new Map(
      OSINT_SOURCE_CATALOG.filter((source) => typeof source.feedUrl === "string" && source.feedUrl.length > 0).map(
        (source) => [source.feedUrl!, source.region.toLowerCase().replaceAll("-", "_")],
      ),
    );
    const regions = new Set(
      fetchedUrls
        .map((url) => regionByFeedUrl.get(url))
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );

    expect(fetchedUrls.length).toBe(20);
    expect(regions.size).toBeGreaterThanOrEqual(4);
  });

  it("includes all priority RSS sources when the per-run budget is high enough", async () => {
    const kvData = new Map<string, string>();
    const fetchedUrls: string[] = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        fetchedUrls.push(url);
        return new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        });
      }),
    );

    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        FREE_TIER_MODE: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "36",
        NEWS_RSS_ITEMS_PER_SOURCE: "4",
        NEWS_RSS_ROTATION_WINDOW_SECONDS: "60",
        NEWS_RSS_FETCH_CONCURRENCY: "12",
        USAGE_KV: {
          get: async (key: string) => kvData.get(key) ?? null,
          put: async (key: string, value: string) => {
            kvData.set(key, value);
          },
        },
      },
    );

    const prioritySources = OSINT_SOURCE_CATALOG.filter(
      (source) =>
        typeof source.feedUrl === "string" &&
        source.feedUrl.length > 0 &&
        [
          "aljazeera-world",
          "bbc-world",
          "cnn-world",
          "defense-news",
          "defense-one",
          "defence-blog",
          "dw-world",
          "euronews-world",
          "guardian-world",
          "insider-paper",
          "npr-world",
          "the-hindu-international",
          "war-on-the-rocks",
        ].includes(source.id),
    ).map((source) => source.feedUrl);

    for (const feedUrl of prioritySources) {
      expect(fetchedUrls).toContain(feedUrl);
    }
  });

  it("reuses RSS validators via conditional request headers", async () => {
    const kvData = new Map<string, string>();
    const requestHeaders: Array<Record<string, string> | Headers | undefined> = [];
    const feedXml =
      '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Headline</title><link>https://example.com/headline</link><description>Summary</description><pubDate>Wed, 04 Mar 2026 12:00:00 GMT</pubDate></item></channel></rss>';

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestHeaders.push(init?.headers as Record<string, string> | Headers | undefined);
        return new Response(feedXml, {
          status: 200,
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            etag: 'W/"rss-etag-1"',
            "last-modified": "Wed, 04 Mar 2026 12:00:00 GMT",
          },
        });
      }),
    );

    const env = {
      USAGE_STORAGE_MODE: "kv",
      USAGE_CACHE_WARM_ENABLED: "false",
      FREE_TIER_MODE: "false",
      NEWS_RSS_INGEST_ENABLED: "true",
      NEWS_RSS_SOURCES_PER_RUN: "1",
      NEWS_RSS_ITEMS_PER_SOURCE: "1",
      NEWS_RSS_VALIDATOR_TTL_SECONDS: "3600",
      USAGE_KV: {
        get: async (key: string) => kvData.get(key) ?? null,
        put: async (key: string, value: string) => {
          kvData.set(key, value);
        },
      },
    };

    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now(),
        noRetry: () => {},
      },
      env,
    );
    await worker.scheduled(
      {
        cron: "* * * * *",
        scheduledTime: Date.now() + 60_000,
        noRetry: () => {},
      },
      env,
    );

    const secondHeaders = requestHeaders[1];
    const getHeader = (name: string): string | undefined => {
      if (!secondHeaders) return undefined;
      if (secondHeaders instanceof Headers) return secondHeaders.get(name) ?? undefined;
      return secondHeaders[name];
    };

    expect(requestHeaders.length).toBe(2);
    expect(getHeader("if-none-match")).toBe('W/"rss-etag-1"');
    expect(getHeader("if-modified-since")).toBe("Wed, 04 Mar 2026 12:00:00 GMT");
  });

  it("records healthy RSS source health, exposes it via /sources, and resets failure counters after recovery", async () => {
    const kv = createKvMapBinding();
    const currentPubDate = new Date(Date.now()).toUTCString();
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
    const feedXml =
      `<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Recovered headline</title><link>https://example.com/recovered</link><description>Recovered summary</description><pubDate>${currentPubDate}</pubDate></item></channel></rss>`;
    fetchMock
      .mockResolvedValueOnce(new Response("upstream unavailable", { status: 503 }))
      .mockResolvedValue(
        new Response(feedXml, {
          status: 200,
          headers: { "content-type": "application/rss+xml; charset=utf-8" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      USAGE_STORAGE_MODE: "kv",
      USAGE_CACHE_WARM_ENABLED: "false",
      NEWS_RSS_INGEST_ENABLED: "true",
      NEWS_RSS_SOURCES_PER_RUN: "1",
      NEWS_RSS_ITEMS_PER_SOURCE: "1",
      NEWS_COORDINATOR_ENABLED: "false",
      NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
      USAGE_DATA_SOURCE_TOKEN: "api-token",
      USAGE_KV: kv.binding,
    };

    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController, env);
    let healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      status: "http_error",
      lastHttpStatus: 503,
      consecutiveFailures: 1,
      lastItemCount: 0,
    });

    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() + 60_000, noRetry: () => {} } as ScheduledController, env);
    healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords[0]).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
      lastItemCount: 1,
    });
    expect(healthRecords[0]?.lastSuccessAtMs).toBeGreaterThan(0);

    const recoveredSourceId = healthRecords[0]?.sourceId;
    expect(recoveredSourceId).toBeTruthy();

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/sources?limit=500", {
        method: "GET",
        headers: { authorization: "Bearer api-token" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    const decoded = (await response.json()) as {
      ok: boolean;
      result: {
        items: Array<{ id: string; health?: { status: string; consecutiveFailures: number; lastItemCount: number } }>;
        healthSummary: { checkedSourceCount: number; byStatus: Record<string, number>; failingSourceIds: string[] };
      };
    };
    expect(decoded.ok).toBe(true);
    expect(decoded.result.healthSummary.checkedSourceCount).toBe(1);
    expect(decoded.result.healthSummary.byStatus.healthy).toBe(1);
    expect(decoded.result.healthSummary.failingSourceIds).toEqual([]);
    expect(decoded.result.items.find((item) => item.id === recoveredSourceId)?.health).toMatchObject({
      status: "healthy",
      consecutiveFailures: 0,
      lastItemCount: 1,
    });
  });

  it("records not_modified RSS source health on 304 responses", async () => {
    const kv = createKvMapBinding();
    const currentPubDate = new Date(Date.now()).toUTCString();
    const feedXml =
      `<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><title>Cached headline</title><link>https://example.com/cached</link><description>Cached summary</description><pubDate>${currentPubDate}</pubDate></item></channel></rss>`;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(feedXml, {
          status: 200,
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            etag: 'W/"rss-etag-1"',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 304,
          headers: {
            etag: 'W/"rss-etag-1"',
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const env = {
      USAGE_STORAGE_MODE: "kv",
      USAGE_CACHE_WARM_ENABLED: "false",
      NEWS_RSS_INGEST_ENABLED: "true",
      NEWS_RSS_SOURCES_PER_RUN: "1",
      NEWS_RSS_ITEMS_PER_SOURCE: "1",
      NEWS_COORDINATOR_ENABLED: "false",
      NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
      USAGE_KV: kv.binding,
    };

    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController, env);
    await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() + 60_000, noRetry: () => {} } as ScheduledController, env);

    const healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      status: "not_modified",
      consecutiveFailures: 0,
      lastItemCount: 1,
    });
  });

  it("records parse_error RSS source health when an upstream response is not RSS or Atom", async () => {
    const kv = createKvMapBinding();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html><body>not a feed</body></html>", {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        })),
    );

    await worker.scheduled(
      { cron: "* * * * *", scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController,
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "1",
        NEWS_RSS_ITEMS_PER_SOURCE: "1",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );

    const healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      status: "parse_error",
      consecutiveFailures: 1,
      lastItemCount: 0,
      lastError: "Response did not look like RSS/Atom XML.",
    });
  });

  it("records timeout RSS source health when fetch aborts", async () => {
    const kv = createKvMapBinding();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      }),
    );

    await worker.scheduled(
      { cron: "* * * * *", scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController,
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "1",
        NEWS_RSS_ITEMS_PER_SOURCE: "1",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );

    const healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      status: "timeout",
      consecutiveFailures: 1,
      lastItemCount: 0,
    });
  });

  it("records network_error RSS source health and emits structured scheduled diagnostics", async () => {
    const kv = createKvMapBinding();
    const analyticsWrite = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hang up");
      }),
    );

    await worker.scheduled(
      { cron: "* * * * *", scheduledTime: Date.now(), noRetry: () => {} } as ScheduledController,
      {
        USAGE_STORAGE_MODE: "kv",
        USAGE_CACHE_WARM_ENABLED: "false",
        NEWS_RSS_INGEST_ENABLED: "true",
        NEWS_RSS_SOURCES_PER_RUN: "1",
        NEWS_RSS_ITEMS_PER_SOURCE: "1",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
        USAGE_ANALYTICS_SAMPLE_RATE: "1",
        USAGE_ANALYTICS: {
          writeDataPoint: analyticsWrite,
        },
      },
    );

    const healthRecords = readRssSourceHealthRecords(kv.data);
    expect(healthRecords).toHaveLength(1);
    expect(healthRecords[0]).toMatchObject({
      status: "network_error",
      consecutiveFailures: 1,
      lastItemCount: 0,
      lastError: "socket hang up",
    });
    expect(analyticsWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining([
          "/api/intel-dashboard/usage-data-source",
          "SCHEDULED",
          "rssIngest",
          expect.stringContaining("failed:1"),
          expect.stringContaining("outcome:failed"),
        ]),
        doubles: expect.arrayContaining([500, expect.any(Number), 1, 1, 0, 0]),
      }),
    );
  });

  it("enforces 30 minute news delay for free users", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "n1",
          title: "Latest",
          url: "https://example.com/latest",
          publishedAtMs: 1_000_000,
        },
        {
          id: "n2",
          title: "Older",
          url: "https://example.com/older",
          publishedAtMs: 1_000_000 - 40 * 60 * 1000,
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "user-1" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        NEWS_DELAY_MINUTES: "30",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "free",
        entitled: false,
        returned: 1,
        items: [{ id: "n2" }],
      },
    });
  });

  it("caps stored feed size and serves newest unlocked entries first", async () => {
    vi.spyOn(Date, "now").mockReturnValue(9_000_000);
    const kv = createKvMapBinding();

    const publish = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          merge: true,
          entries: [
            { id: "n-new-1", title: "new1", url: "https://example.com/new1", publishedAtMs: 9_000_000 },
            { id: "n-new-2", title: "new2", url: "https://example.com/new2", publishedAtMs: 8_995_000 },
            { id: "n-old-1", title: "old1", url: "https://example.com/old1", publishedAtMs: 7_100_000 },
            { id: "n-old-2", title: "old2", url: "https://example.com/old2", publishedAtMs: 7_000_000 },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_FEED_MAX_ITEMS: "3",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );
    expect(publish.status).toBe(200);
    await expect(publish.json()).resolves.toMatchObject({
      ok: true,
      result: {
        totalStored: 3,
        publishMode: "local_fallback",
        coordinator: {
          enabled: false,
          fallbackUsed: false,
        },
      },
    });

    const news = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "free-user", limit: 2 }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        NEWS_DELAY_MINUTES: "30",
        NEWS_FEED_MAX_ITEMS: "3",
        USAGE_KV: kv.binding,
      },
    );

    expect(news.status).toBe(200);
    await expect(news.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "free",
        returned: 1,
        items: [{ id: "n-old-1" }],
        nextLockedAtMs: 8_995_000,
      },
    });
  });

  it("uses durable coordinator for publish when binding is configured", async () => {
    const kv = createKvMapBinding();
    const coordinatorFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            published: 1,
            totalStored: 1,
            merged: true,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const coordinatorNamespace = {
      idFromName: vi.fn(() => ({ id: "global" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          merge: true,
          entries: [{ id: "n-coord-1", title: "coordinated", url: "https://example.com/c", publishedAtMs: 10_000 }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "true",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        NEWS_INGEST_COORDINATOR: coordinatorNamespace,
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        published: 1,
        totalStored: 1,
        merged: true,
        publishMode: "coordinator",
        coordinator: {
          enabled: true,
          fallbackUsed: false,
        },
      },
    });
    expect(coordinatorFetch).toHaveBeenCalledTimes(1);
    expect(kv.data.size).toBe(0);
  });

  it("falls back to local publish when durable coordinator fails", async () => {
    const kv = createKvMapBinding();
    const nowMs = Date.now();
    const coordinatorFetch = vi.fn(async () =>
      new Response("coordinator failed", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    );

    const coordinatorNamespace = {
      idFromName: vi.fn(() => ({ id: "global" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          merge: true,
          entries: [{ id: "n-coord-2", title: "fallback", url: "https://example.com/f", publishedAtMs: nowMs }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "true",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        NEWS_INGEST_COORDINATOR: coordinatorNamespace,
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        published: 1,
        totalStored: 1,
        merged: true,
        publishMode: "local_fallback",
        coordinator: {
          enabled: true,
          fallbackUsed: true,
          error: "Coordinator returned HTTP 500",
        },
      },
    });
    expect(coordinatorFetch).toHaveBeenCalledTimes(1);

    const persistedFeed = kv.data.get("intel-dashboard:usage:news:feed");
    expect(persistedFeed).toBeTruthy();
    const decoded = JSON.parse(persistedFeed ?? "[]") as Array<{ id: string }>;
    expect(decoded[0]?.id).toBe("n-coord-2");
  });

  it("returns 503 when coordinator fails and fallback is disabled", async () => {
    const kv = createKvMapBinding();
    const coordinatorFetch = vi.fn(async () =>
      new Response("coordinator failed", {
        status: 500,
        headers: { "content-type": "text/plain" },
      }),
    );

    const coordinatorNamespace = {
      idFromName: vi.fn(() => ({ id: "global:0" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          merge: true,
          shardKey: "global-conflict",
          entries: [{ id: "n-coord-err", title: "err", url: "https://example.com/e", publishedAtMs: 12_000 }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "true",
        NEWS_COORDINATOR_SHARD_COUNT: "4",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "false",
        NEWS_INGEST_COORDINATOR: coordinatorNamespace,
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(503);
    expect(kv.data.size).toBe(0);
  });

  it("prefers coordinator hot overlay for entitled news reads", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "kv-old-1",
          title: "Old KV",
          url: "https://example.com/kv-old",
          publishedAtMs: 11_000_000,
        },
      ],
      "intel-dashboard:billing:account:pro-user": {
        userId: "pro-user",
        status: "active",
        subscribedAtMs: 11_500_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 11_500_000,
      },
    });

    const coordinatorFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            items: [
              {
                id: "hot-1",
                title: "Hot DO",
                url: "https://example.com/hot",
                publishedAtMs: 11_999_900,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const coordinatorNamespace = {
      idFromName: vi.fn(() => ({ id: "global" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "pro-user", limit: 1 }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        NEWS_HOT_OVERLAY_ENABLED: "true",
        NEWS_INGEST_COORDINATOR: coordinatorNamespace,
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "subscriber",
        entitled: true,
        returned: 1,
        items: [{ id: "hot-1" }],
      },
    });
    expect(coordinatorFetch).toHaveBeenCalledTimes(1);
  });

  it("reuses coordinator hot overlay cache across repeated entitled reads", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "kv-old-1",
          title: "Old KV",
          url: "https://example.com/kv-old",
          publishedAtMs: 11_000_000,
        },
      ],
      "intel-dashboard:billing:account:pro-user": {
        userId: "pro-user",
        status: "active",
        subscribedAtMs: 11_500_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 11_500_000,
      },
    });

    const coordinatorFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            items: [
              {
                id: "hot-1",
                title: "Hot DO",
                url: "https://example.com/hot",
                publishedAtMs: 11_999_900,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const coordinatorNamespace = {
      idFromName: vi.fn(() => ({ id: "global" } as unknown as DurableObjectId)),
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const buildRequest = () =>
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "pro-user", limit: 1 }),
      });

    const env = {
      USAGE_DATA_SOURCE_TOKEN: "api-token",
      BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
      NEWS_HOT_OVERLAY_ENABLED: "true",
      NEWS_HOT_OVERLAY_CACHE_MS: "60000",
      NEWS_INGEST_COORDINATOR: coordinatorNamespace,
      USAGE_KV: kv.binding,
    };

    const first = await worker.fetch(buildRequest(), env);
    expect(first.status).toBe(200);
    const second = await worker.fetch(buildRequest(), env);
    expect(second.status).toBe(200);
    expect(coordinatorFetch.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("routes publish through sharded coordinator names when configured", async () => {
    const kv = createKvMapBinding();
    const idFromName = vi.fn((name: string) => ({ id: name } as unknown as DurableObjectId));
    const coordinatorFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          result: {
            published: 1,
            totalStored: 1,
            merged: true,
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const coordinatorNamespace = {
      idFromName,
      get: vi.fn(() => ({ fetch: coordinatorFetch } as unknown as DurableObjectStub)),
    } as unknown as DurableObjectNamespace;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          merge: true,
          shardKey: "middle-east",
          entries: [{ id: "n-shard-1", title: "Shard", url: "https://example.com/s", publishedAtMs: 13_000_000 }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "true",
        NEWS_COORDINATOR_NAME: "global",
        NEWS_COORDINATOR_SHARD_COUNT: "8",
        NEWS_INGEST_COORDINATOR: coordinatorNamespace,
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    expect(idFromName).toHaveBeenCalledTimes(1);
    const routedName = String(idFromName.mock.calls[0]?.[0] ?? "");
    expect(routedName.startsWith("global:")).toBe(true);
  });

  it("aggregates shard feed keys for entitled reads", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed:shard:global__0": [
        {
          id: "s0-1",
          title: "Shard 0",
          url: "https://example.com/s0",
          publishedAtMs: 15_000_000,
        },
      ],
      "intel-dashboard:usage:news:feed:shard:global__1": [
        {
          id: "s1-1",
          title: "Shard 1",
          url: "https://example.com/s1",
          publishedAtMs: 15_000_100,
        },
      ],
      "intel-dashboard:billing:account:shard-user": {
        userId: "shard-user",
        status: "active",
        subscribedAtMs: 14_000_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 14_000_000,
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "shard-user", limit: 2 }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        NEWS_COORDINATOR_SHARD_COUNT: "2",
        NEWS_HOT_OVERLAY_ENABLED: "false",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "subscriber",
        returned: 2,
        items: [{ id: "s1-1" }, { id: "s0-1" }],
      },
    });
  });

  it("does not read the base feed key when shard reads are enabled", async () => {
    const baseKey = "intel-dashboard:usage:news:feed";
    const shard0Key = "intel-dashboard:usage:news:feed:shard:global__0";
    const shard1Key = "intel-dashboard:usage:news:feed:shard:global__1";
    const kv = createKvMapBinding({
      [baseKey]: [
        {
          id: "base-1",
          title: "Base Feed",
          url: "https://example.com/base",
          publishedAtMs: 14_000_000,
        },
      ],
      [shard0Key]: [
        {
          id: "s0-1",
          title: "Shard 0",
          url: "https://example.com/s0",
          publishedAtMs: 15_000_000,
        },
      ],
      [shard1Key]: [
        {
          id: "s1-1",
          title: "Shard 1",
          url: "https://example.com/s1",
          publishedAtMs: 15_000_100,
        },
      ],
      "intel-dashboard:billing:account:shard-user": {
        userId: "shard-user",
        status: "active",
        subscribedAtMs: 14_000_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 14_000_000,
      },
    });

    const getCalls: string[] = [];
    const originalGet = kv.binding.get;
    kv.binding.get = async (key) => {
      getCalls.push(key);
      return originalGet(key);
    };

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "shard-user", limit: 2 }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        NEWS_COORDINATOR_SHARD_COUNT: "2",
        NEWS_COORDINATOR_NAME: "global",
        NEWS_HOT_OVERLAY_ENABLED: "false",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    expect(getCalls).not.toContain(baseKey);
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("hydrates /api/air-sea with live OpenSky aircraft tracks", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "n1",
          title: "Carrier task force transiting Red Sea",
          summary: "Naval movement observed near Bab-el-Mandeb.",
          source: "OSINT Wire",
          url: "https://example.com/n1",
          publishedAtMs: 1_710_000_000_000,
          severity: "high",
          region: "middle_east",
          category: "military_movement",
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            time: nowSec,
            states: [
              [
                "abc123",
                "RCH123 ",
                "United States",
                null,
                nowSec,
                35.1,
                32.2,
                10_000,
                false,
                230,
                120,
                3.5,
                null,
                11_000,
                "7700",
              ],
              [
                "def456",
                "CIVIL1 ",
                "Germany",
                null,
                nowSec,
                12.2,
                48.1,
                9_000,
                false,
                210,
                45,
                0.2,
                null,
                10_200,
                null,
              ],
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/air-sea"),
      {
        PUBLIC_FEED_ROUTES_ENABLED: "true",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      aviation: { source: string; emergencies: number; aircraft: Array<{ callsign: string; severity: string }> };
      stats: { aircraftCount: number };
    };
    expect(body.aviation.source).toContain("OpenSky");
    expect(body.aviation.emergencies).toBe(1);
    expect(body.stats.aircraftCount).toBeGreaterThan(0);
    expect(body.aviation.aircraft.some((item) => item.callsign === "RCH123" && item.severity === "critical")).toBe(
      true,
    );
    expect(kv.data.has("intel-dashboard:usage:airsea:aviation:snapshot")).toBe(true);
  });

  it("serves cached aviation snapshot when OpenSky fetch fails", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:usage:airsea:aviation:snapshot": {
        timestamp: new Date(now - 60_000).toISOString(),
        source: "OpenSky Network",
        emergencies: 0,
        aircraft: [
          {
            icao24: "feed01",
            callsign: "FORTE10",
            type: "ISR",
            country: "United States",
            region: "middle_east",
            squawk: "",
            latitude: 24.1,
            longitude: 54.4,
            altitudeFt: 51_000,
            speedKts: 330,
            heading: 210,
            verticalRateFpm: 0,
            onGround: false,
            severity: "high",
            tags: ["military"],
            description: "FORTE10 — United States",
            links: { adsbexchange: "https://globe.adsbexchange.com/?icao=feed01" },
          },
        ],
        fetchedAtMs: now - 5 * 60_000,
      },
    });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream unavailable", { status: 503 })));

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/air-sea"),
      {
        PUBLIC_FEED_ROUTES_ENABLED: "true",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      aviation: { source: string; aircraft: Array<{ callsign: string }> };
      stats: { aircraftCount: number };
    };
    expect(body.aviation.source).toContain("cached");
    expect(body.stats.aircraftCount).toBe(1);
    expect(body.aviation.aircraft[0]?.callsign).toBe("FORTE10");
  });

  it("serves filtered sources catalog and enforces auth", async () => {
    const unauthorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/sources?region=global", {
        method: "GET",
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
      },
    );
    expect(unauthorized.status).toBe(401);

    const response = await worker.fetch(
      new Request(
        "https://backend.example.com/api/intel-dashboard/sources?region=global&tags=dataset&limit=5",
        {
          method: "GET",
          headers: {
            authorization: "Bearer api-token",
          },
        },
      ),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
      },
    );

    expect(response.status).toBe(200);
    const decoded = (await response.json()) as {
      ok: boolean;
      result: {
        returned: number;
        total: number;
        items: Array<{
          id: string;
          region: string;
          tags: string[];
          acquisitionMethod: string;
          trustTier: string;
          latencyTier: string;
          sourceType: string;
        }>;
      };
    };
    expect(decoded.ok).toBe(true);
    expect(decoded.result.returned).toBeGreaterThan(0);
    expect(decoded.result.total).toBeGreaterThan(100);
    expect(decoded.result.items[0]?.region).toBe("global");
    expect(decoded.result.items[0]?.tags).toContain("dataset");
    expect(decoded.result.items[0]?.acquisitionMethod).toBeTruthy();
    expect(decoded.result.items[0]?.trustTier).toBeTruthy();
    expect(decoded.result.items[0]?.latencyTier).toBeTruthy();
    expect(decoded.result.items[0]?.sourceType).toBeTruthy();
  });

  it("serves public /api/intel feed with filtering", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "intel-1",
          title: "Missile strike reported",
          url: "https://example.com/missile",
          summary: "Missile strike reported near frontline.",
          source: "Example Wire",
          publishedAtMs: 1_700_000_000_000,
          severity: "high",
          region: "ukraine",
          category: "conflict",
        },
        {
          id: "intel-2",
          title: "Routine diplomatic briefing",
          url: "https://example.com/diplomatic",
          summary: "Routine diplomatic update.",
          source: "Example Wire",
          publishedAtMs: 1_699_000_000_000,
          severity: "low",
          region: "global",
          category: "news",
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel?severity=high&limit=5", {
        method: "GET",
      }),
      {
        USAGE_KV: kv.binding,
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ severity: string; region: string }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBe(1);
    expect(payload[0]?.severity).toBe("high");
    expect(payload[0]?.region).toBe("ukraine");
  });

  it("serves public /api/briefings generated from news feed", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: 1_700_000_100_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/briefings", {
        method: "GET",
      }),
      {
        USAGE_KV: kv.binding,
        BRIEFING_AI_WINDOWS: "0",
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ id: string; severity_summary: { critical: number } }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]?.id).toContain("briefing-");
    expect(payload[0]?.severity_summary.critical).toBeGreaterThanOrEqual(1);
  });

  it("serves cached AI briefings without requiring synchronous AI generation", async () => {
    const briefingWindowStart = 1_699_992_000_000;
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: briefingWindowStart + 10_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
      [`intel-dashboard:usage:briefing:${briefingWindowStart}`]: {
        windowStartMs: briefingWindowStart,
        windowHours: 4,
        content: "Cached AI briefing",
        severitySummary: { critical: 1, high: 0, medium: 0, low: 0 },
        eventCount: 1,
        generatedAtMs: briefingWindowStart + 20_000,
        mode: "ai",
        sourceHash: "cfe42430d6292117fae50ac5979166d0422af6271ad291d4d961c216050f12de",
      },
    });
    const send = vi.fn(async () => undefined);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/briefings", { method: "GET" }),
      {
        USAGE_KV: kv.binding,
        AI_JOB_QUEUE: { send },
        BRIEFING_AI_WINDOWS: "1",
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ content: string }>;
    expect(payload[0]?.content).toBe("Cached AI briefing");
    expect(send).not.toHaveBeenCalled();
  });

  it("returns fallback briefing content immediately and enqueues background refresh when the AI window is uncached", async () => {
    const briefingWindowStart = 1_699_992_000_000;
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: briefingWindowStart + 10_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
    });
    const send = vi.fn(async () => undefined);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/briefings", { method: "GET" }),
      {
        USAGE_KV: kv.binding,
        AI_JOB_QUEUE: { send },
        BRIEFING_AI_WINDOWS: "1",
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ content: string }>;
    expect(payload[0]?.content).toContain("INTELLIGENCE BRIEFING");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "briefing-refresh",
        windowStartMs: briefingWindowStart,
        windowHours: 4,
      }),
      undefined,
    );
  });

  it("does not reuse default cached briefing windows for filtered briefing requests", async () => {
    const briefingWindowStart = 1_699_992_000_000;
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: briefingWindowStart + 10_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
      [`intel-dashboard:usage:briefing:${briefingWindowStart}`]: {
        windowStartMs: briefingWindowStart,
        windowHours: 4,
        content: "Cached default briefing",
        severitySummary: { critical: 1, high: 0, medium: 0, low: 0 },
        eventCount: 1,
        generatedAtMs: briefingWindowStart + 20_000,
        mode: "ai",
        sourceHash: "cfe42430d6292117fae50ac5979166d0422af6271ad291d4d961c216050f12de",
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/briefings?severity=critical", { method: "GET" }),
      {
        USAGE_KV: kv.binding,
        BRIEFING_AI_WINDOWS: "1",
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ content: string }>;
    expect(payload[0]?.content).not.toBe("Cached default briefing");
    expect(payload[0]?.content).toContain("INTELLIGENCE BRIEFING");
  });

  it("keeps /api/briefings alive when refresh enqueue fails and does not persist a pending marker", async () => {
    const briefingWindowStart = 1_699_992_000_000;
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: briefingWindowStart + 10_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/briefings", { method: "GET" }),
      {
        USAGE_KV: kv.binding,
        AI_JOB_QUEUE: {
          send: async () => {
            throw new Error("queue down");
          },
        },
        BRIEFING_AI_WINDOWS: "1",
        PUBLIC_FEED_ROUTES_ENABLED: "true",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Array<{ content: string }>;
    expect(payload[0]?.content).toContain("INTELLIGENCE BRIEFING");
    expect(kv.data.has(`intel-dashboard:usage:briefing:pending:${briefingWindowStart}`)).toBe(false);
  });

  it("processes queued briefing refresh jobs and persists cached AI content", async () => {
    const briefingWindowStart = 1_699_992_000_000;
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "brief-1",
          title: "Drone strike near critical infrastructure",
          url: "https://example.com/drone",
          summary: "Infrastructure strike and emergency response underway.",
          source: "Example Desk",
          publishedAtMs: briefingWindowStart + 10_000,
          severity: "critical",
          region: "middle_east",
          category: "conflict",
        },
      ],
      [`intel-dashboard:usage:briefing:pending:${briefingWindowStart}`]: {
        windowStartMs: briefingWindowStart,
        windowHours: 4,
        sourceHash: "pending-hash",
        updatedAtMs: briefingWindowStart + 30_000,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (!url.includes("/compat/chat/completions")) {
          throw new Error(`unexpected fetch ${url}`);
        }
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "AI briefing content",
                },
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
              "cf-aig-cache-status": "MISS",
            },
          },
        );
      }),
    );

    await worker.queue(
      {
        messages: [
          {
            body: {
              kind: "briefing-refresh",
              windowStartMs: briefingWindowStart,
              windowHours: 4,
              sourceHash: "pending-hash",
            },
            ack: vi.fn(),
            retry: vi.fn(),
          },
        ],
      },
      {
        USAGE_KV: kv.binding,
        AI_GATEWAY_URL: "https://gateway.example.com/compat/chat/completions",
        AI_GATEWAY_TOKEN: "test-token",
      } as never,
    );

    const persistedRaw = kv.data.get(`intel-dashboard:usage:briefing:${briefingWindowStart}`);
    expect(persistedRaw).toBeTruthy();
    const persisted = JSON.parse(persistedRaw ?? "{}") as { content?: string; mode?: string };
    expect(persisted.content).toBe("AI briefing content");
    expect(persisted.mode).toBe("ai");
    expect(kv.data.has(`intel-dashboard:usage:briefing:pending:${briefingWindowStart}`)).toBe(false);
  });

  it("keeps public feed routes disabled by default", async () => {
    const intel = await worker.fetch(
      new Request("https://backend.example.com/api/intel", {
        method: "GET",
      }),
      {},
    );
    expect(intel.status).toBe(404);

    const briefings = await worker.fetch(
      new Request("https://backend.example.com/api/briefings", {
        method: "GET",
      }),
      {},
    );
    expect(briefings.status).toBe(404);
  });

  it("serves landing page on root and configured landing path", async () => {
    const root = await worker.fetch(new Request("https://backend.example.com/", { method: "GET" }), {});
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toContain("text/html");
    const rootHtml = await root.text();
    expect(rootHtml).toContain("Intel Dashboard");
    expect(rootHtml).toContain(BACKEND_LANDING_HERO.signInLabel);
    expect(rootHtml).toContain(BACKEND_OPERATOR_PANEL.heading);
    expect(rootHtml).toContain(BACKEND_OPERATOR_CARDS[0]?.title ?? "Source graph");
    expect(rootHtml).toContain(BACKEND_OPERATOR_PRICING.launchCheckoutLabel);
    expect(rootHtml).toContain('href="https://intel.pyro1121.com/auth/x/login"');

    const landing = await worker.fetch(
      new Request("https://backend.example.com/intel-dashboard", { method: "GET" }),
      {
        LANDING_PATH: "/intel-dashboard",
      },
    );
    expect(landing.status).toBe(200);
    const landingHtml = await landing.text();
    expect(landingHtml).toContain("Real-Time OSINT Intelligence Stream");
    expect(landingHtml).toContain(BACKEND_LANDING_HERO.continueLabel);
    expect(landingHtml).toContain(BACKEND_OPERATOR_PANEL.actions[0]?.label ?? "Check access");
    expect(landingHtml).toContain(BACKEND_OPERATOR_CARDS[1]?.title ?? "Shard-safe ingest");
    expect(landingHtml).toContain(BACKEND_OPERATOR_PRICING.summary);
    expect(landingHtml).toContain('href="https://intel.pyro1121.com/auth/x/login"');
  });

  it("returns user-info and owner override when configured", async () => {
    const unauthorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/user-info?userId=PyRo1121", {
        method: "GET",
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
      },
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/user-info?userId=PyRo1121", {
        method: "GET",
        headers: {
          authorization: "Bearer api-token",
        },
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "PyRo1121",
      },
    );
    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toMatchObject({
      ok: true,
      result: {
        userId: "PyRo1121",
        role: "owner",
        tier: "subscriber",
        entitled: true,
        ownerLifetimeAccess: true,
        subscription: {
          status: "owner",
          expiresAtMs: null,
          expiresLabel: "never",
          monthsRemaining: "infinite",
        },
      },
    });
  });

  it("bypasses checkout for owner user", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "PyRo1121" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "PyRo1121",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        owner: true,
        bypassCheckout: true,
        checkoutSessionId: null,
      },
    });
  });

  it("returns owner CRM summary snapshot", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: now,
      },
      "intel-dashboard:billing:account:user-b": {
        userId: "user-b",
        status: "trialing",
        monthlyPriceUsd: 8,
        trialEndsAtMs: now + 3 * 24 * 60 * 60 * 1000,
        updatedAtMs: now,
      },
      "intel-dashboard:billing:activity:user-a": [
        {
          id: "evt-trial",
          userId: "user-a",
          atMs: now - 5 * 60 * 1000,
          kind: "trial_started",
          source: "api",
        },
        {
          id: "evt-paid",
          userId: "user-a",
          atMs: now - 2 * 60 * 1000,
          kind: "subscription_set_active",
          source: "api",
        },
      ],
      "intel-dashboard:billing:activity:user-b": [
        {
          id: "evt-cancel",
          userId: "user-b",
          atMs: now - 60 * 60 * 1000,
          kind: "subscription_set_canceled",
          source: "api",
        },
      ],
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          trackedUsers: 2,
          statuses: {
            active: 1,
            trialing: 1,
          },
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
        },
        telemetry: {
          events24h: 3,
          events7d: 3,
          uniqueUsers24h: 2,
          uniqueUsers7d: 2,
          trialStarts7d: 1,
          paidStarts7d: 1,
          cancellations7d: 1,
          cancellations30d: 1,
        },
        commandCenter: {
          revenue: {
            arpuActiveUsd: 29,
          },
          funnel: {
            trialToPaidRate7dPct: 100,
            subscriberPenetrationPct: 50,
            trialingSharePct: 50,
          },
          risk: {
            cancellations7d: 1,
            churnRate30dPct: 100,
            netSubscriberDelta7d: 0,
          },
          activity: {
            uniqueUsers24h: 2,
            uniqueUsers7d: 2,
            events24h: 3,
            events7d: 3,
          },
        },
      },
    });
  });

  it("uses cached internal CRM summary snapshot when fresh", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:crm:summary": {
        generatedAtMs: now,
        billing: {
          trackedUsers: 1,
          statuses: {
            active: 1,
            trialing: 0,
            canceled: 0,
            expired: 0,
            none: 0,
          },
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
          accounts: [
            {
              userId: "user-a",
              status: "active",
              monthlyPriceUsd: 29,
              updatedAtMs: now,
            },
          ],
        },
        telemetry: {
          events24h: 2,
          events7d: 2,
          uniqueUsers24h: 1,
          uniqueUsers7d: 1,
          trialStarts7d: 0,
          paidStarts7d: 1,
          cancellations7d: 0,
          cancellations30d: 0,
          topKinds7d: [{ kind: "subscription_set_active", count: 1 }],
        },
        latestEvents: [
          {
            id: "evt-paid",
            userId: "user-a",
            atMs: now - 2 * 60 * 1000,
            kind: "subscription_set_active",
            source: "api",
          },
        ],
      },
    });
    kv.binding.list = vi.fn(async () => {
      throw new Error("crm summary should not enumerate KV when cache is fresh");
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        generatedAtMs: now,
        billing: {
          trackedUsers: 1,
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
        },
        telemetry: {
          events24h: 2,
          paidStarts7d: 1,
        },
      },
    });
  });

  it("uses maintained cached CRM summary even when it is older than the configured TTL", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:billing:crm:summary": {
        generatedAtMs: 100_000,
        billing: {
          trackedUsers: 1,
          statuses: {
            active: 1,
            trialing: 0,
            canceled: 0,
            expired: 0,
            none: 0,
          },
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
          accounts: [
            {
              userId: "user-a",
              status: "active",
              monthlyPriceUsd: 29,
              updatedAtMs: 100_000,
            },
          ],
        },
        telemetry: {
          events24h: 0,
          events7d: 1,
          uniqueUsers24h: 0,
          uniqueUsers7d: 1,
          trialStarts7d: 0,
          paidStarts7d: 1,
          cancellations7d: 0,
          cancellations30d: 0,
          topKinds7d: [{ kind: "subscription_set_active", count: 1 }],
        },
        latestEvents: [
          {
            id: "evt-paid",
            userId: "user-a",
            atMs: 100_000,
            kind: "subscription_set_active",
            source: "api",
          },
        ],
        degraded: {
          partial: false,
          accountsTruncated: false,
          activityTruncated: false,
          reasons: [],
        },
      },
    });
    kv.binding.list = vi.fn(async () => {
      throw new Error("crm summary should not enumerate KV when a maintained cache exists");
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        CRM_SUMMARY_CACHE_TTL_SECONDS: "1",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        generatedAtMs: 100_000,
        billing: {
          trackedUsers: 1,
          mrrActiveUsd: 29,
        },
        telemetry: {
          events7d: 1,
        },
      },
    });
  });

  it("invalidates cached CRM summary across billing trial writes so the next read rebuilds safely", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:billing:crm:summary": {
        generatedAtMs: 999_900,
        billing: {
          trackedUsers: 0,
          statuses: {
            active: 0,
            trialing: 0,
            canceled: 0,
            expired: 0,
            none: 0,
          },
          mrrActiveUsd: 0,
          arrActiveUsd: 0,
          accounts: [],
        },
        telemetry: {
          events24h: 0,
          events7d: 0,
          uniqueUsers24h: 0,
          uniqueUsers7d: 0,
          trialStarts7d: 0,
          paidStarts7d: 0,
          cancellations7d: 0,
          cancellations30d: 0,
          topKinds7d: [],
        },
        latestEvents: [],
        degraded: {
          partial: false,
          accountsTruncated: false,
          activityTruncated: false,
          reasons: [],
        },
        telemetryKindCounts7d: {},
      },
    });
    const originalList = kv.binding.list;
    const listSpy = vi.fn(async (options?: { prefix?: string; cursor?: string; limit?: number }) =>
      originalList(options),
    );
    kv.binding.list = listSpy;

    const startTrial = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/start-trial", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "user-a" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );
    expect(startTrial.status).toBe(200);
    expect(kv.data.has("intel-dashboard:billing:crm:summary")).toBe(false);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          trackedUsers: 1,
          statuses: {
            trialing: 1,
          },
        },
        telemetry: {
          events7d: 1,
          trialStarts7d: 1,
          uniqueUsers7d: 1,
        },
        degraded: {
          partial: false,
        },
      },
    });
    expect(listSpy).toHaveBeenCalled();
  });

  it("marks CRM summary as degraded when KV enumeration support is unavailable", async () => {
    const kv = createKvMapBinding();
    (kv.binding as { list?: typeof kv.binding.list }).list = undefined;

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        degraded: {
          partial: true,
          accountsTruncated: true,
          activityTruncated: true,
        },
      },
    });
  });

  it("warms CRM summary snapshot on scheduled runs without requiring Stripe live sync", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: 999_000,
      },
      "intel-dashboard:billing:activity:user-a": [
        {
          id: "evt-paid",
          userId: "user-a",
          atMs: 999_500,
          kind: "subscription_set_active",
          source: "api",
        },
      ],
    });

    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
      CRM_STRIPE_LIVE_ENABLED: "false",
    });

    const cached = kv.data.get("intel-dashboard:billing:crm:summary");
    expect(cached).toBeTruthy();
    const decoded = cached ? JSON.parse(cached) : null;
    expect(decoded?.billing?.trackedUsers).toBe(1);
    expect(decoded?.telemetry?.events7d).toBe(1);
  });

  it("counts CRM accounts and activity beyond the prior safety cap without truncation", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const entries: Record<string, unknown> = {};
    for (let index = 0; index < 2501; index += 1) {
      const userId = `user-${index}`;
      entries[`intel-dashboard:billing:account:${userId}`] = {
        userId,
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: 1_000_000 - index,
      };
      entries[`intel-dashboard:billing:activity:${userId}`] = [
        {
          id: `evt-${index}`,
          userId,
          atMs: 1_000_000 - index,
          kind: "subscription_set_active",
          source: "api",
        },
      ];
    }

    const kv = createKvMapBinding(entries);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        degraded: {
          partial: false,
          accountsTruncated: false,
          activityTruncated: false,
          reasons: [],
        },
        billing: {
          trackedUsers: 2501,
        },
        telemetry: {
          events7d: 2501,
        },
      },
    });
  });

  it("returns owner CRM AI telemetry snapshot", async () => {
    const analyticsFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              calls: 12,
              prompt_tokens: 120,
              completion_tokens: 48,
              total_tokens: 168,
              output_input_ratio: 0.4,
              avg_duration_ms: 210.5,
              p95_duration_ms: 480.2,
              failures: 1,
              cache_hits: 8,
              cache_misses: 4,
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", analyticsFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/ai-telemetry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", window: "1h" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        AI_TELEMETRY_QUERY_ACCOUNT_ID: "acct_123",
        AI_TELEMETRY_QUERY_API_TOKEN: "cf_api_token",
        AI_TELEMETRY_DATASET: "intel_dashboard_ai",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        window: "1h",
        summary: {
          calls: 12,
          promptTokens: 120,
          completionTokens: 48,
          totalTokens: 168,
          outputInputRatio: 0.4,
          failures: 1,
          cacheHits: 8,
          cacheMisses: 4,
        },
        lanes: [
          {
            label: "unknown",
            outputInputRatio: 0.4,
            p95DurationMs: 480.2,
            cacheHits: 8,
            cacheMisses: 4,
          },
        ],
      },
    });
    expect(analyticsFetch).toHaveBeenCalled();
  });

  it("fails closed when owner CRM AI telemetry query credentials are missing", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/ai-telemetry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", window: "15m" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "AI telemetry query credentials are not configured.",
    });
  });

  it("rejects invalid owner CRM AI telemetry windows", async () => {
    const analyticsFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              calls: 1,
              prompt_tokens: 10,
              completion_tokens: 4,
              total_tokens: 14,
              output_input_ratio: 0.4,
              avg_duration_ms: 100,
              p95_duration_ms: 100,
              failures: 0,
              cache_hits: 1,
              cache_misses: 0,
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", analyticsFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/ai-telemetry", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", window: "90m" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        AI_TELEMETRY_QUERY_ACCOUNT_ID: "acct_123",
        AI_TELEMETRY_QUERY_API_TOKEN: "cf_api_token",
        AI_TELEMETRY_DATASET: "intel_dashboard_ai",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        window: "24h",
      },
    });
  });

  it("uses live Stripe subscription metrics for CRM revenue when configured", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: now,
      },
      "intel-dashboard:billing:account:user-b": {
        userId: "user-b",
        status: "trialing",
        monthlyPriceUsd: 8,
        trialEndsAtMs: now + 3 * 24 * 60 * 60 * 1000,
        updatedAtMs: now,
      },
    });

    const stripeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      const auth = init?.headers instanceof Headers
        ? init.headers.get("authorization")
        : (init?.headers as Record<string, string> | undefined)?.authorization;
      expect(auth).toBe("Bearer sk_test_123");
      return new Response(
        JSON.stringify({
          object: "list",
          has_more: false,
          data: [
            {
              id: "sub_active_monthly",
              status: "active",
              customer: "cus_1",
              items: {
                data: [
                  {
                    quantity: 1,
                    price: {
                      currency: "usd",
                      unit_amount: 1200,
                      recurring: {
                        interval: "month",
                        interval_count: 1,
                      },
                    },
                  },
                ],
              },
            },
            {
              id: "sub_active_yearly",
              status: "active",
              customer: "cus_2",
              items: {
                data: [
                  {
                    quantity: 1,
                    price: {
                      currency: "usd",
                      unit_amount: 36000,
                      recurring: {
                        interval: "year",
                        interval_count: 1,
                      },
                    },
                  },
                ],
              },
            },
            {
              id: "sub_trial",
              status: "trialing",
              customer: "cus_3",
              items: {
                data: [
                  {
                    quantity: 2,
                    price: {
                      currency: "usd",
                      unit_amount: 500,
                      recurring: {
                        interval: "month",
                        interval_count: 1,
                      },
                    },
                  },
                ],
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          trackedUsers: 2,
          mrrActiveUsd: 42,
          arrActiveUsd: 504,
          stripe: {
            live: true,
            source: "stripe_live",
            subscriptionsTotal: 3,
            customersTotal: 3,
            statuses: {
              active: 2,
              trialing: 1,
            },
            mrrActiveUsd: 42,
            arrActiveUsd: 504,
          },
        },
        commandCenter: {
          revenue: {
            mrrActiveUsd: 42,
            arrActiveUsd: 504,
            arpuActiveUsd: 21,
            source: "stripe_live",
          },
        },
      },
    });
    expect(stripeFetch).toHaveBeenCalledTimes(1);
  });

  it("uses cached Stripe subscription metrics for CRM revenue when the snapshot is fresh", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: now,
      },
      "intel-dashboard:billing:crm:stripe-summary": {
        live: true,
        source: "stripe_live",
        syncedAtMs: now,
        subscriptionsTotal: 4,
        customersTotal: 3,
        statuses: {
          active: 2,
          trialing: 1,
          pastDue: 1,
          unpaid: 0,
          canceled: 0,
          incomplete: 0,
          incompleteExpired: 0,
          paused: 0,
          other: 0,
        },
        mrrActiveUsd: 42,
        mrrBillableUsd: 50,
        arrActiveUsd: 504,
        arrBillableUsd: 600,
        currencies: [{ currency: "usd", mrrMonthly: 50 }],
        apiBase: "https://api.stripe.com",
      },
    });

    const stripeFetch = vi.fn(async () => new Response("should not hit stripe", { status: 500 }));
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          stripe: {
            live: true,
            source: "stripe_cache",
            subscriptionsTotal: 4,
            mrrActiveUsd: 42,
          },
        },
        commandCenter: {
          revenue: {
            source: "stripe_cache",
            mrrActiveUsd: 42,
            arrActiveUsd: 504,
          },
        },
      },
    });
    expect(stripeFetch).toHaveBeenCalledTimes(0);
  });

  it("falls back to KV CRM revenue when Stripe live sync fails", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: now,
      },
    });

    const stripeFetch = vi.fn(async () => new Response("upstream down", { status: 503 }));
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
          stripe: {
            live: false,
            source: "internal_snapshot",
          },
        },
        commandCenter: {
          revenue: {
            mrrActiveUsd: 29,
            arrActiveUsd: 348,
            source: "internal_snapshot",
          },
        },
      },
    });
    expect(stripeFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to stale cached Stripe summary when live sync fails", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        updatedAtMs: now,
      },
      "intel-dashboard:billing:crm:stripe-summary": {
        live: true,
        source: "stripe_live",
        syncedAtMs: now - 10 * 60 * 1000,
        subscriptionsTotal: 2,
        customersTotal: 2,
        statuses: {
          active: 1,
          trialing: 0,
          pastDue: 0,
          unpaid: 0,
          canceled: 1,
          incomplete: 0,
          incompleteExpired: 0,
          paused: 0,
          other: 0,
        },
        mrrActiveUsd: 29,
        mrrBillableUsd: 29,
        arrActiveUsd: 348,
        arrBillableUsd: 348,
        currencies: [{ currency: "usd", mrrMonthly: 29 }],
        apiBase: "https://api.stripe.com",
      },
    });

    const stripeFetch = vi.fn(async () => new Response("upstream down", { status: 503 }));
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        CRM_STRIPE_CACHE_TTL_SECONDS: "60",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          stripe: {
            live: false,
            source: "stripe_cache_stale",
          },
          mrrActiveUsd: 29,
          arrActiveUsd: 348,
        },
        commandCenter: {
          revenue: {
            source: "internal_snapshot",
            mrrActiveUsd: 29,
          },
        },
      },
    });
    expect(stripeFetch).toHaveBeenCalledTimes(1);
  });

  it("returns safe zero command-center metrics with empty CRM data", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        billing: {
          trackedUsers: 0,
          mrrActiveUsd: 0,
          arrActiveUsd: 0,
        },
        telemetry: {
          events24h: 0,
          events7d: 0,
          uniqueUsers24h: 0,
          uniqueUsers7d: 0,
          trialStarts7d: 0,
          paidStarts7d: 0,
          cancellations7d: 0,
          cancellations30d: 0,
        },
        commandCenter: {
          revenue: {
            arpuActiveUsd: 0,
          },
          funnel: {
            trialToPaidRate7dPct: 0,
            subscriberPenetrationPct: 0,
            trialingSharePct: 0,
          },
          risk: {
            cancellations7d: 0,
            churnRate30dPct: 0,
            netSubscriberDelta7d: 0,
          },
          activity: {
            uniqueUsers24h: 0,
            uniqueUsers7d: 0,
            events24h: 0,
            events7d: 0,
          },
        },
      },
    });
  });

  it("returns owner CRM customer Stripe drill-down", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        updatedAtMs: now,
      },
    });

    const stripeFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/customers/cus_123")) {
        return new Response(
          JSON.stringify({
            id: "cus_123",
            email: "customer@example.com",
            name: "Customer A",
            currency: "usd",
            balance: 0,
            delinquent: false,
            created: Math.floor(now / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v1/invoices?")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "in_123",
                status: "paid",
                amount_due: 2900,
                amount_paid: 2900,
                paid: true,
                created: Math.floor(now / 1000),
                hosted_invoice_url: "https://stripe.test/in_123",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v1/charges?")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "ch_123",
                status: "succeeded",
                amount: 2900,
                amount_refunded: 0,
                paid: true,
                refunded: false,
                created: Math.floor(now / 1000),
                receipt_url: "https://stripe.test/ch_123",
                payment_intent: "pi_123",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v1/subscriptions/sub_123")) {
        return new Response(
          JSON.stringify({
            id: "sub_123",
            status: "active",
            cancel_at_period_end: false,
            current_period_end: Math.floor((now + 10 * 24 * 60 * 60 * 1000) / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/customer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", targetUserId: "user-a" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        targetUserId: "user-a",
        stripe: {
          customer: {
            id: "cus_123",
          },
          subscription: {
            id: "sub_123",
            status: "active",
          },
          invoices: [{ id: "in_123" }],
          charges: [{ id: "ch_123" }],
        },
      },
    });
    expect(stripeFetch).toHaveBeenCalledTimes(4);
  });

  it("cancels target subscription immediately from owner CRM action", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        updatedAtMs: now,
      },
    });

    const stripeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/subscriptions/sub_123") && init?.method === "DELETE") {
        return new Response(
          JSON.stringify({
            id: "sub_123",
            status: "canceled",
            canceled: true,
            canceled_at: Math.floor(now / 1000),
            current_period_end: Math.floor((now + 24 * 60 * 60 * 1000) / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/cancel-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", targetUserId: "user-a", atPeriodEnd: false }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        targetUserId: "user-a",
        subscriptionId: "sub_123",
        atPeriodEnd: false,
      },
    });

    const updatedRaw = kv.data.get("intel-dashboard:billing:account:user-a");
    expect(updatedRaw).toBeTruthy();
    const updated = updatedRaw ? (JSON.parse(updatedRaw) as { status?: string }) : null;
    expect(updated?.status).toBe("canceled");
  });

  it("reuses cached CRM customer snapshot for owner cancel and refund flows", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        updatedAtMs: now,
      },
      "intel-dashboard:billing:crm:customer:user-a": {
        fetchedAtMs: now,
        accountUpdatedAtMs: now,
        stripe: {
          customer: {
            id: "cus_123",
            email: "customer@example.com",
            name: "Customer A",
            currency: "usd",
            delinquent: false,
            createdAtMs: now,
            balanceUsd: 0,
          },
          subscription: {
            id: "sub_123",
            status: "active",
            cancelAtPeriodEnd: false,
            cancelAtMs: null,
            currentPeriodEndMs: now + 10 * 24 * 60 * 60 * 1000,
            canceledAtMs: null,
          },
          invoices: [],
          charges: [
            {
              id: "ch_123",
              status: "succeeded",
              amountUsd: 29,
              refundedUsd: 0,
              paid: true,
              refunded: false,
              createdAtMs: now,
              receiptUrl: "https://stripe.test/ch_123",
              paymentIntentId: "pi_123",
            },
          ],
        },
      },
    });

    const stripeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/subscriptions/sub_123") && init?.method === "DELETE") {
        return new Response(
          JSON.stringify({
            id: "sub_123",
            status: "canceled",
            canceled: true,
            canceled_at: Math.floor(now / 1000),
            current_period_end: Math.floor((now + 24 * 60 * 60 * 1000) / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/v1/refunds") && init?.method === "POST") {
        const body = String(init.body ?? "");
        expect(body).toContain("charge=ch_123");
        return new Response(
          JSON.stringify({
            id: "re_123",
            status: "succeeded",
            amount: 1450,
            charge: "ch_123",
            payment_intent: "pi_123",
            reason: "requested_by_customer",
            created: Math.floor(now / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", stripeFetch);

    const cancelResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/cancel-subscription", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", targetUserId: "user-a", atPeriodEnd: false }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );
    expect(cancelResponse.status).toBe(200);

    kv.data.set(
      "intel-dashboard:billing:crm:customer:user-a",
      JSON.stringify({
        fetchedAtMs: now,
        accountUpdatedAtMs: now,
        stripe: {
          customer: {
            id: "cus_123",
            email: "customer@example.com",
            name: "Customer A",
            currency: "usd",
            delinquent: false,
            createdAtMs: now,
            balanceUsd: 0,
          },
          subscription: {
            id: "sub_123",
            status: "active",
            cancelAtPeriodEnd: false,
            cancelAtMs: null,
            currentPeriodEndMs: now + 10 * 24 * 60 * 60 * 1000,
            canceledAtMs: null,
          },
          invoices: [],
          charges: [
            {
              id: "ch_123",
              status: "succeeded",
              amountUsd: 29,
              refundedUsd: 0,
              paid: true,
              refunded: false,
              createdAtMs: now,
              receiptUrl: "https://stripe.test/ch_123",
              paymentIntentId: "pi_123",
            },
          ],
        },
      }),
    );

    const refundResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/refund", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "owner-id", targetUserId: "user-a", amountUsd: 14.5 }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );
    expect(refundResponse.status).toBe(200);

    const urls = stripeFetch.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes("/v1/subscriptions?customer="))).toBe(false);
    expect(urls.some((url) => url.includes("/v1/charges?customer="))).toBe(false);
  });

  it("creates owner refund against a target charge", async () => {
    const now = Date.now();
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:user-a": {
        userId: "user-a",
        status: "active",
        monthlyPriceUsd: 29,
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        updatedAtMs: now,
      },
    });

    const stripeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/v1/refunds") && init?.method === "POST") {
        const body = String(init.body ?? "");
        expect(body).toContain("charge=ch_123");
        return new Response(
          JSON.stringify({
            id: "re_123",
            status: "succeeded",
            amount: 1450,
            charge: "ch_123",
            reason: "requested_by_customer",
            created: Math.floor(now / 1000),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/refund", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({
          userId: "owner-id",
          targetUserId: "user-a",
          chargeId: "ch_123",
          amountUsd: 14.5,
          reason: "requested_by_customer",
        }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        targetUserId: "user-a",
        refundId: "re_123",
        amountUsd: 14.5,
      },
    });
  });

  it("forbids CRM summary for non-owner user", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "non-owner" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns 400 for CRM summary payloads without userId", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/admin/crm/summary", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({}),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        OWNER_USER_IDS: "owner-id",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Expected non-empty userId.",
    });
  });

  it("enforces admin auth for ai jobs", async () => {
    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({
          jobs: [{ type: "dedupe", payload: { title: "a" } }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
      },
    );

    expect(response.status).toBe(401);
  });

  it("runs ai jobs in parallel with configured model", async () => {
    const aiFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const systemPrompt = String(body.messages?.[0]?.content ?? "");
      let content = "";
      if (systemPrompt.includes("dedupe_key")) {
        content = JSON.stringify({ dedupe_key: "same-story" });
      } else if (systemPrompt.includes("Translate the user text")) {
        content = "Hola mundo";
      } else {
        content = JSON.stringify({ label: "conflict", confidence: 0.93 });
      }

      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          maxConnections: 20,
          jobs: [
            {
              type: "dedupe",
              channel: "telegram",
              payload: { title: "Breaking", url: "https://example.com/a" },
            },
            {
              type: "translate",
              text: "Hello world",
              targetLanguage: "es",
            },
            {
              type: "classify",
              text: "Heavy fighting near the border.",
              labels: ["conflict", "diplomacy"],
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_PIPELINE_MAX_CONNECTIONS: "20",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);
    const decoded = (await response.json()) as {
      ok: boolean;
      result: {
        model: string;
        maxConnections: number;
        jobs: Array<{ ok: boolean; result?: Record<string, unknown> }>;
      };
    };

    expect(decoded.ok).toBe(true);
    expect(decoded.result.model).toBe("cerebras/gpt-oss-120b");
    expect(decoded.result.maxConnections).toBe(20);
    expect(decoded.result.jobs).toHaveLength(3);
    expect(decoded.result.jobs.every((job) => job.ok)).toBe(true);
    expect(decoded.result.jobs[0]?.result?.type).toBe("dedupe");
    expect(decoded.result.jobs[0]?.result?.lane).toBe("text");
    expect(decoded.result.jobs[0]?.result?.model).toBe("cerebras/gpt-oss-120b");
    expect(decoded.result.jobs[1]?.result?.type).toBe("translate");
    expect(decoded.result.jobs[1]?.result?.lane).toBe("text");
    expect(decoded.result.jobs[2]?.result?.type).toBe("classify");
    expect(decoded.result.jobs[2]?.result?.lane).toBe("text");

    for (const call of aiFetch.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      expect(body.model).toBe("cerebras/gpt-oss-120b");
      expect(body.max_completion_tokens ?? body.max_tokens).toBeDefined();
      if (body.response_format?.type === "json_object" || body.response_format?.type === "json_schema") {
        expect(body.reasoning_effort).toBe("low");
      }
    }
  });

  it("normalizes translate/classify text and uses strict schemas for JSON tasks", async () => {
    const aiFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const systemPrompt = String(body.messages?.[0]?.content ?? "");
      const content = systemPrompt.includes("Translate the user text")
        ? "Hola mundo"
        : JSON.stringify({ label: "conflict", confidence: 0.93 });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "translate",
              text: "Hello   world",
              targetLanguage: "es",
            },
            {
              type: "classify",
              text: "Heavy   fighting near the border.",
              labels: ["conflict", "diplomacy"],
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);

    const translateBody = JSON.parse(String((aiFetch.mock.calls[0]?.[1] as RequestInit).body));
    expect(translateBody.messages[1].content).toContain("Hello world");
    expect(translateBody.max_completion_tokens).toBeLessThanOrEqual(64);

    const classifyBody = JSON.parse(String((aiFetch.mock.calls[1]?.[1] as RequestInit).body));
    expect(classifyBody.messages[1].content).toContain("Heavy fighting near the border.");
    expect(classifyBody.response_format?.type).toBe("json_schema");
    expect(classifyBody.response_format?.json_schema?.name).toBe("classification");
    expect(classifyBody.reasoning_effort).toBe("low");
  });

  it("routes media dedupe jobs to the Groq Scout media lane", async () => {
    const aiFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ dedupe_key: "media-match" }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "dedupe",
              payload: {
                title: "Airfield strike footage",
                media: [
                  {
                    type: "image",
                    url: "https://cdn.example.com/strike-photo.jpg",
                  },
                ],
              },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_GATEWAY_MEDIA_MODEL: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      result: {
        jobs: Array<{ ok: boolean; result?: Record<string, unknown> }>;
      };
    };
    expect(payload.result.jobs[0]?.result?.lane).toBe("media");
    expect(payload.result.jobs[0]?.result?.model).toBe("groq/meta-llama/llama-4-scout-17b-16e-instruct");
    expect(payload.result.jobs[0]?.result?.mediaUsed).toBe(true);
    expect(payload.result.jobs[0]?.result?.mediaCount).toBe(1);

    const init = aiFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    expect(body.model).toBe("groq/meta-llama/llama-4-scout-17b-16e-instruct");
    expect(body.max_tokens).toBe(48);
    expect(Array.isArray(body.messages?.[1]?.content)).toBe(true);
    expect(body.messages?.[1]?.content?.some((part: { type?: string }) => part?.type === "image_url")).toBe(true);
  });

  it("escalates dedupe jobs to the GLM lane when the primary lane fails", async () => {
    const aiFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const model = String(body.model ?? "");
      const content =
        model === "cerebras/zai-glm-4.7" ? JSON.stringify({ dedupe_key: "escalated-match" }) : "{}";

      return new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "dedupe",
              preferEscalation: false,
              payload: { title: "Ambiguous repost", url: "https://example.com/ambiguous" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_GATEWAY_ESCALATION_MODEL: "cerebras/zai-glm-4.7",
        AI_DEDUPE_ESCALATION_ENABLED: "true",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      result: {
        jobs: Array<{ ok: boolean; result?: Record<string, unknown> }>;
      };
    };
    expect(payload.result.jobs[0]?.result?.lane).toBe("escalation");
    expect(payload.result.jobs[0]?.result?.model).toBe("cerebras/zai-glm-4.7");
    expect(payload.result.jobs[0]?.result?.escalationUsed).toBe(true);
    expect(aiFetch).toHaveBeenCalledTimes(2);
  });

  it("surfaces gateway rate-limit failures when dedupe falls back to hashing", async () => {
    const aiFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: [{ code: "2003", message: "Rate limited" }],
        }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "dedupe",
              payload: { title: "Rate limited dedupe", url: "https://example.com/rate-limited" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_GATEWAY_ESCALATION_MODEL: "cerebras/zai-glm-4.7",
        AI_DEDUPE_ESCALATION_ENABLED: "true",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      result: {
        jobs: Array<{ ok: boolean; result?: Record<string, unknown> }>;
      };
    };
    expect(payload.result.jobs[0]?.result?.lane).toBe("fallback_hash");
    expect(payload.result.jobs[0]?.result?.aiGatewayUsed).toBe(false);
    expect(payload.result.jobs[0]?.result?.fallbackReason).toBe("2003");
    expect(payload.result.jobs[0]?.result?.gatewayStatus).toBe(429);
    expect(payload.result.jobs[0]?.result?.gatewayErrorCode).toBe("2003");
    expect(payload.result.jobs[0]?.result?.gatewayErrorMessage).toBe("Rate limited");
    expect(aiFetch).toHaveBeenCalledTimes(2);
  });

  it("marks classify job failed when model returns a label outside allowed set", async () => {
    const aiFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ label: "other", confidence: 0.9 }) } }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "classify",
              text: "Fighting reported overnight.",
              labels: ["conflict", "diplomacy"],
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        jobs: [{ ok: false }],
      },
    });
  });

  it("writes AI telemetry datapoints for AI gateway calls when configured", async () => {
    const analyticsWrite = vi.fn();
    const aiFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          usage: {
            prompt_tokens: 12,
            completion_tokens: 6,
            total_tokens: 18,
          },
          choices: [{ message: { content: JSON.stringify({ dedupe_key: "same-story" }) } }],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
            "cf-aig-cache-status": "HIT",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "dedupe",
              channel: "telegram",
              payload: { title: "Breaking", url: "https://example.com/a" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_BATCH_PROVIDER: "internal",
        AI_TELEMETRY_SAMPLE_RATE: "1",
        AI_TELEMETRY: {
          writeDataPoint: analyticsWrite,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(analyticsWrite).toHaveBeenCalledTimes(1);
    expect(analyticsWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        indexes: ["backend:dedupe"],
        blobs: expect.arrayContaining(["backend", "dedupe", "text", "cerebras/gpt-oss-120b", "cerebras", "ok", "hit"]),
        doubles: expect.arrayContaining([200, 12, 6, 18, 0.5, 1]),
      }),
    );
  });

  it("distinguishes invalid JSON responses from transport failures in AI telemetry", async () => {
    const analyticsWrite = vi.fn();
    const aiFetch = vi.fn(async () =>
      new Response("not-json", {
        status: 200,
        headers: {
          "content-type": "application/json",
          "cf-aig-cache-status": "MISS",
        },
      }),
    );
    vi.stubGlobal("fetch", aiFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          jobs: [
            {
              type: "dedupe",
              channel: "telegram",
              payload: { title: "Breaking", url: "https://example.com/a" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_MODEL: "cerebras/gpt-oss-120b",
        AI_BATCH_PROVIDER: "internal",
        AI_TELEMETRY_SAMPLE_RATE: "1",
        AI_TELEMETRY: {
          writeDataPoint: analyticsWrite,
        },
      },
    );

    expect(response.status).toBe(200);
    expect(analyticsWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        blobs: expect.arrayContaining(["backend", "dedupe", "text", "cerebras/gpt-oss-120b", "cerebras", "invalid_json", "miss"]),
      }),
    );
  });

  it("submits async ai jobs and returns queued batch status", async () => {
    const kv = createKvMapBinding();
    const send = vi.fn(async () => undefined);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          async: true,
          jobs: [
            {
              type: "dedupe",
              channel: "telegram",
              payload: { title: "Repeated update", url: "https://example.com/repeated" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
        AI_JOB_QUEUE: {
          send,
        },
      },
    );

    expect(response.status).toBe(202);
    const payload = (await response.json()) as {
      ok: boolean;
      result: {
        id: string;
        status: string;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.result.id).toBeTruthy();
    expect(payload.result.status).toBe("queued");
    expect(send).toHaveBeenCalledTimes(1);

    const status = await worker.fetch(
      new Request(
        `https://backend.example.com/api/intel-dashboard/ai/jobs?batchId=${encodeURIComponent(payload.result.id)}`,
        {
          method: "GET",
          headers: {
            authorization: "Bearer admin-token",
          },
        },
      ),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({
      ok: true,
      result: {
        id: payload.result.id,
        status: "queued",
      },
    });
  });

  it("rolls back queued ai batch state and idempotency when enqueue fails", async () => {
    const kv = createKvMapBinding();

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          async: true,
          idempotencyKey: "batch-retry-key",
          jobs: [
            {
              type: "dedupe",
              payload: { title: "Repeated update", url: "https://example.com/repeated" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
        AI_JOB_QUEUE: {
          send: async () => {
            throw new Error("queue down");
          },
        },
      },
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("Failed to enqueue AI batch run"),
    });
    expect(kv.data.size).toBe(0);
  });

  it("serves ai job status from lightweight meta records without full state payload", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:meta:batch-meta-only": {
        id: "batch-meta-only",
        status: "submitted",
        createdAtMs: 10,
        updatedAtMs: 20,
        provider: "groq",
        maxConnections: 10,
        pollAttempts: 2,
        totalJobs: 40,
        externalBatchId: "ext-123",
      },
    });

    const response = await worker.fetch(
      new Request(
        "https://backend.example.com/api/intel-dashboard/ai/jobs?batchId=batch-meta-only",
        {
          method: "GET",
          headers: {
            authorization: "Bearer admin-token",
          },
        },
      ),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        id: "batch-meta-only",
        status: "submitted",
        provider: "groq",
        totalJobs: 40,
        externalBatchId: "ext-123",
      },
    });
  });

  it("processes queued internal ai batch run messages", async () => {
    const kv = createKvMapBinding();

    const submit = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/ai/jobs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          async: true,
          jobs: [
            {
              type: "dedupe",
              payload: { title: "One", url: "https://example.com/one" },
            },
            {
              type: "dedupe",
              payload: { title: "Two", url: "https://example.com/two" },
            },
          ],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
        AI_BATCH_PROVIDER: "internal",
      },
    );
    expect(submit.status).toBe(202);
    const submitPayload = (await submit.json()) as {
      result: {
        id: string;
      };
    };

    const ack = vi.fn();
    const retry = vi.fn();
    await worker.queue(
      {
        messages: [
          {
            body: {
              kind: "ai-batch-run",
              batchId: submitPayload.result.id,
            },
            ack,
            retry,
          },
        ],
      },
      {
        USAGE_KV: kv.binding,
        AI_BATCH_PROVIDER: "internal",
      },
    );

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();

    const status = await worker.fetch(
      new Request(
        `https://backend.example.com/api/intel-dashboard/ai/jobs?batchId=${encodeURIComponent(submitPayload.result.id)}`,
        {
          method: "GET",
          headers: {
            authorization: "Bearer admin-token",
          },
        },
      ),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_JOBS_PATH: "/api/intel-dashboard/ai/jobs",
        USAGE_KV: kv.binding,
      },
    );

    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({
      ok: true,
      result: {
        status: "completed",
        jobs: [{ ok: true }, { ok: true }],
      },
    });
  });

  it("does not resubmit groq batch when external batch id already exists", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-existing": {
        id: "batch-existing",
        status: "submitted",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "groq",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
        externalBatchId: "ext-123",
      },
    });

    const send = vi.fn(async () => undefined);
    const fetchMock = vi.fn(async () => new Response("unexpected fetch", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const ack = vi.fn();
    const retry = vi.fn();
    await worker.queue(
      {
        messages: [
          {
            body: {
              kind: "ai-batch-run",
              batchId: "batch-existing",
            },
            ack,
            retry,
          },
        ],
      },
      {
        USAGE_KV: kv.binding,
        AI_BATCH_PROVIDER: "groq",
        AI_JOB_QUEUE: { send },
        GROQ_API_KEY: "groq-secret",
      },
    );

    expect(ack).toHaveBeenCalledTimes(1);
    expect(retry).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      {
        kind: "ai-batch-poll",
        batchId: "batch-existing",
      },
      { delaySeconds: 60 },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retries groq run message when GROQ_API_BASE_URL is invalid", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-invalid-url": {
        id: "batch-invalid-url",
        status: "queued",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "groq",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
    });

    const ack = vi.fn();
    const retry = vi.fn();
    await worker.queue(
      {
        messages: [
          {
            body: {
              kind: "ai-batch-run",
              batchId: "batch-invalid-url",
            },
            ack,
            retry,
          },
        ],
      },
      {
        USAGE_KV: kv.binding,
        AI_BATCH_PROVIDER: "groq",
        AI_JOB_QUEUE: { send: async () => undefined },
        GROQ_API_KEY: "groq-secret",
        GROQ_API_BASE_URL: "http://evil.example.com",
      },
    );

    expect(ack).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("recovers stale AI batches from pending keys instead of scanning all state keys", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-stale": {
        id: "batch-stale",
        status: "queued",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "internal",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
      "intel-dashboard:ai-batch:pending:batch-stale": {
        id: "batch-stale",
        updatedAtMs: 10,
        status: "queued",
      },
      "intel-dashboard:ai-batch:state:batch-finished": {
        id: "batch-finished",
        status: "completed",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "internal",
        jobs: [],
        maxConnections: 10,
        pollAttempts: 0,
        results: [],
      },
    });

    const listCalls: string[] = [];
    const originalList = kv.binding.list;
    kv.binding.list = async (options) => {
      listCalls.push(options?.prefix ?? "");
      return originalList(options);
    };
    const send = vi.fn(async () => undefined);

    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      AI_JOB_QUEUE: { send },
      AI_BATCH_PROVIDER: "internal",
      AI_BATCH_POLL_DELAY_SECONDS: "60",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
    });

    expect(listCalls).toContain("intel-dashboard:ai-batch:pending:");
    expect(listCalls).not.toContain("intel-dashboard:ai-batch:state:");
    expect(send).toHaveBeenCalledWith({ kind: "ai-batch-run", batchId: "batch-stale" }, undefined);
  });

  it("does not refresh AI batch updatedAtMs when queue send fails during recovery", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-stale": {
        id: "batch-stale",
        status: "queued",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "internal",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
      "intel-dashboard:ai-batch:pending:batch-stale": {
        id: "batch-stale",
        updatedAtMs: 10,
        status: "queued",
      },
    });

    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      AI_JOB_QUEUE: {
        send: async () => {
          throw new Error("queue down");
        },
      },
      AI_BATCH_PROVIDER: "internal",
      AI_BATCH_POLL_DELAY_SECONDS: "60",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
    });

    const persisted = kv.data.get("intel-dashboard:ai-batch:state:batch-stale");
    expect(persisted).toBeTruthy();
    const decoded = persisted ? JSON.parse(persisted) : null;
    expect(decoded?.updatedAtMs).toBe(10);
  });

  it("recovers stale internal AI batches during scheduled runs even without a queue", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-stale": {
        id: "batch-stale",
        status: "queued",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "internal",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
      "intel-dashboard:ai-batch:pending:batch-stale": {
        id: "batch-stale",
        updatedAtMs: 10,
        status: "queued",
      },
    });

    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      AI_BATCH_PROVIDER: "internal",
      AI_BATCH_POLL_DELAY_SECONDS: "60",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
    });

    const persisted = kv.data.get("intel-dashboard:ai-batch:state:batch-stale");
    expect(persisted).toBeTruthy();
    const decoded = persisted ? JSON.parse(persisted) : null;
    expect(decoded?.status).toBe("completed");
    expect(decoded?.results).toHaveLength(1);
    expect(kv.data.has("intel-dashboard:ai-batch:pending:batch-stale")).toBe(false);
  });

  it("replays stale internal running AI batches during scheduled recovery without a queue", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-running": {
        id: "batch-running",
        status: "running",
        createdAtMs: 10,
        updatedAtMs: 10,
        provider: "internal",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
      "intel-dashboard:ai-batch:pending:batch-running": {
        id: "batch-running",
        updatedAtMs: 10,
        status: "running",
      },
    });

    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      AI_BATCH_PROVIDER: "internal",
      AI_BATCH_POLL_DELAY_SECONDS: "60",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
    });

    const persisted = kv.data.get("intel-dashboard:ai-batch:state:batch-running");
    expect(persisted).toBeTruthy();
    const decoded = persisted ? JSON.parse(persisted) : null;
    expect(decoded?.status).toBe("completed");
    expect(decoded?.results).toHaveLength(1);
    expect(kv.data.has("intel-dashboard:ai-batch:pending:batch-running")).toBe(false);
  });

  it("skips full state loads for fresh pending AI batches during recovery", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:ai-batch:state:batch-fresh": {
        id: "batch-fresh",
        status: "queued",
        createdAtMs: 900_000,
        updatedAtMs: 999_500,
        provider: "internal",
        jobs: [
          {
            type: "dedupe",
            payload: { title: "One", url: "https://example.com/one" },
          },
        ],
        maxConnections: 10,
        pollAttempts: 0,
      },
      "intel-dashboard:ai-batch:pending:batch-fresh": {
        id: "batch-fresh",
        updatedAtMs: 999_500,
        status: "queued",
      },
    });
    const getCalls: string[] = [];
    const originalGet = kv.binding.get;
    kv.binding.get = async (key) => {
      getCalls.push(key);
      return originalGet(key);
    };

    const send = vi.fn(async () => undefined);
    await worker.scheduled({} as ScheduledController, {
      USAGE_KV: kv.binding,
      AI_JOB_QUEUE: { send },
      AI_BATCH_PROVIDER: "internal",
      AI_BATCH_POLL_DELAY_SECONDS: "60",
      NEWS_RSS_INGEST_ENABLED: "false",
      USAGE_CACHE_WARM_ENABLED: "false",
    });

    expect(getCalls).toContain("intel-dashboard:ai-batch:pending:batch-fresh");
    expect(getCalls).not.toContain("intel-dashboard:ai-batch:state:batch-fresh");
    expect(send).not.toHaveBeenCalled();
  });

  it("starts trial with delayed news access", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "n1",
          title: "Latest",
          url: "https://example.com/latest",
          publishedAtMs: 2_000_000,
        },
      ],
    });

    const trialResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/start-trial", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "trial-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_TRIAL_DAYS: "7",
        BILLING_MONTHLY_PRICE_USD: "8",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );
    expect(trialResponse.status).toBe(200);

    const newsResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "trial-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(newsResponse.status).toBe(200);
    await expect(newsResponse.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "trial",
        entitled: false,
        returned: 0,
        items: [],
      },
    });
  });

  it("returns billing activity timeline after trial start", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_100_000);
    const kv = createKvMapBinding();

    const trialResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/start-trial", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "activity-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );
    expect(trialResponse.status).toBe(200);

    const activityResponse = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/activity", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "activity-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(activityResponse.status).toBe(200);
    await expect(activityResponse.json()).resolves.toMatchObject({
      ok: true,
      result: {
        userId: "activity-user",
        total: 1,
        events: [
          {
            kind: "trial_started",
            source: "api",
            status: "trialing",
          },
        ],
      },
    });
  });

  it("returns feature-gates snapshot with tier policy", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_500_000);
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:trial-user": {
        userId: "trial-user",
        status: "trialing",
        trialStartedAtMs: 2_000_000,
        trialEndsAtMs: 2_900_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 2_000_000,
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/feature-gates", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "trial-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        userId: "trial-user",
        tier: "trial",
        entitled: false,
        policy: {
          rateLimitPerMinute: 180,
          maxNewsItems: 100,
          delayMinutes: FREE_FEED_DELAY_MINUTES,
        },
        features: {
          instantNews: false,
          outboundDedupe: true,
        },
      },
    });
  });

  it("enforces per-tier minute rate limits", async () => {
    vi.spyOn(Date, "now").mockReturnValue(7_000_000);
    const kv = createKvMapBinding();

    const first = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/status", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "rate-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        FREE_RATE_LIMIT_PER_MINUTE: "1",
        USAGE_KV: kv.binding,
      },
    );
    expect(first.status).toBe(200);

    const second = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/status", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "rate-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        FREE_RATE_LIMIT_PER_MINUTE: "1",
        USAGE_KV: kv.binding,
      },
    );

    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBeTruthy();
  });

  it("blocks trial restart when retrial is disabled", async () => {
    vi.spyOn(Date, "now").mockReturnValue(8_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:retry-user": {
        userId: "retry-user",
        status: "expired",
        trialStartedAtMs: 7_000_000,
        trialEndsAtMs: 7_500_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 7_500_000,
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/start-trial", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "retry-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_ALLOW_RETRIAL: "false",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      result: {
        userId: "retry-user",
        trialEligible: false,
      },
    });
  });

  it("requires admin token for subscribe mutation and allows paid access", async () => {
    vi.spyOn(Date, "now").mockReturnValue(3_000_000);
    const kv = createKvMapBinding({
      "intel-dashboard:usage:news:feed": [
        {
          id: "n1",
          title: "Premium Immediate",
          url: "https://example.com/premium",
          publishedAtMs: 3_000_000,
        },
      ],
    });

    const unauthorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-admin",
        },
        body: JSON.stringify({ userId: "paid-user", active: true }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );
    expect(unauthorized.status).toBe(401);

    const subscribed = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({ userId: "paid-user", active: true }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        BILLING_MONTHLY_PRICE_USD: "8",
        USAGE_KV: kv.binding,
      },
    );
    expect(subscribed.status).toBe(200);

    const news = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "paid-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        USAGE_KV: kv.binding,
      },
    );
    expect(news.status).toBe(200);
    await expect(news.json()).resolves.toMatchObject({
      ok: true,
      result: {
        tier: "subscriber",
        entitled: true,
        returned: 1,
      },
    });
  });

  it("deduplicates outbound delivery in news publish flow", async () => {
    const kv = createKvMapBinding();
    const nowMs = Date.now();
    const outboundFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", outboundFetch);

    const payload = {
      entries: [
        {
          id: "n-out-1",
          title: "Breaking Intel",
          url: "https://example.com/breaking",
          publishedAtMs: nowMs,
        },
      ],
      outbound: {
        targets: [
          {
            channel: "telegram",
            endpointUrl: "https://relay.example.com/send",
            method: "POST",
            headers: { authorization: "Bearer relay-token" },
          },
        ],
        dedupeScope: "news-feed",
        dedupeTtlSeconds: 3600,
      },
    };

    const first = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify(payload),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      result: {
        published: 1,
        outbound: {
          attempted: 1,
          delivered: 1,
          skippedDuplicate: 0,
          failed: 0,
        },
      },
    });

    const second = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify(payload),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      result: {
        published: 1,
        outbound: {
          attempted: 1,
          delivered: 0,
          skippedDuplicate: 1,
          failed: 0,
        },
      },
    });
    expect(outboundFetch).toHaveBeenCalledTimes(1);
  });

  it("supports dedicated outbound publish route with admin auth", async () => {
    const kv = createKvMapBinding();
    const outboundFetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", outboundFetch);

    const unauthorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/outbound/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({
          entries: [
            {
              id: "n-out-2",
              title: "Outbound only",
              url: "https://example.com/outbound",
              publishedAtMs: 6_000_000,
            },
          ],
          targets: [{ channel: "telegram", endpointUrl: "https://relay.example.com/send" }],
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        USAGE_KV: kv.binding,
      },
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/outbound/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          entries: [
            {
              id: "n-out-2",
              title: "Outbound only",
              url: "https://example.com/outbound",
              publishedAtMs: 6_000_000,
            },
          ],
          targets: [{ channel: "telegram", endpointUrl: "https://relay.example.com/send" }],
          dedupeScope: "outbound-only",
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        USAGE_KV: kv.binding,
      },
    );

    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toMatchObject({
      ok: true,
      result: {
        attempted: 1,
        delivered: 1,
        skippedDuplicate: 0,
        failed: 0,
      },
    });
    expect(outboundFetch).toHaveBeenCalledTimes(1);
  });

  it("reuses one AI gateway fingerprint per item across multiple outbound targets", async () => {
    const kv = createKvMapBinding();
    const nowMs = Date.now();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("gateway.example.com")) {
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.["cf-aig-cache-key"]).toBeTruthy();
        expect(headers?.["cf-aig-cache-ttl"]).toBeTruthy();
        expect(headers?.["cf-aig-max-attempts"]).toBeTruthy();
        expect(headers?.["cf-aig-collect-log"]).toBe("false");
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ dedupe_key: "same-story" }),
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/news/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer admin-token",
        },
        body: JSON.stringify({
          entries: [
            {
              id: "n-ai-out-1",
              title: "Same event",
              url: "https://example.com/event",
              publishedAtMs: nowMs,
            },
          ],
          outbound: {
            targets: [
              { channel: "telegram", endpointUrl: "https://relay.example.com/tg", method: "POST" },
              { channel: "discord", endpointUrl: "https://relay.example.com/dc", method: "POST" },
            ],
            dedupeScope: "multi-target",
            dedupeTtlSeconds: 3600,
          },
        }),
      }),
      {
        BILLING_ADMIN_TOKEN: "admin-token",
        AI_GATEWAY_URL: "https://gateway.example.com/v1/chat/completions",
        AI_GATEWAY_CACHE_TTL_SECONDS: "600",
        NEWS_AI_ENRICH_ENABLED: "false",
        NEWS_COORDINATOR_ENABLED: "false",
        NEWS_COORDINATOR_ALLOW_FALLBACK: "true",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    const calls = fetchMock.mock.calls as Array<[RequestInfo | URL, RequestInit | undefined]>;
    const gatewayCalls = calls.filter((call) => {
      const url = typeof call[0] === "string" ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url;
      return url.includes("gateway.example.com");
    });
    const outboundCalls = calls.filter((call) => {
      const url = typeof call[0] === "string" ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url;
      return url.includes("relay.example.com");
    });
    expect(gatewayCalls).toHaveLength(1);
    expect(outboundCalls).toHaveLength(2);
  });

  it("creates Stripe checkout session for subscription", async () => {
    const kv = createKvMapBinding();
    const stripeFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.authorization).toBe("Bearer sk_test_123");
      expect(headers?.["content-type"]).toBe("application/x-www-form-urlencoded");
      const body = String(init?.body ?? "");
      expect(body).toContain("mode=subscription");
      expect(body).toContain("line_items%5B0%5D%5Bprice%5D=price_123");
      expect(body).toContain("client_reference_id=user-checkout");
      return new Response(
        JSON.stringify({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/pay/cs_test_123",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", stripeFetch);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "user-checkout" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_PRICE_ID: "price_123",
        STRIPE_SUCCESS_URL: "https://app.example.com/success",
        STRIPE_CANCEL_URL: "https://app.example.com/cancel",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        userId: "user-checkout",
        checkoutSessionId: "cs_test_123",
      },
    });
    const historyRaw = kv.data.get("intel-dashboard:billing:activity:user-checkout");
    const history = historyRaw ? (JSON.parse(historyRaw) as Array<Record<string, unknown>>) : [];
    expect(Array.isArray(history)).toBe(true);
    expect(history[0]?.kind).toBe("checkout_session_created");
  });

  it("creates Stripe customer portal session for active subscriber", async () => {
    const stripeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("/v1/billing_portal/sessions");
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.authorization).toBe("Bearer sk_test_123");
      expect(headers?.["content-type"]).toBe("application/x-www-form-urlencoded");
      const body = String(init?.body ?? "");
      expect(body).toContain("customer=cus_123");
      expect(body).toContain("return_url=https%3A%2F%2Fintel.pyro1121.com%2Fbilling");
      return new Response(
        JSON.stringify({
          id: "bps_123",
          url: "https://billing.stripe.com/p/session/test_123",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", stripeFetch);

    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:portal-user": {
        userId: "portal-user",
        status: "active",
        stripeCustomerId: "cus_123",
        subscribedAtMs: 4_200_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 4_200_000,
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/portal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "portal-user" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_PORTAL_RETURN_URL: "https://intel.pyro1121.com/billing",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: {
        userId: "portal-user",
        portalUrl: "https://billing.stripe.com/p/session/test_123",
      },
    });
  });

  it("returns conflict when portal is requested before Stripe customer is known", async () => {
    const kv = createKvMapBinding({
      "intel-dashboard:billing:account:portal-missing-customer": {
        userId: "portal-missing-customer",
        status: "active",
        subscribedAtMs: 4_200_000,
        monthlyPriceUsd: 8,
        updatedAtMs: 4_200_000,
      },
    });

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/portal", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer api-token",
        },
        body: JSON.stringify({ userId: "portal-missing-customer" }),
      }),
      {
        USAGE_DATA_SOURCE_TOKEN: "api-token",
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_PORTAL_RETURN_URL: "https://intel.pyro1121.com/billing",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "Billing portal unavailable for this account yet. Please retry in a few moments.",
    });
  });

  it("rejects Stripe webhook with invalid signature", async () => {
    const payload = {
      id: "evt_bad_sig",
      type: "checkout.session.completed",
      data: { object: { client_reference_id: "user-1" } },
    };

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=deadbeef",
        },
        body: JSON.stringify(payload),
      }),
      {
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        USAGE_KV: createKvMapBinding().binding,
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("processes Stripe checkout webhook and updates billing state idempotently", async () => {
    vi.spyOn(Date, "now").mockReturnValue(4_000_000);
    const kv = createKvMapBinding();
    const coordinator = createWebhookDedupeCoordinatorNamespace();
    const payload = {
      id: "evt_checkout_ok",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "stripe-user",
          metadata: { userId: "stripe-user" },
          customer: "cus_checkout_1",
          subscription: "sub_checkout_1",
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await buildStripeSignature(rawBody, "whsec_test", timestamp);

    const first = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      }),
      {
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        BILLING_MONTHLY_PRICE_USD: "8",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        NEWS_INGEST_COORDINATOR: coordinator.namespace,
        USAGE_KV: kv.binding,
      },
    );
    expect(first.status).toBe(200);

    const accountRaw = kv.data.get("intel-dashboard:billing:account:stripe-user");
    expect(accountRaw).toBeTruthy();
    const account = accountRaw ? (JSON.parse(accountRaw) as Record<string, unknown>) : null;
    expect(account?.status).toBe("active");
    expect(account?.stripeCustomerId).toBe("cus_checkout_1");
    expect(account?.stripeSubscriptionId).toBe("sub_checkout_1");
    const historyRaw = kv.data.get("intel-dashboard:billing:activity:stripe-user");
    const history = historyRaw ? (JSON.parse(historyRaw) as Array<Record<string, unknown>>) : [];
    expect(Array.isArray(history)).toBe(true);
    expect(history[0]?.kind).toBe("stripe_checkout_completed");

    const second = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      }),
      {
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        BILLING_MONTHLY_PRICE_USD: "8",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        NEWS_INGEST_COORDINATOR: coordinator.namespace,
        USAGE_KV: kv.binding,
      },
    );
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      result: { duplicate: true },
    });
    expect(coordinator.fetch).toHaveBeenCalledTimes(3);
  });

  it("fails closed when Stripe webhook dedupe coordinator binding is unavailable", async () => {
    vi.spyOn(Date, "now").mockReturnValue(4_000_000);
    const kv = createKvMapBinding();
    const payload = {
      id: "evt_checkout_without_coordinator",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "stripe-user",
          metadata: { userId: "stripe-user" },
          customer: "cus_checkout_1",
          subscription: "sub_checkout_1",
        },
      },
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await buildStripeSignature(rawBody, "whsec_test", timestamp);

    const response = await worker.fetch(
      new Request("https://backend.example.com/api/intel-dashboard/billing/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": signature,
        },
        body: rawBody,
      }),
      {
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        BILLING_MONTHLY_PRICE_USD: "8",
        BILLING_NAMESPACE_PREFIX: "intel-dashboard:billing",
        USAGE_KV: kv.binding,
      },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/dedupe unavailable/i),
    });
  });
});
