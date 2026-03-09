import test from "node:test";
import assert from "node:assert/strict";
import { getIntelTagStyle } from "./intel-tag-style.ts";

test("getIntelTagStyle returns known tag styles and null for unknown tags", () => {
  assert.equal(getIntelTagStyle("drone"), "bg-amber-500/15 text-amber-300 border-amber-500/25");
  assert.equal(getIntelTagStyle("naval-major"), "bg-indigo-500/15 text-indigo-300 border-indigo-500/25");
  assert.equal(getIntelTagStyle("unknown"), null);
});
