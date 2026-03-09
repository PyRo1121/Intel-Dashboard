import test from "node:test";
import assert from "node:assert/strict";
import { getAviationSourceLabel, getAviationSourceNote } from "./air-sea-aviation.ts";

test("aviation source note reflects cached vs live source state", () => {
  assert.equal(getAviationSourceNote("OpenSky Network"), "OpenSky data refreshes every 5 minutes");
  assert.equal(
    getAviationSourceNote("OpenSky Network (cached)"),
    "Showing cached aviation snapshot; background refresh pending.",
  );
  assert.equal(
    getAviationSourceNote("opensky network (CACHED)"),
    "Showing cached aviation snapshot; background refresh pending.",
  );
  assert.equal(getAviationSourceNote(""), "Aviation snapshot unavailable.");
});

test("aviation source label falls back cleanly when no snapshot source exists", () => {
  assert.equal(getAviationSourceLabel("OpenSky Network"), "OpenSky Network");
  assert.equal(getAviationSourceLabel("OpenSky Network (cached)"), "OpenSky Network (cached)");
  assert.equal(getAviationSourceLabel(""), "Source unavailable");
  assert.equal(getAviationSourceLabel(undefined), "Source unavailable");
});
