import test from "node:test";
import assert from "node:assert/strict";
import { chunkEntries, collectStaleChunkKeys, MAX_DO_STORAGE_BATCH_ENTRIES } from "../src/storage-batches.ts";

test("chunkEntries splits large collections into <=128-entry batches", () => {
  const values = Array.from({ length: 260 }, (_, index) => index);
  const batches = chunkEntries(values);

  assert.equal(batches.length, 3);
  assert.equal(batches[0]?.length, MAX_DO_STORAGE_BATCH_ENTRIES);
  assert.equal(batches[1]?.length, MAX_DO_STORAGE_BATCH_ENTRIES);
  assert.equal(batches[2]?.length, 4);
  assert.deepEqual(batches.flat(), values);
});

test("chunkEntries clamps invalid batch sizes", () => {
  assert.deepEqual(chunkEntries([1, 2, 3], 0), [[1], [2], [3]]);
});

test("collectStaleChunkKeys returns only obsolete chunk keys", () => {
  assert.deepEqual(collectStaleChunkKeys("cache:/api/intel", 4, 2), [
    "cache:/api/intel:2",
    "cache:/api/intel:3",
  ]);
  assert.deepEqual(collectStaleChunkKeys("cache:/api/intel", 3, 3), []);
  assert.deepEqual(collectStaleChunkKeys("cache:/api/intel", 3, 0), [
    "cache:/api/intel:0",
    "cache:/api/intel:1",
    "cache:/api/intel:2",
  ]);
  assert.deepEqual(collectStaleChunkKeys("cache:/api/intel", undefined, 0), []);
});
