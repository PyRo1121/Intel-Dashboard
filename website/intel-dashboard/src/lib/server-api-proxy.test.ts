import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import type { APIEvent } from "@solidjs/start/server";
import { proxyAuthenticatedApi } from "./server-api-proxy.ts";

const ORIGINAL_PROXY_ORIGIN = process.env.INTEL_EDGE_PROXY_ORIGIN;

function buildEvent(request: Request): APIEvent {
  return { request } as APIEvent;
}

describe("proxyAuthenticatedApi", () => {
  beforeEach(() => {
    delete process.env.INTEL_EDGE_PROXY_ORIGIN;
  });

  afterEach(() => {
    if (typeof ORIGINAL_PROXY_ORIGIN === "string") {
      process.env.INTEL_EDGE_PROXY_ORIGIN = ORIGINAL_PROXY_ORIGIN;
    } else {
      delete process.env.INTEL_EDGE_PROXY_ORIGIN;
    }
  });

  it("passes through unauthenticated upstream responses", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      const response = await proxyAuthenticatedApi(
        buildEvent(new Request("https://localhost:3200/api/intel")),
        "/api/intel",
      );

      assert.equal(response.status, 401);
      const payload = await response.json();
      assert.equal(payload.error, "Unauthorized");
      assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
      assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
      assert.equal(response.headers.get("Vary"), "Origin, Cookie, Authorization");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("proxies authenticated local requests to the canonical edge origin", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: input instanceof Request ? input.url : String(input), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    try {
      const response = await proxyAuthenticatedApi(
        buildEvent(new Request("https://localhost:3200/api/intel?limit=5", {
          headers: {
            Cookie: "__Secure-better-auth.session_token=test-cookie",
            Authorization: "Bearer test",
            Accept: "application/json",
          },
        })),
        "/api/intel",
      );

      assert.equal(response.status, 200);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, "https://intel.pyro1121.com/api/intel?limit=5");
      assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
      assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
      assert.equal(response.headers.get("Vary"), "Origin, Cookie, Authorization");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("fails closed on the production host when no explicit proxy origin is configured", async () => {
    const response = await proxyAuthenticatedApi(
      buildEvent(new Request("https://intel.pyro1121.com/api/intel", {
        headers: {
          Cookie: "__Secure-better-auth.session_token=test-cookie",
        },
      })),
      "/api/intel",
    );

    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error, "API proxy misconfigured");
    assert.match(String(payload.detail || ""), /INTEL_EDGE_PROXY_ORIGIN is required/);
  });

  it("rejects untrusted explicit proxy origins", async () => {
    process.env.INTEL_EDGE_PROXY_ORIGIN = "https://evil.example.com";

    const response = await proxyAuthenticatedApi(
      buildEvent(new Request("https://localhost:3200/api/intel", {
        headers: {
          Cookie: "__Secure-better-auth.session_token=test-cookie",
        },
      })),
      "/api/intel",
    );

    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.error, "API proxy misconfigured");
    assert.match(String(payload.detail || ""), /canonical edge origin or a loopback dev host/);
  });

  it("returns a controlled 502 when the upstream fetch fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch;

    try {
      const response = await proxyAuthenticatedApi(
        buildEvent(new Request("https://localhost:3200/api/intel", {
          headers: {
            Cookie: "__Secure-better-auth.session_token=test-cookie",
          },
        })),
        "/api/intel",
      );

      assert.equal(response.status, 502);
      const payload = await response.json();
      assert.equal(payload.error, "Upstream API unavailable");
      assert.match(String(payload.detail || ""), /ECONNREFUSED/);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
