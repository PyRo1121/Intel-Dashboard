import test from "node:test";
import assert from "node:assert/strict";
import { buildCrmLatestEventMap, escapeCsvCell } from "./crm-export.ts";

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
});
