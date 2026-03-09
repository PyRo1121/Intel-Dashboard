import test from "node:test";
import assert from "node:assert/strict";
import { getIntelCategoryStyle } from "./intel-category-style.ts";

test("intel category styles return shared palette entries and safe fallback", () => {
  assert.deepEqual(getIntelCategoryStyle("ru_milblog"), {
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-300",
  });
  assert.deepEqual(getIntelCategoryStyle("air_defense"), {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-300",
  });
  assert.deepEqual(getIntelCategoryStyle("unknown_category"), {
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    text: "text-zinc-300",
  });
});
