import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubscriberAlertsResponse,
  getSubscriberAlertsMaterializationFailureMessage,
} from "../src/subscriber-alerts-response.ts";

test("buildSubscriberAlertsResponse preserves a healthy alert payload", () => {
  const response = buildSubscriberAlertsResponse({
    unreadCount: 2,
    items: [],
  });

  assert.deepEqual(response, {
    unreadCount: 2,
    items: [],
  });
});

test("buildSubscriberAlertsResponse marks the payload degraded when materialization fails", () => {
  const response = buildSubscriberAlertsResponse(
    {
      unreadCount: 2,
      items: [],
    },
    new Error("db unavailable"),
  );

  assert.deepEqual(response, {
    unreadCount: 2,
    items: [],
    degraded: {
      materializationFailed: true,
      message: getSubscriberAlertsMaterializationFailureMessage(),
    },
  });
});
