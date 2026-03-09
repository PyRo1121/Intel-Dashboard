type OwnerCrmAiTelemetryFailure = {
  ok: false;
  status: number;
  error: string;
};

function mergeVary(current: string | null, values: string[]): string {
  const set = new Set(
    (current ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
  for (const value of values) {
    if (value) set.add(value);
  }
  return [...set].join(", ");
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Headers": "content-type, x-admin-secret, authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      Vary: mergeVary(null, ["Origin", "Cookie", "Authorization"]),
    };
  }
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, x-admin-secret, authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    Vary: mergeVary(null, ["Origin", "Cookie", "Authorization"]),
  };
}

function privateApiHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    "Content-Type": "application/json",
  });
  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) {
    headers.set(key, value);
  }
  return headers;
}

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
