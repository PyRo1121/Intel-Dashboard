import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCacheBustRefreshBatches,
  buildCacheBustRefreshEndpoints,
  formatCacheBustRefreshFailure,
  isCurrentCacheGeneration,
} from "../src/intel-cache-refresh.ts";

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

test("buildCacheBustRefreshBatches bounds cache-bust rewarm concurrency", () => {
  const batches = buildCacheBustRefreshBatches([
    "/api/intel",
    "/api/briefings",
    "/api/air-sea",
    "/api/whales",
    "/api/chat-history?sessions=6&messages=25",
    "/api/chat-history?sessions=12&messages=40",
  ], 2);

  assert.deepEqual(batches, [
    ["/api/intel", "/api/briefings"],
    ["/api/air-sea", "/api/whales"],
    ["/api/chat-history?sessions=6&messages=25", "/api/chat-history?sessions=12&messages=40"],
  ]);
});

test("formatCacheBustRefreshFailure reports null and error failures explicitly", () => {
  assert.equal(
    formatCacheBustRefreshFailure("/api/intel", null),
    "/api/intel: refresh_unavailable",
  );
  assert.equal(
    formatCacheBustRefreshFailure("/api/intel", new Error("timeout")),
    "/api/intel: timeout",
  );
});
