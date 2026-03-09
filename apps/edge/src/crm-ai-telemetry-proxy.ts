import { privateApiJson } from "./private-api-headers.ts";

type OwnerCrmAiTelemetryFailure = {
  ok: false;
  status: number;
  error: string;
};

export function buildOwnerCrmAiTelemetryFailureResponse(
  origin: string | null,
  result: OwnerCrmAiTelemetryFailure,
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
