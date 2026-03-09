import test from "node:test";
import assert from "node:assert/strict";
import { readLatestArray } from "./resource-latest.ts";

test("readLatestArray prefers latest, then current, then empty", () => {
  assert.deepEqual(readLatestArray([1, 2], [3]), [1, 2]);
  assert.deepEqual(readLatestArray(undefined, [3]), [3]);
  assert.deepEqual(readLatestArray(undefined, null), []);
});

