import assert from "node:assert/strict";
import test from "node:test";
import { isRecord } from "../src/type-guards.ts";

test("isRecord only accepts non-null objects", () => {
  assert.equal(isRecord({ ok: true }), true);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord("text"), false);
  assert.equal(isRecord(42), false);
});
