import test from "node:test";
import assert from "node:assert/strict";
import {
  ALERT_MATERIALIZATION_FAILURE_MESSAGE,
  buildSubscriberAlertsResponse,
  getSubscriberAlertsMaterializationFailureMessage,
} from "../src/subscriber-alerts-response.ts";

test("buildSubscriberAlertsResponse preserves a healthy alerts payload", () => {
  const payload = buildSubscriberAlertsResponse({
    unreadCount: 2,
    items: [],
  });
  assert.deepEqual(payload, {
    unreadCount: 2,
    items: [],
  });
});

test("buildSubscriberAlertsResponse marks the payload degraded when materialization fails", () => {
  const payload = buildSubscriberAlertsResponse(
    {
      unreadCount: 2,
      items: [],
    },
    new Error("collector unavailable"),
  );
  assert.equal(payload.degraded?.materializationFailed, true);
  assert.equal(payload.degraded?.message, ALERT_MATERIALIZATION_FAILURE_MESSAGE);
});

test("getSubscriberAlertsMaterializationFailureMessage stays stable and user-safe", () => {
  assert.equal(getSubscriberAlertsMaterializationFailureMessage(), ALERT_MATERIALIZATION_FAILURE_MESSAGE);
});
