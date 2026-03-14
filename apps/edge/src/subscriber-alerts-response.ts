import type { SubscriberAlertItem, SubscriberAlertsResponse } from "@intel-dashboard/shared/subscriber-alerts.ts";

export const ALERT_MATERIALIZATION_FAILURE_MESSAGE = "subscriber_alert_materialization_failed";

export function getSubscriberAlertsMaterializationFailureMessage(): string {
  return ALERT_MATERIALIZATION_FAILURE_MESSAGE;
}

export function buildSubscriberAlertsResponse(
  value: { unreadCount: number; items: SubscriberAlertItem[] },
  materializationError?: unknown,
): SubscriberAlertsResponse {
  if (!materializationError) {
    return value;
  }
  return {
    ...value,
    degraded: {
      materializationFailed: true,
      message: getSubscriberAlertsMaterializationFailureMessage(),
    },
  };
}
