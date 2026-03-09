import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

const REQUEST_TIMEOUT_MS = 20_000;
const RETRIES = 2;
const STRICT = process.env.E2E_STRICT === "1";
const REQUIRE_AUTH = process.env.E2E_REQUIRE_AUTH === "1";

export function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeBaseUrl(rawValue, fallback) {
  const raw = trim(rawValue) || fallback;
  return raw.replace(/\/+$/, "");
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const EDGE_BASE_URL = normalizeBaseUrl(process.env.E2E_EDGE_BASE_URL, SITE_ORIGIN);
export const BACKEND_BASE_URL = trim(process.env.E2E_BACKEND_BASE_URL);
export const BACKEND_ACCESS_CLIENT_ID = trim(process.env.E2E_CF_ACCESS_CLIENT_ID);
export const BACKEND_ACCESS_CLIENT_SECRET = trim(process.env.E2E_CF_ACCESS_CLIENT_SECRET);
export const BACKEND_TOKEN_FILE = trim(process.env.E2E_BACKEND_TOKEN_FILE) || "/tmp/e2e_backend_token.txt";
export const BACKEND_TOKEN = (() => {
  const explicit = trim(process.env.E2E_BACKEND_TOKEN);
  if (explicit) return explicit;
  try {
    if (existsSync(BACKEND_TOKEN_FILE)) {
      return trim(readFileSync(BACKEND_TOKEN_FILE, "utf8"));
    }
  } catch {}
  return "";
})();
export const USER_ID = trim(process.env.E2E_USER_ID) || "PyRo1121";
export const NON_OWNER_USER_ID = trim(process.env.E2E_NON_OWNER_USER_ID) || "e2e-non-owner";

export async function fetchWithRetry(url, init = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    try {
      const finalInit = withBackendAccessHeaders(url, init);
      const response = await fetch(url, {
        ...finalInit,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.status >= 500 && attempt < RETRIES) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) {
        await sleep(200 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

export function withBackendAccessHeaders(url, init = {}) {
  if (!BACKEND_BASE_URL || !String(url).startsWith(BACKEND_BASE_URL)) {
    return init;
  }
  if (!BACKEND_ACCESS_CLIENT_ID || !BACKEND_ACCESS_CLIENT_SECRET) {
    return init;
  }
  const headers = new Headers(init.headers || {});
  headers.set("CF-Access-Client-Id", BACKEND_ACCESS_CLIENT_ID);
  headers.set("CF-Access-Client-Secret", BACKEND_ACCESS_CLIENT_SECRET);
  return { ...init, headers };
}

export async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function requireOrSkip(t, value, message) {
  if (trim(value)) return trim(value);
  if (REQUIRE_AUTH) assert.fail(message);
  if (STRICT) t.diagnostic(message);
  t.skip(message);
  return "";
}

export function requireBackendBaseUrl(t) {
  return requireOrSkip(
    t,
    BACKEND_BASE_URL,
    "E2E_BACKEND_BASE_URL is required for direct backend e2e because workers.dev is disabled for this worker",
  );
}

export function requireBackendToken(t) {
  return requireOrSkip(t, BACKEND_TOKEN, "E2E_BACKEND_TOKEN is required for authenticated backend API smoke e2e");
}

export function assertSecurityHeaders(response, label) {
  const xcto = response.headers.get("x-content-type-options");
  const xfo = response.headers.get("x-frame-options");
  const referrer = response.headers.get("referrer-policy");
  const hsts = response.headers.get("strict-transport-security");
  const permissions = response.headers.get("permissions-policy");
  const csp = response.headers.get("content-security-policy");

  assert.equal(xcto, "nosniff", `${label} should set x-content-type-options=nosniff`);
  assert.equal(xfo, "DENY", `${label} should set x-frame-options=DENY`);
  assert.equal(referrer, "strict-origin-when-cross-origin", `${label} should set strict referrer policy`);
  assert.match(hsts || "", /max-age=/i, `${label} should set strict-transport-security`);
  assert.match(permissions || "", /geolocation=\(\)/i, `${label} should set restrictive permissions-policy`);
  assert.match(csp || "", /default-src 'self'/i, `${label} should set content-security-policy`);
}
