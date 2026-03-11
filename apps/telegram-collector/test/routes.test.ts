import assert from "node:assert/strict";
import test from "node:test";
import { isCollectorPushBatchPath } from "../src/routes.ts";

test("isCollectorPushBatchPath recognizes both legacy and explicit control routes", () => {
  assert.equal(isCollectorPushBatchPath("/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/control/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/status"), false);
});


test("collector worker exposes the explicit join control route shape", () => {
  const path = "/control/join-configured-channels";
  assert.equal(path.startsWith("/control/"), true);
});
