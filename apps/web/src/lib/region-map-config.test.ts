import test from "node:test";
import assert from "node:assert/strict";
import { REGION_ACCENT, REGION_CENTROIDS } from "./region-map-config.ts";

test("region map config exposes stable centroids and accent colors for every map region", () => {
  assert.deepEqual(REGION_CENTROIDS.ukraine, [48.5, 35.0]);
  assert.deepEqual(REGION_CENTROIDS.us, [39.0, -98.0]);
  assert.equal(REGION_ACCENT.middle_east, "#f97316");
  assert.equal(REGION_ACCENT.global, "#71717a");
});
