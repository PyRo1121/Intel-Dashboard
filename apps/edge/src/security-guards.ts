import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

export const DEFAULT_APP_ORIGIN = SITE_ORIGIN;
export const DEFAULT_SECURITY_HEADERS = Object.freeze({
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://challenges.cloudflare.com",
    "media-src 'self' data: blob: https:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self' https://github.com https://x.com https://twitter.com",
  ].join("; "),
});

const DEFAULT_ALLOWED_ORIGINS = new Set([
  DEFAULT_APP_ORIGIN,
  "http://localhost:3200",
  "http://127.0.0.1:3200",
]);

export function resolveAllowedCorsOrigin(params: {
  origin?: string | null;
  allowedOrigins?: ReadonlySet<string>;
  fallbackOrigin?: string;
}): string {
  const origin = params.origin ?? null;
  const allowedOrigins = params.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const fallbackOrigin = params.fallbackOrigin ?? DEFAULT_APP_ORIGIN;
  return origin && allowedOrigins.has(origin) ? origin : fallbackOrigin;
}

export function buildCorsHeaders(params: {
  origin?: string | null;
  allowedOrigins?: ReadonlySet<string>;
  fallbackOrigin?: string;
}): Record<string, string> {
  const allowedOrigin = resolveAllowedCorsOrigin(params);
  return {
    ...DEFAULT_SECURITY_HEADERS,
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Signature, X-Admin-Timestamp, X-Admin-Nonce, Stripe-Signature",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export function applyDefaultSecurityHeaders(headers: Headers): Headers {
  for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
    if (!headers.has(name)) {
      headers.set(name, value);
    }
  }
  return headers;
}

export function isTrustedRequestOrigin(params: {
  request: Request;
  allowedOrigins?: ReadonlySet<string>;
}): boolean {
  const allowedOrigins = params.allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const fetchSite = (params.request.headers.get("sec-fetch-site") ?? "").trim().toLowerCase();
  if (fetchSite === "cross-site") {
    return false;
  }
  if (fetchSite === "same-origin" || fetchSite === "same-site") {
    return true;
  }
  const originHeader = params.request.headers.get("origin");
  if (originHeader) {
    return allowedOrigins.has(originHeader);
  }
  const refererHeader = params.request.headers.get("referer");
  if (!refererHeader) {
    // Non-browser clients commonly omit Origin/Referer.
    return true;
  }
  try {
    const refererOrigin = new URL(refererHeader).origin;
    return allowedOrigins.has(refererOrigin);
  } catch {
    return false;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function parseStrictTimestampMs(raw: string): number | null {
  if (!/^\d{10,13}$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return raw.length === 10 ? parsed * 1000 : parsed;
}

function normalizeHex(raw: string): string {
  return raw.trim().toLowerCase();
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aa = normalizeHex(a);
  const bb = normalizeHex(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(new TextEncoder().encode(payload)),
  );
  return bytesToHex(new Uint8Array(digest));
}

export function buildAdminSignaturePayload(params: {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
}): string {
  return [
    params.method.toUpperCase(),
    params.path,
    params.timestamp,
    params.nonce,
  ].join("\n");
}

export async function signAdminRequest(params: {
  method: string;
  path: string;
  configuredSecret?: string | null;
  timestampMs?: number;
  nonce?: string;
}): Promise<{
  timestamp: string;
  nonce: string;
  signature: string;
  headers: Record<string, string>;
}> {
  const configuredSecret = params.configuredSecret?.trim() ?? "";
  if (!configuredSecret) {
    throw new Error("secret_not_configured");
  }
  const timestampMs = params.timestampMs ?? Date.now();
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    throw new Error("invalid_timestamp");
  }
  const timestamp = String(Math.floor(timestampMs));
  const nonce = params.nonce?.trim() || crypto.randomUUID().replace(/-/g, "");
  if (!/^[A-Za-z0-9:_-]{16,128}$/.test(nonce)) {
    throw new Error("invalid_nonce");
  }
  const payload = buildAdminSignaturePayload({
    method: params.method,
    path: params.path,
    timestamp,
    nonce,
  });
  const signature = await hmacSha256Hex(configuredSecret, payload);
  return {
    timestamp,
    nonce,
    signature,
    headers: {
      "X-Admin-Timestamp": timestamp,
      "X-Admin-Nonce": nonce,
      "X-Admin-Signature": signature,
    },
  };
}

export async function verifySignedAdminRequest(params: {
  method: string;
  path: string;
  headers: Headers;
  configuredSecret?: string | null;
  nowMs?: number;
  maxSkewMs?: number;
}): Promise<
  | { ok: true; nonce: string; timestampMs: number }
  | { ok: false; reason: string }
> {
  const configuredSecret = params.configuredSecret?.trim() ?? "";
  if (!configuredSecret) {
    return { ok: false, reason: "secret_not_configured" };
  }

  const timestamp = params.headers.get("x-admin-timestamp")?.trim() ?? "";
  const nonce = params.headers.get("x-admin-nonce")?.trim() ?? "";
  const signature = params.headers.get("x-admin-signature")?.trim() ?? "";

  if (!timestamp || !nonce || !signature) {
    return { ok: false, reason: "missing_headers" };
  }
  if (!/^[A-Za-z0-9:_-]{16,128}$/.test(nonce)) {
    return { ok: false, reason: "invalid_nonce" };
  }
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) {
    return { ok: false, reason: "invalid_signature_format" };
  }

  const timestampMs = parseStrictTimestampMs(timestamp);
  if (!timestampMs) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const nowMs = params.nowMs ?? Date.now();
  const maxSkewMs = params.maxSkewMs ?? 5 * 60 * 1000;
  if (Math.abs(nowMs - timestampMs) > maxSkewMs) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const payload = buildAdminSignaturePayload({
    method: params.method,
    path: params.path,
    timestamp,
    nonce,
  });
  const expected = await hmacSha256Hex(configuredSecret, payload);
  if (!timingSafeStringEqual(signature, expected)) {
    return { ok: false, reason: "signature_mismatch" };
  }

  return { ok: true, nonce, timestampMs };
}

export function decodeAndValidateMediaKey(encodedKey: string): string | null {
  if (!encodedKey) return null;
  let key = "";
  try {
    key = decodeURIComponent(encodedKey).trim();
  } catch {
    return null;
  }
  if (!key) return null;
  if (key.length > 512) return null;
  if (key.startsWith("/") || key.includes("\\") || key.includes("..")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)) return null;
  return key;
}

function parseStripeSignatureHeader(header: string): {
  timestamp: string | null;
  signatures: string[];
} {
  const items = header.split(",").map((part) => part.trim()).filter(Boolean);
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const item of items) {
    const [k, ...rest] = item.split("=");
    if (!k || rest.length === 0) continue;
    const value = rest.join("=").trim();
    if (!value) continue;
    if (k === "t") {
      timestamp = value;
      continue;
    }
    if (k === "v1" && /^[a-fA-F0-9]{64}$/.test(value)) {
      signatures.push(normalizeHex(value));
    }
  }
  return { timestamp, signatures };
}

export async function verifyStripeWebhookSignature(params: {
  rawBody: string;
  signatureHeader: string | null;
  configuredSecret?: string | null;
  nowMs?: number;
  toleranceSeconds?: number;
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const configuredSecret = params.configuredSecret?.trim() ?? "";
  if (!configuredSecret) {
    return { ok: false, reason: "secret_not_configured" };
  }
  if (!params.signatureHeader) {
    return { ok: false, reason: "missing_signature_header" };
  }

  const parsed = parseStripeSignatureHeader(params.signatureHeader);
  if (!parsed.timestamp || parsed.signatures.length === 0) {
    return { ok: false, reason: "invalid_signature_header" };
  }

  const timestampSeconds = Number.parseInt(parsed.timestamp, 10);
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return { ok: false, reason: "invalid_timestamp" };
  }

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const toleranceSeconds = params.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds) {
    return { ok: false, reason: "timestamp_out_of_window" };
  }

  const expected = await hmacSha256Hex(
    configuredSecret,
    `${parsed.timestamp}.${params.rawBody}`,
  );
  if (!parsed.signatures.some((candidate) => timingSafeStringEqual(candidate, expected))) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

export function isHeaderSecretAuthorized(params: {
  request: Request;
  configuredSecret?: string | null;
  headerName?: string;
}): boolean {
  const configuredSecret = params.configuredSecret?.trim() ?? "";
  if (!configuredSecret) {
    return false;
  }
  const headerName = params.headerName?.trim() || "x-admin-secret";
  const headerSecret = params.request.headers.get(headerName)?.trim() ?? "";
  return headerSecret === configuredSecret;
}
