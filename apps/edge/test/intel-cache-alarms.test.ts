import test from "node:test";
import assert from "node:assert/strict";
import { resolveStartupAlarmAt } from "../src/intel-cache-alarms.ts";

test("resolveStartupAlarmAt preserves an existing alarm", () => {
  assert.equal(resolveStartupAlarmAt(50_000, 10_000, 10_000), 50_000);
});

test("resolveStartupAlarmAt schedules a new alarm when none exists", () => {
  assert.equal(resolveStartupAlarmAt(null, 10_000, 10_000), 20_000);
});
