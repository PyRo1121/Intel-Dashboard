import type {
  SubscriberAlertPreferences,
  SubscriberAlertState,
  SubscriberAlertsResponse,
} from "@intel-dashboard/shared/subscriber-alerts.ts";
import { fetchClientJson } from "./client-json.ts";

function withOptionalSignal(signal?: AbortSignal): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

export type MyAlertsClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

function toClientResult<T>(result: Awaited<ReturnType<typeof fetchClientJson<T>>>): MyAlertsClientResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error, ...(result.status === undefined ? {} : { status: result.status }) };
}

export async function fetchSubscriberAlerts(
  state: SubscriberAlertState,
  signal?: AbortSignal,
): Promise<MyAlertsClientResult<SubscriberAlertsResponse>> {
  const result = await fetchClientJson<SubscriberAlertsResponse>(
    `/api/subscriber/my-alerts?state=${encodeURIComponent(state)}`,
    withOptionalSignal(signal),
  );
  return toClientResult(result);
}

export async function fetchSubscriberAlertPreferences(signal?: AbortSignal): Promise<MyAlertsClientResult<SubscriberAlertPreferences>> {
  const result = await fetchClientJson<SubscriberAlertPreferences>(
    "/api/subscriber/alert-preferences",
    withOptionalSignal(signal),
  );
  return toClientResult(result);
}

export async function saveSubscriberAlertPreferences(
  preferences: SubscriberAlertPreferences,
  signal?: AbortSignal,
): Promise<MyAlertsClientResult<SubscriberAlertPreferences>> {
  const result = await fetchClientJson<SubscriberAlertPreferences>(
    "/api/subscriber/alert-preferences",
    {
      method: "POST",
      body: JSON.stringify(preferences),
      ...(signal ? { signal } : {}),
    },
  );
  return toClientResult(result);
}

export async function markSubscriberAlertsRead(alertIds: string[], signal?: AbortSignal): Promise<MyAlertsClientResult<{ ok?: unknown }>> {
  const result = await fetchClientJson<{ ok?: unknown }>("/api/subscriber/my-alerts/read", {
    method: "POST",
    body: JSON.stringify({ alertIds }),
    ...(signal ? { signal } : {}),
  });
  return toClientResult(result);
}

export async function markAllSubscriberAlertsRead(signal?: AbortSignal): Promise<MyAlertsClientResult<{ ok?: unknown }>> {
  const result = await fetchClientJson<{ ok?: unknown }>("/api/subscriber/my-alerts/read-all", {
    method: "POST",
    ...(signal ? { signal } : {}),
  });
  return toClientResult(result);
}
