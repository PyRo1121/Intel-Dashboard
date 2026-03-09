export function jsonResponse(
  payload: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return new Response(JSON.stringify(payload), {
    status: init.status,
    headers,
  });
}

