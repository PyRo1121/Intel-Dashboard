import type { SubscriberAlertItem, SubscriberAlertsResponse } from "@intel-dashboard/shared/subscriber-alerts.ts";

export const ALERT_MATERIALIZATION_FAILURE_MESSAGE = "Alert refresh failed. Showing the latest available inbox snapshot.";

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
