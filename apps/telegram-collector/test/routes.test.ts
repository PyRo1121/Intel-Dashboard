import assert from "node:assert/strict";
import test from "node:test";
import { isCollectorPushBatchPath } from "../src/routes.ts";

test("isCollectorPushBatchPath recognizes both legacy and explicit control routes", () => {
  assert.equal(isCollectorPushBatchPath("/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/control/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/status"), false);
  assert.equal(isCollectorPushBatchPath("/control/push-batch/extra"), false);
  assert.equal(isCollectorPushBatchPath("/control/state-update"), false);
  assert.equal(isCollectorPushBatchPath(""), false);
});
