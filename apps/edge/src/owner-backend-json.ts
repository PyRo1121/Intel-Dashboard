import { isRecord } from "./type-guards.ts";

export type BackendJsonResult<TPayload extends Record<string, unknown> = Record<string, unknown>> =
  | { ok: true; payload: TPayload }
  | { ok: false; status: number; error: string };

export async function postOwnerBackendJson<TPayload extends Record<string, unknown>>(args: {
  backendToken: string;
  url: string;
  userId: string;
  userLogin: string;
  extraBody?: Record<string, unknown>;
  errorPrefix: string;
  fetchImpl: typeof fetch;
}): Promise<BackendJsonResult<TPayload>> {
  if (!args.backendToken) {
    return { ok: false, status: 503, error: "Backend API token is not configured." };
  }

  const backendRequest = new Request(args.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.backendToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(args.extraBody ?? {}),
      userId: args.userId,
      userLogin: args.userLogin,
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });

  let backendResponse: Response;
  try {
    backendResponse = await args.fetchImpl(backendRequest);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Backend unavailable",
    };
  }

  const parsed = await backendResponse.json().catch(() => null) as { result?: unknown; error?: unknown } | null;
  const result = parsed && isRecord(parsed.result) ? parsed.result as TPayload : null;
  if (!backendResponse.ok || !result) {
    const malformedSuccess = backendResponse.ok && !result;
    const error = parsed && typeof parsed.error === "string"
      ? parsed.error
      : `${args.errorPrefix} failed with HTTP ${backendResponse.status}`;
    return {
      ok: false,
      status: malformedSuccess ? 502 : (backendResponse.status || 502),
      error,
    };
  }

  return { ok: true, payload: result };
}
