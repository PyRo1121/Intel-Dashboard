import test from "node:test";
import assert from "node:assert/strict";
import {
  formatAgeAgoAt,
  formatDateTime,
  formatLongDateTime,
  parseTimestampMs,
  formatPercent,
  formatShortDateTime,
  formatUsd,
  formatWholeNumber,
} from "./utils.ts";

test("formatWholeNumber clamps and formats integer counts", () => {
  assert.equal(formatWholeNumber(12345.9), "12,345");
  assert.equal(formatWholeNumber(-10), "0");
  assert.equal(formatWholeNumber(undefined), "0");
});

test("formatUsd formats safe whole-dollar values", () => {
  assert.equal(formatUsd(29), "$29");
  assert.equal(formatUsd(29.75), "$30");
  assert.equal(formatUsd(undefined), "$0");
});

test("formatPercent formats one-decimal percentages and clamps negatives", () => {
  assert.equal(formatPercent(12.345), "12.3%");
  assert.equal(formatPercent(-5), "0.0%");
  assert.equal(formatPercent(undefined), "0.0%");
});

test("formatDateTime renders missing timestamps safely", () => {
  assert.equal(formatDateTime(undefined), "—");
  assert.equal(formatDateTime(0), "—");
});

test("short and long absolute datetime formatters stay safe for invalid input", () => {
  assert.equal(formatShortDateTime("not-a-date"), "—");
  assert.equal(formatLongDateTime("not-a-date"), "—");
});

test("parseTimestampMs returns NaN for invalid timestamps", () => {
  assert.equal(parseTimestampMs(new Date(Date.UTC(2026, 2, 7, 12, 0, 0)).toISOString()), Date.UTC(2026, 2, 7, 12, 0, 0));
  assert.ok(Number.isNaN(parseTimestampMs("not-a-date")));
});

test("formatAgeAgoAt formats elapsed time and handles missing values safely", () => {
  assert.equal(formatAgeAgoAt(9_000, 10_000), "1s ago");
  assert.equal(formatAgeAgoAt(undefined, 10_000), "Unknown");
});
