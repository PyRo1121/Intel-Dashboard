import type { SubscriberAlertsResponse } from "@intel-dashboard/shared/subscriber-alerts.ts";

const ALERT_MATERIALIZATION_FAILURE_MESSAGE =
  "Alert refresh failed. Showing the latest available inbox snapshot.";

export function buildSubscriberAlertsResponse(
  response: SubscriberAlertsResponse,
  materializationError?: unknown,
): SubscriberAlertsResponse {
  if (!materializationError) {
    return response;
  }

  return {
    ...response,
    degraded: {
      ...(response.degraded ?? {}),
      materializationFailed: true,
      message: ALERT_MATERIALIZATION_FAILURE_MESSAGE,
    },
  };
}

export function getSubscriberAlertsMaterializationFailureMessage(): string {
  return ALERT_MATERIALIZATION_FAILURE_MESSAGE;
}
