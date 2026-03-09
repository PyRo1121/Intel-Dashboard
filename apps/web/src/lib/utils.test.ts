import test from "node:test";
import assert from "node:assert/strict";
import {
  countBySeverity,
  formatAgeAgoAt,
  formatDateTime,
  formatLongDateTime,
  getInitialLetter,
  parseCompactNumber,
  parseTimestampMs,
  formatPercent,
  formatShortDateTime,
  severityDot,
  severityHexColor,
  truncateText,
  formatUsd,
  formatWholeNumber,
  isInitialResourceLoading,
} from "./utils.ts";

test("formatWholeNumber clamps and formats integer counts", () => {
  assert.equal(formatWholeNumber(12345.9), "12,345");
  assert.equal(formatWholeNumber(-10), "0");
  assert.equal(formatWholeNumber(undefined), "0");
});

test("parseCompactNumber handles plain, comma, and compact suffix values", () => {
  assert.equal(parseCompactNumber("42"), 42);
  assert.equal(parseCompactNumber("1,234"), 1234);
  assert.equal(parseCompactNumber("1.2K"), 1200);
  assert.equal(parseCompactNumber("2.5M"), 2_500_000);
  assert.equal(parseCompactNumber("3B"), 3_000_000_000);
  assert.equal(parseCompactNumber("views: 789"), 789);
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

test("truncateText preserves short strings and appends ellipsis to long ones", () => {
  assert.equal(truncateText("short", 10), "short");
  assert.equal(truncateText("abcdefghijklmnopqrstuvwxyz", 5), "abcde...");
  assert.equal(truncateText("abcdefghijklmnopqrstuvwxyz", 5, "…"), "abcde…");
  assert.equal(truncateText("text", 0), "");
});

test("getInitialLetter returns an uppercase first character with fallback", () => {
  assert.equal(getInitialLetter("analyst", "U"), "A");
  assert.equal(getInitialLetter("  owner@example.com", "U"), "O");
  assert.equal(getInitialLetter("", "U"), "U");
});

test("isInitialResourceLoading only flags empty refreshing resources", () => {
  assert.equal(isInitialResourceLoading("refreshing", 0), true);
  assert.equal(isInitialResourceLoading("ready", 0), false);
  assert.equal(isInitialResourceLoading("refreshing", 3), false);
});

test("countBySeverity aggregates per-severity totals", () => {
  assert.deepEqual(
    countBySeverity([
      { severity: "critical" as const },
      { severity: "high" as const },
      { severity: "high" as const },
      { severity: "low" as const },
      { severity: "" as const },
    ]),
    {
      critical: 1,
      high: 2,
      medium: 0,
      low: 1,
    },
  );
});

test("severity visual helpers stay aligned with the shared severity scale", () => {
  assert.match(severityDot("critical"), /red/);
  assert.match(severityDot("high"), /amber/);
  assert.equal(severityHexColor("medium"), "#3b82f6");
  assert.equal(severityHexColor("low"), "#71717a");
});
