import test from "node:test";
import assert from "node:assert/strict";
import { buildCacheBustRefreshEndpoints, isCurrentCacheGeneration } from "../src/intel-cache-refresh.ts";

test("isCurrentCacheGeneration only accepts writes from the active generation", () => {
  assert.equal(isCurrentCacheGeneration(3, 3), true);
  assert.equal(isCurrentCacheGeneration(2, 3), false);
});

test("buildCacheBustRefreshEndpoints includes core, whales, and chat-history variants without duplicates", () => {
  const endpoints = buildCacheBustRefreshEndpoints(
    ["/api/intel", "/api/briefings", "/api/air-sea"],
    ["/api/chat-history?sessions=6&messages=25", "/api/chat-history?sessions=6&messages=25"],
  );

  assert.deepEqual(endpoints, [
    "/api/intel",
    "/api/briefings",
    "/api/air-sea",
    "/api/whales",
    "/api/chat-history?sessions=6&messages=25",
  ]);
});
