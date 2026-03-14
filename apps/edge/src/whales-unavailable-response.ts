import { jsonResponse } from "./json-response.ts";

export function buildWhalesUnavailableResponse(): Response {
  return jsonResponse(
    { error: "Whale transactions are not yet available. First refresh is still in progress." },
    { status: 503 },
  );
}
