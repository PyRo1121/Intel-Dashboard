import test from "node:test";
import assert from "node:assert/strict";
import { buildChunkedCacheWritePlan } from "../src/intel-cache-storage.ts";

test("buildChunkedCacheWritePlan keeps metadata separate for unchunked writes", () => {
  const plan = buildChunkedCacheWritePlan(
    "cache:/api/intel",
    "payload",
    { timestamp: 123, status: 200 },
    3,
    1024,
  );

  assert.deepEqual(plan.dataPuts, {
    "cache:/api/intel": "payload",
  });
  assert.deepEqual(plan.deleteKeys, [
    "cache:/api/intel:chunks",
    "cache:/api/intel:0",
    "cache:/api/intel:1",
    "cache:/api/intel:2",
  ]);
  assert.equal(plan.metaKey, "cache:/api/intel:meta");
  assert.deepEqual(plan.metaValue, { timestamp: 123, status: 200 });
});

test("buildChunkedCacheWritePlan publishes chunk data before metadata", () => {
  const plan = buildChunkedCacheWritePlan(
    "cache:/api/intel",
    "abcdefgh",
    { timestamp: 456, status: 202 },
    4,
    3,
  );

  assert.deepEqual(plan.dataPuts, {
    "cache:/api/intel:chunks": 3,
    "cache:/api/intel:0": "abc",
    "cache:/api/intel:1": "def",
    "cache:/api/intel:2": "gh",
  });
  assert.deepEqual(plan.deleteKeys, [
    "cache:/api/intel",
    "cache:/api/intel:3",
  ]);
  assert.equal(plan.metaKey, "cache:/api/intel:meta");
  assert.deepEqual(plan.metaValue, { timestamp: 456, status: 202 });
});
