import test from "node:test";
import assert from "node:assert/strict";
import { readLatestArray, readLatestValue } from "./resource-latest.ts";

test("readLatestValue prefers latest, then current, then fallback", () => {
  assert.equal(readLatestValue(2, 1, 0), 2);
  assert.equal(readLatestValue(undefined, 1, 0), 1);
  assert.equal(readLatestValue(undefined, null, 0), 0);
});

test("readLatestArray prefers latest, then current, then empty", () => {
  assert.deepEqual(readLatestArray([1, 2], [3]), [1, 2]);
  assert.deepEqual(readLatestArray(undefined, [3]), [3]);
  assert.deepEqual(readLatestArray(undefined, null), []);
});
