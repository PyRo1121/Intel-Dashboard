export function jsonResponse(
  payload: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): Response {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const body = JSON.stringify(payload) ?? "null";
  return new Response(body, {
    status: init.status,
    headers,
  });
}

