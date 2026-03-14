import type {
  CrmAiTelemetryPayload,
  CrmApiErrorPayload,
  CrmCustomerOpsPayload,
  CrmOverviewPayload,
} from "@intel-dashboard/shared/crm.ts";
import { fetchClientJson } from "./client-json.ts";

export function readCrmItems<T>(items: readonly T[] | null | undefined): T[] {
  return Array.isArray(items) ? [...items] : [];
}

function toCrmErrorPayload(error: string): CrmApiErrorPayload {
  return {
    ok: false,
    error,
  };
}

export async function fetchCrmOverview(): Promise<CrmOverviewPayload> {
  const result = await fetchClientJson<CrmOverviewPayload>("/api/admin/crm/overview", {
    method: "GET",
  });
  return result.ok ? result.data : toCrmErrorPayload(result.error);
}

export async function postCrmAction(
  path: string,
  payload: Record<string, unknown>,
): Promise<CrmCustomerOpsPayload> {
  const result = await fetchClientJson<CrmCustomerOpsPayload>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return result.ok ? result.data : toCrmErrorPayload(result.error);
}

export async function fetchCrmAiTelemetry(window: string): Promise<CrmAiTelemetryPayload> {
  const result = await fetchClientJson<CrmAiTelemetryPayload>(`/api/admin/crm/ai-telemetry?window=${encodeURIComponent(window)}`, {
    method: "GET",
  });
  return result.ok ? result.data : toCrmErrorPayload(result.error);
}
