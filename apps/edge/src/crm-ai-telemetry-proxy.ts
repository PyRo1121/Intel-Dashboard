import type { BackendJsonResult } from "./owner-backend-json.ts";
import { privateApiJson } from "./private-api-headers.ts";

export function buildOwnerCrmAiTelemetryFailureResponse(
  origin: string | null,
  result: Extract<BackendJsonResult, { ok: false }>,
): Response {
  if (result.status === 502 || result.status === 503) {
    return privateApiJson(origin, 200, {
      ok: false,
      error: result.error,
    });
  }

  return privateApiJson(origin, result.status, {
    ok: false,
    error: result.error,
  });
}
