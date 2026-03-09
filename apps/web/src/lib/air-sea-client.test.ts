import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_AIR_SEA_PAYLOAD, fetchAirSeaPayload } from "./air-sea-client.ts";

test("fetchAirSeaPayload returns upstream payload or shared empty fallback", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/air-sea")) {
        return new Response(JSON.stringify({
          timestamp: "2026-03-09T12:00:00.000Z",
          aviation: {
            timestamp: "2026-03-09T12:00:00.000Z",
            source: "opensky_live",
            fetchedAtMs: 1,
            emergencies: 0,
            aircraft: [],
          },
          intelFeed: [],
          stats: {
            aircraftCount: 0,
            airIntelCount: 0,
            seaIntelCount: 0,
            totalIntel: 0,
            critical: 0,
            high: 0,
          },
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const payload = await fetchAirSeaPayload();
    assert.equal(payload.timestamp, "2026-03-09T12:00:00.000Z");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.deepEqual(await fetchAirSeaPayload(), EMPTY_AIR_SEA_PAYLOAD);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
