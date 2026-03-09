export const INTERNAL_BACKEND_ORIGIN = "https://intel-dashboard-backend.internal";

type BackendBindingEnv = {
  INTEL_BACKEND?: Fetcher | null;
  BACKEND_URL?: string;
  ALLOW_BACKEND_URL_FALLBACK?: string;
  USAGE_DATA_SOURCE_TOKEN?: string;
  INTEL_API_TOKEN?: string;
};

function normalizeBoolean(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().toLowerCase() === "true";
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]" || normalized === "::1";
}

function normalizeLocalBackendOrigin(rawBaseUrl: string): string {
  const parsed = new URL(rawBaseUrl);
  if (!isLoopbackHostname(parsed.hostname)) {
    throw new Error("backend_url_fallback_requires_loopback_origin");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("backend_url_fallback_requires_http_or_https");
  }
  parsed.username = "";
  parsed.password = "";
  return parsed.toString();
}

export function usesBackendServiceBinding(env: BackendBindingEnv): boolean {
  return Boolean(env.INTEL_BACKEND);
}

export function resolveBackendEndpointUrl(env: BackendBindingEnv, backendPath: string): string {
  if (usesBackendServiceBinding(env)) {
    return new URL(backendPath, INTERNAL_BACKEND_ORIGIN).toString();
  }

  if (normalizeBoolean(env.ALLOW_BACKEND_URL_FALLBACK)) {
    const rawBaseUrl = (env.BACKEND_URL || "").trim();
    if (!rawBaseUrl) {
      throw new Error("backend_url_fallback_enabled_without_backend_url");
    }
    const localBaseUrl = normalizeLocalBackendOrigin(rawBaseUrl);
    return new URL(backendPath, localBaseUrl.endsWith("/") ? localBaseUrl : `${localBaseUrl}/`).toString();
  }

  throw new Error("intel_backend_binding_required");
}

export function resolveBackendApiToken(env: BackendBindingEnv): string {
  return (env.USAGE_DATA_SOURCE_TOKEN || env.INTEL_API_TOKEN || "").trim();
}

export function resolveBackendFetch(env: BackendBindingEnv): typeof fetch {
  if (usesBackendServiceBinding(env) && env.INTEL_BACKEND) {
    return env.INTEL_BACKEND.fetch.bind(env.INTEL_BACKEND) as typeof fetch;
  }
  return fetch;
}
