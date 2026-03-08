import test from "node:test";
import assert from "node:assert/strict";
import { debugRuntimeLog, shouldDebugRuntimeLogs } from "../src/runtime-log.ts";

test("shouldDebugRuntimeLogs recognizes explicit truthy values only", () => {
  assert.equal(shouldDebugRuntimeLogs(undefined), false);
  assert.equal(shouldDebugRuntimeLogs({}), false);
  assert.equal(shouldDebugRuntimeLogs({ DEBUG_RUNTIME_LOGS: "0" }), false);
  assert.equal(shouldDebugRuntimeLogs({ DEBUG_RUNTIME_LOGS: "false" }), false);
  assert.equal(shouldDebugRuntimeLogs({ DEBUG_RUNTIME_LOGS: "true" }), true);
  assert.equal(shouldDebugRuntimeLogs({ DEBUG_RUNTIME_LOGS: "YES" }), true);
});

test("debugRuntimeLog only emits when debug logging is enabled", () => {
  const original = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    debugRuntimeLog({ DEBUG_RUNTIME_LOGS: "false" }, "hidden");
    debugRuntimeLog({ DEBUG_RUNTIME_LOGS: "true" }, "visible", 42);
  } finally {
    console.log = original;
  }

  assert.deepEqual(calls, [["visible", 42]]);
});
