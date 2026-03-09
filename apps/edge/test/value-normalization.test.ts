import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNumber, normalizeString } from "../src/value-normalization.ts";

test("normalizeString trims non-empty strings and rejects empty/non-string values", () => {
  assert.equal(normalizeString(" value "), "value");
  assert.equal(normalizeString("   "), null);
  assert.equal(normalizeString(123), null);
});

test("normalizeNumber accepts finite numbers and numeric strings only", () => {
  assert.equal(normalizeNumber(42), 42);
  assert.equal(normalizeNumber(" 42.5 "), 42.5);
  assert.equal(normalizeNumber("nope"), null);
  assert.equal(normalizeNumber(Number.NaN), null);
});
