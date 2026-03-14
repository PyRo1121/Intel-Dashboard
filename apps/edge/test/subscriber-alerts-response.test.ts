import test from "node:test";
import assert from "node:assert/strict";
import type { SubscriberAlertItem } from "@intel-dashboard/shared/subscriber-alerts.ts";
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
  const items: SubscriberAlertItem[] = [
    {
      id: "alert-1",
      type: "high_signal_source",
      sourceSurface: "telegram",
      createdAt: "2026-03-14T12:00:00.000Z",
      title: "Alert title",
      summary: "Alert summary",
      link: "https://intel.pyro1121.com/alerts/alert-1",
      sourceLabel: "Abu Ali Express",
      channelOrProvider: "abualiexpress",
      region: "levant",
      tags: ["wire"],
      signalScore: 91,
      rankReasons: ["high_signal_source"],
      matchedPreference: "wire",
    },
  ];
  const payload = buildSubscriberAlertsResponse(
    {
      unreadCount: 2,
      items,
    },
    true,
  );
  assert.equal(payload.unreadCount, 2);
  assert.deepEqual(payload.items, items);
  assert.equal(payload.degraded?.materializationFailed, true);
  assert.equal(payload.degraded?.message, ALERT_MATERIALIZATION_FAILURE_MESSAGE);
});

test("getSubscriberAlertsMaterializationFailureMessage stays stable and user-safe", () => {
  assert.equal(getSubscriberAlertsMaterializationFailureMessage(), ALERT_MATERIALIZATION_FAILURE_MESSAGE);
});
