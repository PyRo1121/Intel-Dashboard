import test from "node:test";
import assert from "node:assert/strict";
import { freshnessBannerTone, freshnessPillTone } from "./freshness.ts";

test("freshness tones keep live visually distinct from delayed", () => {
  assert.notEqual(freshnessPillTone("live"), freshnessPillTone("delayed"));
  assert.notEqual(freshnessBannerTone("live"), freshnessBannerTone("delayed"));
});
