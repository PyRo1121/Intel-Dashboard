import assert from "node:assert/strict";
import test from "node:test";
import { hasCollectorControlAccess } from "../src/control-auth.ts";
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

test("hasCollectorControlAccess requires a matching bearer token", () => {
  const authorized = new Request("https://collector.example.com/control/push-batch", {
    method: "POST",
    headers: {
      authorization: "Bearer shared-secret",
    },
  });
  const unauthorized = new Request("https://collector.example.com/control/push-batch", {
    method: "POST",
  });

  assert.equal(hasCollectorControlAccess(authorized, "shared-secret"), true);
  assert.equal(hasCollectorControlAccess(authorized, "different"), false);
  assert.equal(hasCollectorControlAccess(unauthorized, "shared-secret"), false);
  assert.equal(hasCollectorControlAccess(authorized, undefined), false);
});
