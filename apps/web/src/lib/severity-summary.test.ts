import test from "node:test";
import assert from "node:assert/strict";
import { getSeveritySummaryAccentClass, getSeveritySummaryTotal } from "./severity-summary.ts";

test("severity summary helpers total counts and choose accent priority", () => {
  assert.equal(getSeveritySummaryTotal({ critical: 1, high: 2, medium: 3, low: 4 }), 10);
  assert.equal(getSeveritySummaryAccentClass({ critical: 1, high: 0, medium: 0, low: 0 }), "via-red-500/30");
  assert.equal(getSeveritySummaryAccentClass({ critical: 0, high: 1, medium: 2, low: 0 }), "via-amber-500/25");
  assert.equal(getSeveritySummaryAccentClass({ critical: 0, high: 0, medium: 3, low: 2 }), "via-blue-500/20");
});
