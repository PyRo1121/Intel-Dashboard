import type {
  SubscriberAlertPreferences,
  SubscriberAlertsMutationResponse,
  SubscriberAlertsReadRequest,
  SubscriberAlertState,
  SubscriberAlertsResponse,
} from "@intel-dashboard/shared/subscriber-alerts.ts";
import { fetchClientJson } from "./client-json.ts";

function withOptionalSignal(signal?: AbortSignal): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

export async function fetchSubscriberAlerts(
  state: SubscriberAlertState,
  signal?: AbortSignal,
): Promise<SubscriberAlertsResponse | null> {
  const result = await fetchClientJson<SubscriberAlertsResponse>(
    `/api/subscriber/my-alerts?state=${encodeURIComponent(state)}`,
    withOptionalSignal(signal),
  );
  return result.ok ? result.data : null;
}

export async function fetchSubscriberAlertPreferences(signal?: AbortSignal): Promise<SubscriberAlertPreferences | null> {
  const result = await fetchClientJson<SubscriberAlertPreferences>(
    "/api/subscriber/alert-preferences",
    withOptionalSignal(signal),
  );
  return result.ok ? result.data : null;
}

export async function saveSubscriberAlertPreferences(
  preferences: SubscriberAlertPreferences,
  signal?: AbortSignal,
): Promise<SubscriberAlertPreferences | null> {
  const result = await fetchClientJson<SubscriberAlertPreferences>(
    "/api/subscriber/alert-preferences",
    {
      method: "POST",
      body: JSON.stringify(preferences),
      ...(signal ? { signal } : {}),
    },
  );
  return result.ok ? result.data : null;
}

export async function markSubscriberAlertsRead(alertIds: string[], signal?: AbortSignal): Promise<boolean> {
  const payload: SubscriberAlertsReadRequest = { alertIds };
  const result = await fetchClientJson<SubscriberAlertsMutationResponse>("/api/subscriber/my-alerts/read", {
    method: "POST",
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  return result.ok;
}

export async function markAllSubscriberAlertsRead(signal?: AbortSignal): Promise<boolean> {
  const result = await fetchClientJson<SubscriberAlertsMutationResponse>("/api/subscriber/my-alerts/read-all", {
    method: "POST",
    ...(signal ? { signal } : {}),
  });
  return result.ok;
}
