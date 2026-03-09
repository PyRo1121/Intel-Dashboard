import test from "node:test";
import assert from "node:assert/strict";
import { getRegionThreatLevel } from "./region-threat.ts";

test("getRegionThreatLevel applies critical, high, elevated, and low thresholds", () => {
  assert.deepEqual(
    getRegionThreatLevel({ critical: 3, high: 0, medium: 0 }),
    { label: "CRITICAL", color: "text-red-400", mapColor: "#ef4444", bgColor: "bg-red-500/10" },
  );
  assert.deepEqual(
    getRegionThreatLevel({ critical: 1, high: 0, medium: 0 }),
    { label: "HIGH", color: "text-amber-400", mapColor: "#f59e0b", bgColor: "bg-amber-500/10" },
  );
  assert.deepEqual(
    getRegionThreatLevel({ critical: 0, high: 1, medium: 0 }),
    { label: "ELEVATED", color: "text-blue-400", mapColor: "#3b82f6", bgColor: "bg-blue-500/10" },
  );
  assert.deepEqual(
    getRegionThreatLevel({ critical: 0, high: 0, medium: 1 }),
    { label: "LOW", color: "text-zinc-400", mapColor: "#71717a", bgColor: "bg-zinc-500/10" },
  );
});
