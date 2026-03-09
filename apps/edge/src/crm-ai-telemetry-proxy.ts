import { privateApiHeaders } from "./private-api-headers.ts";

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
    return new Response(
      JSON.stringify({
        ok: false,
        error: result.error,
      }),
      {
        status: 200,
        headers: privateApiHeaders(origin),
      },
    );
  }

  return new Response(
    JSON.stringify({
      error: result.error,
    }),
    {
      status: result.status,
      headers: privateApiHeaders(origin),
    },
  );
}
