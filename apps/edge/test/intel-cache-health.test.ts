import test from "node:test";
import assert from "node:assert/strict";
import { evaluateIntelCacheHealth } from "../src/intel-cache-health.ts";

test("evaluateIntelCacheHealth reports ok when required endpoints are present and fresh", () => {
  const nowMs = 1_000;
  const cache = new Map([
    ["/api/intel", { timestamp: 900 }],
    ["/api/briefings", { timestamp: 800 }],
    ["/api/air-sea", { timestamp: 700 }],
  ]);

  assert.deepEqual(
    evaluateIntelCacheHealth({
      cache,
      nowMs,
      staleWindowByEndpoint: {
        "/api/intel": 500,
        "/api/briefings": 500,
        "/api/air-sea": 500,
      },
      requiredEndpoints: ["/api/intel", "/api/briefings", "/api/air-sea"],
    }),
    { status: "ok", missingEndpoints: [], staleEndpoints: [] },
  );
});

test("evaluateIntelCacheHealth reports missing and stale endpoints", () => {
  const nowMs = 1_000;
  const cache = new Map([
    ["/api/intel", { timestamp: 100 }],
    ["/api/briefings", { timestamp: 900 }],
  ]);

  assert.deepEqual(
    evaluateIntelCacheHealth({
      cache,
      nowMs,
      staleWindowByEndpoint: {
        "/api/intel": 500,
        "/api/briefings": 500,
        "/api/air-sea": 500,
      },
      requiredEndpoints: ["/api/intel", "/api/briefings", "/api/air-sea"],
    }),
    {
      status: "degraded",
      missingEndpoints: ["/api/air-sea"],
      staleEndpoints: ["/api/intel"],
    },
  );
});

test("evaluateIntelCacheHealth treats missing stale-window config as degraded", () => {
  const nowMs = 1_000;
  const cache = new Map([
    ["/api/intel", { timestamp: 900 }],
  ]);

  assert.deepEqual(
    evaluateIntelCacheHealth({
      cache,
      nowMs,
      staleWindowByEndpoint: {},
      requiredEndpoints: ["/api/intel"],
    }),
    {
      status: "degraded",
      missingEndpoints: [],
      staleEndpoints: ["/api/intel"],
    },
  );
});
