import test from "node:test";
import assert from "node:assert/strict";
import { TELEGRAM_FILTER_GROUP_BY_ID, TELEGRAM_FILTER_GROUPS } from "./telegram-filter-groups.ts";

test("telegram filter groups expose stable ids and lookup map", () => {
  assert.equal(TELEGRAM_FILTER_GROUPS[0]?.id, "all");
  assert.equal(TELEGRAM_FILTER_GROUP_BY_ID.get("official")?.label, "Official");
  assert.ok(TELEGRAM_FILTER_GROUP_BY_ID.has("media-heavy"));
});
