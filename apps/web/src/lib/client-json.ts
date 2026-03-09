const DEFAULT_TIMEOUT_MS = 30_000;

export type ClientJsonResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status?: number };

function extractJsonError(payload: unknown): string | null {
  if (typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string") {
    return payload.error;
  }
  return null;
}

async function fetchJsonInternal<T>(input: string, init: RequestInit = {}): Promise<ClientJsonResult<T>> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    response = await fetch(input, {
      ...init,
      headers,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Request failed.",
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      status: response.status,
      error: "Invalid JSON response",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: extractJsonError(payload) ?? `HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    status: response.status,
    data: payload as T,
  };
}

export async function fetchClientJson<T>(input: string, init: RequestInit = {}): Promise<ClientJsonResult<T>> {
  return fetchJsonInternal<T>(input, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...init,
  });
}

export async function fetchPublicJson<T>(input: string, init: RequestInit = {}): Promise<ClientJsonResult<T>> {
  return fetchJsonInternal<T>(input, {
    cache: "no-store",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    ...init,
  });
}
