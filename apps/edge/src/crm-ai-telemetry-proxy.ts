import type { BackendJsonResult } from "./owner-backend-json.ts";
import { privateApiJson } from "./private-api-headers.ts";

export function buildOwnerCrmAiTelemetryFailureResponse(
  origin: string | null,
  result: Extract<BackendJsonResult, { ok: false }>,
): Response {
  return privateApiJson(origin, result.status, {
    ok: false,
    error: result.error,
  });
}
