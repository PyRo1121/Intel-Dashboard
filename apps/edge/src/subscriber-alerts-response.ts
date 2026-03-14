import type { SubscriberAlertItem, SubscriberAlertsResponse } from "@intel-dashboard/shared/subscriber-alerts.ts";

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
      message: materializationError instanceof Error ? materializationError.message : "subscriber_alert_materialization_failed",
    },
  };
}
