import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmLatestEventMap, escapeCsvCell, getCrmLatestEventDisplay } from "./crm-export.ts";

test("buildCrmLatestEventMap keeps the first event per user and ignores invalid ids", () => {
  const map = buildCrmLatestEventMap([
    { userId: "user-1", atMs: 10, kind: "login" },
    { userId: "user-1", atMs: 20, kind: "upgrade" },
    { userId: "user-2", atMs: 30, kind: "refund" },
    { userId: "  " },
  ]);

  assert.deepEqual(map.get("user-1"), { atMs: 10, kind: "login" });
  assert.deepEqual(map.get("user-2"), { atMs: 30, kind: "refund" });
  assert.equal(map.size, 2);
});

test("escapeCsvCell quotes commas, quotes, and newlines", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
  assert.equal(escapeCsvCell("comma,value"), "\"comma,value\"");
  assert.equal(escapeCsvCell("quote\"value"), "\"quote\"\"value\"");
  assert.equal(escapeCsvCell("line\nbreak"), "\"line\nbreak\"");
  assert.equal(escapeCsvCell("line\rbreak"), "\"line\rbreak\"");
});

test("getCrmLatestEventDisplay formats kind and timestamp with safe fallbacks", () => {
  assert.deepEqual(
    getCrmLatestEventDisplay({ kind: "billing.start_trial", atMs: Date.UTC(2026, 2, 9, 12, 0, 0) }),
    {
      kindLabel: "billing start trial",
      atLabel: new Date(Date.UTC(2026, 2, 9, 12, 0, 0)).toLocaleString(),
    },
  );
  assert.deepEqual(
    getCrmLatestEventDisplay(undefined),
    {
      kindLabel: "—",
      atLabel: "—",
    },
  );
});
