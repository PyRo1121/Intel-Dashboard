import { fetchClientJson } from "./client-json.ts";

export async function fetchCrmOverview<T extends { ok?: boolean; error?: string }>(): Promise<T> {
  const result = await fetchClientJson<T>("/api/admin/crm/overview", {
    method: "GET",
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    } as T;
  }
  return result.data;
}

export async function postCrmAction<T extends { ok?: boolean; error?: string }>(
  path: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const result = await fetchClientJson<T>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    } as T;
  }
  return result.data;
}

export async function fetchCrmAiTelemetry<T extends { ok?: boolean; error?: string }>(window: string): Promise<T> {
  const result = await fetchClientJson<T>(`/api/admin/crm/ai-telemetry?window=${encodeURIComponent(window)}`, {
    method: "GET",
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.error,
    } as T;
  }
  return result.data;
}
