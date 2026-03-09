import { privateApiJson } from "./private-api-headers.ts";

export function unauthorizedApiResponse(origin: string | null): Response {
  return privateApiJson(origin, 401, { error: "Unauthorized", login_url: "/login" });
}

export function misconfiguredApiResponse(origin: string | null): Response {
  return privateApiJson(origin, 503, { error: "Server auth misconfigured" });
}
