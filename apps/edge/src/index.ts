import { IntelCacheDO } from "./intel-cache-do";
import {
  applyDefaultSecurityHeaders,
  buildCorsHeaders,
  decodeAndValidateMediaKey,
  DEFAULT_APP_ORIGIN,
  isTrustedRequestOrigin,
  verifySignedAdminRequest,
  verifyStripeWebhookSignature,
} from "./security-guards";
import { TelegramScraperDO } from "./telegram-scraper-do";
import { createEdgeAuth } from "./auth";
import { buildDeterministicAvatarDataUrl } from "./avatar-fallback";
import { resolveBackendEndpointUrl, usesBackendServiceBinding } from "./backend-origin";
import { buildClientXProfileDiagnostics, type XProfileSyncDiagnostics } from "./auth-diagnostics";
import { normalizeSafeAuthRedirectLocation } from "./auth-redirect";
import { summarizeCrmDataQuality } from "./crm-quality";
import { getDashboardAppRoutePrefixes, normalizeSafePostAuthPath } from "./post-auth-path";
import { createTurnstileGateToken, type TurnstileMode, verifyTurnstileGateToken } from "./turnstile";
import { DASHBOARD_HOME_PATH, DEFAULT_POST_AUTH_PATH } from "../../../packages/shared/auth-next-routes.ts";
import { buildAuthModeSwitchHref, buildAuthPageHref, buildAuthProviderHref } from "../../../packages/shared/auth-flow.ts";
import { getAuthCopy } from "../../../packages/shared/auth-copy.ts";
import {
  FREE_FEED_DELAY_MINUTES,
  FREE_PLAN_NAME,
  PREMIUM_PLAN_NAME,
  PREMIUM_PRICE_USD,
  TRIAL_DAYS,
  formatDelayMinutesCompact,
  formatDelayMinutesLong,
  formatTrialDaysLabel,
  formatUsdMonthlyCompact,
  formatUsdMonthlySpaced,
} from "../../../packages/shared/access-offers.ts";
import {
  LANDING_CAPABILITIES,
  LANDING_CAPABILITIES_SECTION,
  LANDING_FINAL_CTA,
  LANDING_FAQ_ITEMS,
  LANDING_FOOTER,
  LANDING_HEADER_LINKS,
  LANDING_HERO_BULLETS,
  LANDING_HERO_CONTENT,
  LANDING_OPS_SNAPSHOT,
  LANDING_PRICING_COPY,
  LANDING_SUPPORTING_STATS,
  LANDING_SUPPORTING_STATS_COPY,
  LANDING_WORKFLOW_STEPS,
  LANDING_TESTIMONIALS_SECTION,
} from "../../../packages/shared/landing-content.ts";
import {
  LOGIN_DESCRIPTION,
  PRODUCTION_HOME_DESCRIPTION,
  PRODUCTION_HOME_OG_DESCRIPTION,
  PRODUCTION_HOME_TITLE,
  PRODUCTION_HOME_TWITTER_DESCRIPTION,
  SIGNUP_DESCRIPTION,
  resolveDashboardShellTitle,
} from "../../../packages/shared/route-meta.ts";
import { buildRobotsTxt, buildSitemapXml } from "../../../packages/shared/seo-assets.ts";
import { SITE_DESCRIPTION, SITE_NAME, SITE_ORIGIN, siteUrl } from "../../../packages/shared/site-config.ts";

export { IntelCacheDO, TelegramScraperDO };

export interface Env extends Cloudflare.Env {
  BACKEND_URL?: string;
  ALLOW_BACKEND_URL_FALLBACK?: string;
  CACHE_BUST_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
  X_BEARER_TOKEN?: string;
  X_OAUTH1_CONSUMER_KEY?: string;
  X_OAUTH1_CONSUMER_SECRET?: string;
  X_OAUTH_CLIENT_TYPE?: string;
  X_AUTH_SCOPE?: string;
  X_ENABLE_OIDC_FALLBACK?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  AUTH_SECRET: string;
  STRIPE_WEBHOOK_SECRET?: string;
  USAGE_DATA_SOURCE_TOKEN?: string;
  INTEL_API_TOKEN?: string;
  MEDIA_PROXY_SIGNING_SECRET?: string;
  MEDIA_PROXY_RATE_LIMIT_PER_MINUTE?: string;
  AUTH_ALERT_WEBHOOK_URL?: string;
  AUTH_TRANSIENT_ALERT_MINUTES?: string;
  AUTH_TRANSIENT_ALERT_COOLDOWN_MINUTES?: string;
  FREE_INTEL_MAX_ITEMS?: string;
  FREE_BRIEFINGS_MAX_ITEMS?: string;
  FREE_AIR_SEA_MAX_ITEMS?: string;
  FREE_TELEGRAM_TOTAL_MESSAGES_MAX?: string;
  FREE_TELEGRAM_CHANNEL_MESSAGES_MAX?: string;
  TRIAL_INTEL_MAX_ITEMS?: string;
  TRIAL_BRIEFINGS_MAX_ITEMS?: string;
  TRIAL_AIR_SEA_MAX_ITEMS?: string;
  TRIAL_TELEGRAM_TOTAL_MESSAGES_MAX?: string;
  TRIAL_TELEGRAM_CHANNEL_MESSAGES_MAX?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ORIGIN = SITE_ORIGIN;
const SESSION_COOKIE = "pyrobot_session";
const COMPAT_SESSION_COOKIE = "__Host-intel-session";
const STATE_COOKIE = "pyrobot_oauth_state";
const PKCE_COOKIE = "pyrobot_pkce_verifier";
const X_OAUTH1_REQ_COOKIE = "pyrobot_x_oauth1_req";
const TURNSTILE_PASS_COOKIE = "pyrobot_turnstile_pass";
const X_OIDC_RETRY_COOKIE = "pyrobot_x_oidc_retry";
const X_ACCESS_COOKIE = "pyrobot_x_access";
const X_ACCESS_REF_COOKIE = "pyrobot_x_access_ref";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const POST_LOGIN_PATH = DEFAULT_POST_AUTH_PATH;
const X_API_TIMEOUT_MS = 6_000;
const X_PROFILE_MAX_TOTAL_MS = 8_000;
const TURNSTILE_GATE_TTL_SECONDS = 8 * 60;
const TURNSTILE_VERIFY_TIMEOUT_MS = 6_000;
const DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES = FREE_FEED_DELAY_MINUTES;
const ENTITLEMENT_CACHE_TTL_MS = 60_000;
const ENTITLEMENT_CACHE_STALE_TTL_MS = 15_000;
const REMOVED_API_PATHS = new Set(["/api/polymarket", "/api/drops", "/api/crypto"]);
const REMOVED_PAGE_PATHS = new Set(["/polymarket", "/drops"]);
const GITHUB_LOGIN_PATHS = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/github/login",
  "/oauth/login",
  "/oauth/signup",
  "/oauth/github/login",
]);
const X_LOGIN_PATHS = new Set([
  "/auth/x/login",
  "/auth/x/signup",
  "/oauth/x/login",
  "/oauth/x/signup",
]);
const LOGOUT_PATHS = new Set(["/auth/logout", "/oauth/logout"]);
const DASHBOARD_APP_ROUTE_PREFIXES = getDashboardAppRoutePrefixes();
// Cache the dashboard shell manifest briefly to avoid reparsing it on every
// HTML request while still keeping deploy freshness tight.
const DASHBOARD_SHELL_CACHE_TTL_MS = 10_000;
const VITE_MANIFEST_ASSET_PATH = "/_build/.vite/manifest.json";
const MEDIA_PROXY_FETCH_TIMEOUT_MS = 15_000;
const MEDIA_PROXY_USER_AGENT = `SentinelStream-MediaProxy/1.0 (+${SITE_ORIGIN})`;
const ALLOWED_EXTERNAL_MEDIA_HOST_SUFFIXES = [".telesco.pe", ".telegram.org", ".cdn-telegram.org"] as const;
const MEDIA_PROXY_URL_TTL_SECONDS = 60 * 60;
const MEDIA_PROXY_SIGNATURE_SKEW_SECONDS = 60;
const DEFAULT_MEDIA_PROXY_RATE_LIMIT_PER_MINUTE = 180;
const X_PROFILE_ALERT_STATE_KEY = "auth:x_profile_sync:alert_state";
const DEFAULT_X_PROFILE_ALERT_THRESHOLD_MS = 5 * 60_000;
const DEFAULT_X_PROFILE_ALERT_COOLDOWN_MS = 5 * 60_000;
const X_PROFILE_ALERT_STATE_TTL_SECONDS = 7 * 24 * 60 * 60;
const X_PROFILE_CACHE_USER_PREFIX = "auth:x_profile_cache:user:";
const X_PROFILE_CACHE_ACCOUNT_PREFIX = "auth:x_profile_cache:account:";
const X_PROFILE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_FREE_INTEL_MAX_ITEMS = 80;
const DEFAULT_FREE_BRIEFINGS_MAX_ITEMS = 40;
const DEFAULT_FREE_AIR_SEA_MAX_ITEMS = 50;
const DEFAULT_FREE_TELEGRAM_TOTAL_MESSAGES_MAX = 600;
const DEFAULT_FREE_TELEGRAM_CHANNEL_MESSAGES_MAX = 20;
const DEFAULT_TRIAL_INTEL_MAX_ITEMS = 140;
const DEFAULT_TRIAL_BRIEFINGS_MAX_ITEMS = 70;
const DEFAULT_TRIAL_AIR_SEA_MAX_ITEMS = 90;
const DEFAULT_TRIAL_TELEGRAM_TOTAL_MESSAGES_MAX = 1_200;
const DEFAULT_TRIAL_TELEGRAM_CHANNEL_MESSAGES_MAX = 35;
const MAX_FEED_CAP_ITEMS = 10_000;

type VerifiedSession = {
  login: string;
  name: string;
  avatar_url: string;
  id: string | number;
  provider?: string;
};

type BackendUserInfoResponse = {
  ok?: unknown;
  result?: {
    tier?: unknown;
    role?: unknown;
    entitled?: unknown;
    delayMinutes?: unknown;
  };
};

type BackendCrmSummaryResponse = {
  ok?: unknown;
  result?: Record<string, unknown>;
  error?: unknown;
};

type CrmDirectoryUser = {
  id: string;
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
  providers: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

type FeedEntitlement = {
  tier: string;
  entitled: boolean;
  delayMinutes: number;
  role?: string;
};

type FeedTierCaps = {
  intelMaxItems: number | null;
  briefingsMaxItems: number | null;
  airSeaMaxItems: number | null;
  telegramTotalMessagesMax: number | null;
  telegramChannelMessagesMax: number | null;
};

type XProfileAlertState = {
  firstTransientAtMs: number | null;
  lastTransientAtMs: number | null;
  lastAlertAtMs: number | null;
  lastRecoveredAtMs: number | null;
  consecutiveTransient: number;
};

type XAccountTokenRow = {
  id: string | null;
  providerId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  scope: string | null;
  accountId: string | null;
  updatedAtMs: number | null;
};

type StoredOAuthTokenInfo = {
  rawToken: string | null;
  wrapped: boolean;
  decodedFromBase64: boolean;
  marker: string | null;
  issuedAtMs: number | null;
};

type CachedXProfile = {
  userId: string;
  accountId: string | null;
  username: string;
  name: string;
  avatarUrl: string;
  updatedAtMs: number;
};

type ViteManifestEntry = {
  file?: string;
  css?: string[];
  imports?: string[];
};

type ClientInputManifestEntry = {
  output: string;
  assets: Array<{ tag: "link"; attrs: { rel: "stylesheet"; href: string } }>;
};

type DashboardShellBundle = {
  entryScript: string;
  entryStyles: string[];
  manifest: Record<string, ClientInputManifestEntry>;
  loadedAtMs: number;
};

type DashboardShellMetadata = {
  title: string;
};

let dashboardShellCache: DashboardShellBundle | null = null;
const feedEntitlementCache = new Map<string, { value: FeedEntitlement; expiresAtMs: number }>();
let mediaProxySigningKeyCache: { secret: string; key: CryptoKey } | null = null;

// ============================================================================
// Cookie Helpers
// ============================================================================

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  header.split(";").forEach((c) => {
    const eq = c.indexOf("=");
    if (eq > 0) {
      cookies[c.slice(0, eq).trim()] = c.slice(eq + 1).trim();
    }
  });
  return cookies;
}

function setSessionCookie(value: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function normalizeExternalMediaUrl(rawUrl: string): string | null {
  const candidate = rawUrl.trim();
  if (!candidate) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const hostname = parsed.hostname.toLowerCase();
  const isAllowedHost =
    hostname === "telesco.pe" ||
    hostname === "telegram.org" ||
    hostname === "cdn-telegram.org" ||
    ALLOWED_EXTERNAL_MEDIA_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  if (!isAllowedHost) return null;
  if (parsed.username || parsed.password) return null;
  return parsed.toString();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const aa = a.trim().toLowerCase();
  const bb = b.trim().toLowerCase();
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

function normalizeMediaProxyRateLimit(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_MEDIA_PROXY_RATE_LIMIT_PER_MINUTE;
  }
  return Math.min(parsed, 2_000);
}

function resolveMediaProxySigningSecret(env: Env): string {
  const direct = (env.MEDIA_PROXY_SIGNING_SECRET || "").trim();
  if (direct.length > 0) return direct;
  return (env.AUTH_SECRET || "").trim();
}

function buildMediaProxySignaturePayload(targetUrl: string, expiresAtSeconds: number): string {
  return `media-proxy\n${targetUrl}\n${expiresAtSeconds}`;
}

async function importMediaProxySigningKey(secret: string): Promise<CryptoKey> {
  if (mediaProxySigningKeyCache && mediaProxySigningKeyCache.secret === secret) {
    return mediaProxySigningKeyCache.key;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  mediaProxySigningKeyCache = { secret, key };
  return key;
}

async function computeMediaProxySignature(params: {
  secret: string;
  targetUrl: string;
  expiresAtSeconds: number;
}): Promise<string> {
  const key = await importMediaProxySigningKey(params.secret);
  const payload = buildMediaProxySignaturePayload(params.targetUrl, params.expiresAtSeconds);
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(new TextEncoder().encode(payload)),
  );
  return bytesToHex(new Uint8Array(digest));
}

async function buildSignedMediaProxyUrl(params: {
  env: Env;
  rawUrl: string;
  nowMs?: number;
}): Promise<string | null> {
  const targetUrl = normalizeExternalMediaUrl(params.rawUrl);
  if (!targetUrl) return null;
  const secret = resolveMediaProxySigningSecret(params.env);
  if (!secret) return null;
  const nowMs = params.nowMs ?? Date.now();
  const expiresAtSeconds = Math.floor(nowMs / 1000) + MEDIA_PROXY_URL_TTL_SECONDS;
  const sig = await computeMediaProxySignature({
    secret,
    targetUrl,
    expiresAtSeconds,
  });
  const query = new URLSearchParams({
    u: targetUrl,
    exp: String(expiresAtSeconds),
    sig,
  });
  return `/media-proxy?${query.toString()}`;
}

async function verifyMediaProxySignature(params: {
  env: Env;
  targetUrl: string;
  expiresAtSecondsRaw: string | null;
  signatureRaw: string | null;
  nowMs?: number;
}): Promise<boolean> {
  const secret = resolveMediaProxySigningSecret(params.env);
  if (!secret) return false;
  const expiresAtSeconds = Number.parseInt(params.expiresAtSecondsRaw || "", 10);
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds <= 0) return false;
  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  if (expiresAtSeconds < nowSeconds - MEDIA_PROXY_SIGNATURE_SKEW_SECONDS) return false;
  if (expiresAtSeconds > nowSeconds + MEDIA_PROXY_URL_TTL_SECONDS + MEDIA_PROXY_SIGNATURE_SKEW_SECONDS) {
    return false;
  }
  const signature = (params.signatureRaw || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = await computeMediaProxySignature({
    secret,
    targetUrl: params.targetUrl,
    expiresAtSeconds,
  });
  return timingSafeHexEqual(signature, expected);
}

async function enforceMediaProxyRateLimit(params: {
  env: Env;
  request: Request;
}): Promise<Response | null> {
  const ip = (
    params.request.headers.get("CF-Connecting-IP") ||
    params.request.headers.get("x-forwarded-for") ||
    "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 80) || "unknown";
  const nowMs = Date.now();
  const bucket = Math.floor(nowMs / 60_000);
  const key = `media-proxy:rl:${ip}:${bucket}`;
  const limit = normalizeMediaProxyRateLimit(params.env.MEDIA_PROXY_RATE_LIMIT_PER_MINUTE);

  try {
    const current = Number.parseInt((await params.env.TELEGRAM_STATE.get(key)) || "0", 10);
    const count = Number.isFinite(current) ? current : 0;
    if (count >= limit) {
      const retryAfterSeconds = Math.max(1, 60 - Math.floor((nowMs % 60_000) / 1000));
      return withDefaultSecurityHeaders(new Response("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "Cache-Control": "no-store",
        },
      }));
    }
    await params.env.TELEGRAM_STATE.put(key, String(count + 1), { expirationTtl: 120 });
  } catch {
    // Fail open on limiter storage errors to avoid blocking legitimate media loads.
    return null;
  }

  return null;
}

async function rewriteTelegramMediaUrlsForResponse(params: {
  env: Env;
  state: Record<string, unknown>;
}): Promise<boolean> {
  const channelsRaw = params.state.channels;
  if (!Array.isArray(channelsRaw)) return false;
  const cache = new Map<string, string>();
  const nowMs = Date.now();
  let changed = false;

  for (const channel of channelsRaw) {
    if (!isRecord(channel)) continue;
    const messagesRaw = channel.messages;
    if (!Array.isArray(messagesRaw)) continue;
    for (const message of messagesRaw) {
      if (!isRecord(message)) continue;
      const mediaRaw = message.media;
      if (!Array.isArray(mediaRaw)) continue;
      for (const mediaItem of mediaRaw) {
        if (!isRecord(mediaItem)) continue;
        const candidates: Array<["url" | "thumbnail", unknown]> = [
          ["url", mediaItem.url],
          ["thumbnail", mediaItem.thumbnail],
        ];
        for (const [field, value] of candidates) {
          if (typeof value !== "string" || !value.startsWith("http")) continue;
          const normalized = normalizeExternalMediaUrl(value);
          if (!normalized) continue;
          let signed: string | undefined = cache.get(normalized);
          if (!signed) {
            const signedCandidate = await buildSignedMediaProxyUrl({
              env: params.env,
              rawUrl: normalized,
              nowMs,
            });
            if (!signedCandidate) continue;
            signed = signedCandidate;
            cache.set(normalized, signed);
          }
          if (mediaItem[field] !== signed) {
            mediaItem[field] = signed;
            changed = true;
          }
        }
      }
    }
  }

  return changed;
}

function clearCookie(name: string): string {
  return `${name}=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

type BetterAuthSessionResult = {
  user?: Record<string, unknown> | null;
  session?: Record<string, unknown> | null;
};

function getSetCookieValues(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw
    .split(/,(?=[^;,=\s]+=[^;,]+)/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function redirectFromAuthApiResponse(response: Response): Promise<Response> {
  let location = response.headers.get("location");
  if (!location) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
      const payloadUrl = payload && typeof payload.url === "string" ? payload.url.trim() : "";
      if (payloadUrl) {
        location = payloadUrl;
      }
    }
  }
  if (!location) {
    return response;
  }
  const safeLocation = normalizeSafeAuthRedirectLocation(location, ORIGIN);
  if (!safeLocation) {
    return withDefaultSecurityHeaders(new Response(null, {
      status: 302,
      headers: {
        Location: "/login?error=invalid_auth_redirect",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
      },
    }));
  }

  const headers = new Headers({
    Location: safeLocation,
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
  });
  for (const setCookie of getSetCookieValues(response.headers)) {
    headers.append("Set-Cookie", setCookie);
  }
  return withDefaultSecurityHeaders(new Response(null, {
    status: 302,
    headers,
  }));
}

function mapBetterAuthSession(session: BetterAuthSessionResult | null): VerifiedSession | null {
  if (!session || typeof session !== "object") return null;
  const user = session.user;
  if (!user || typeof user !== "object") return null;

  const candidateLogin =
    normalizeString((user as Record<string, unknown>).login) ??
    normalizeString((user as Record<string, unknown>).username) ??
    (() => {
      const email = normalizeString((user as Record<string, unknown>).email);
      if (email && email.includes("@")) {
        const handle = email.split("@")[0]?.trim();
        return handle || null;
      }
      return email;
    })() ??
    normalizeString((user as Record<string, unknown>).name);
  const fallbackId =
    normalizeString((user as Record<string, unknown>).id) ??
    normalizeString((session.session as Record<string, unknown> | null | undefined)?.userId) ??
    null;
  const login = candidateLogin ?? fallbackId ?? "operator";
  const id = fallbackId ?? login;
  const providerRaw =
    normalizeAuthProvider((session.session as Record<string, unknown> | null | undefined)?.activeProvider) ??
    normalizeAuthProvider((user as Record<string, unknown>).provider) ??
    undefined;
  const provider = providerRaw === "twitter" ? "x" : providerRaw;

  return {
    login,
    name: normalizeString((user as Record<string, unknown>).name) ?? login,
    avatar_url:
      normalizeString((user as Record<string, unknown>).image) ??
      normalizeString((user as Record<string, unknown>).avatar_url) ??
      "",
    id,
    provider,
  };
}

function rewriteLegacyAuthPath(path: string): string {
  if (path === "/auth/callback" || path === "/oauth/callback") {
    return "/auth/callback/github";
  }
  if (path === "/auth/x/callback" || path === "/oauth/x/callback") {
    return "/auth/callback/twitter";
  }
  if (path.startsWith("/oauth/")) {
    return `/auth/${path.slice("/oauth/".length)}`;
  }
  return path;
}

async function startBetterAuthSocialLogin(params: {
  auth: ReturnType<typeof createEdgeAuth>;
  request: Request;
  provider: "github" | "twitter";
  mode: TurnstileMode;
  nextPath: string | null;
}): Promise<Response> {
  const response = await params.auth.api.signInSocial({
    body: {
      provider: params.provider,
      callbackURL: params.nextPath ?? POST_LOGIN_PATH,
      errorCallbackURL: buildAuthPageHref(params.mode, params.nextPath, undefined),
    },
    headers: params.request.headers,
    asResponse: true,
  });
  return redirectFromAuthApiResponse(response);
}

async function logoutWithBetterAuth(params: {
  auth: ReturnType<typeof createEdgeAuth>;
  request: Request;
}): Promise<Response> {
  const signOutResponse = await params.auth.api.signOut({
    headers: params.request.headers,
    asResponse: true,
  });

  const headers = new Headers({
    Location: "/",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
  });
  for (const setCookie of getSetCookieValues(signOutResponse.headers)) {
    headers.append("Set-Cookie", setCookie);
  }
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  headers.append("Set-Cookie", clearCookie(COMPAT_SESSION_COOKIE));
  headers.append("Set-Cookie", clearCookie(X_ACCESS_COOKIE));
  headers.append("Set-Cookie", clearCookie(X_ACCESS_REF_COOKIE));
  headers.append("Set-Cookie", clearCookie(X_OAUTH1_REQ_COOKIE));
  headers.append("Set-Cookie", clearCookie(X_OIDC_RETRY_COOKIE));
  headers.append("Set-Cookie", clearCookie(STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(PKCE_COOKIE));
  return withDefaultSecurityHeaders(new Response(null, {
    status: 302,
    headers,
  }));
}

// ============================================================================
// HMAC Session Token (sign + verify)
// ============================================================================

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret);
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(secretBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function isFallbackXIdentity(login: string, name: string): boolean {
  const normalizedLogin = login.trim().toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  return (
    normalizedLogin.startsWith("x_fallback_") ||
    (normalizedName === "x user" && /^x_[a-z0-9_-]{6,}$/i.test(normalizedLogin))
  );
}

function isProvisionalXIdentity(login: string, name: string): boolean {
  return login.trim().toLowerCase().startsWith("xacct_") && name.trim().toLowerCase() === "x account";
}

function normalizeAuthProvider(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeIdHint(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function needsXProfileSync(user: {
  login: string;
  name: string;
  avatar_url?: string;
  provider?: string | null;
}): boolean {
  const login = user.login.trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  const avatar = (user.avatar_url ?? "").trim();
  const provider = (user.provider ?? "").trim().toLowerCase();
  const looksSyntheticLogin =
    login.startsWith("x_fallback_") ||
    login.startsWith("xacct_") ||
    /^x_[a-z0-9_-]{6,}$/i.test(login) ||
    /^[a-f0-9]{8,}$/i.test(login);

  if (isProvisionalXIdentity(user.login, user.name)) return true;
  if (isFallbackXIdentity(user.login, user.name)) return true;
  if ((name === "x account" || name === "x user") && looksSyntheticLogin) return true;
  if (provider !== "x") return false;
  if (name === "x account" || name === "x user") return true;
  if (!avatar && looksSyntheticLogin) return true;
  return false;
}

function isSyntheticXIdentity(login: string, name: string): boolean {
  const normalizedLogin = login.trim().toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedLogin) return true;
  if (isFallbackXIdentity(login, name) || isProvisionalXIdentity(login, name)) return true;
  if (normalizedLogin.startsWith("x_") || normalizedLogin.startsWith("xid_")) return true;
  if (normalizedName === "x user" || normalizedName === "x account") return true;
  return false;
}

function buildPublicXAvatarFallback(user: VerifiedSession): string {
  const provider = (user.provider ?? "").trim().toLowerCase();
  if (provider !== "x" && provider !== "twitter") {
    return "";
  }
  if (isSyntheticXIdentity(user.login, user.name)) {
    return "";
  }
  const login = user.login.trim();
  if (!login) {
    return "";
  }
  return buildDeterministicAvatarDataUrl({
    login,
    name: user.name,
  });
}

function buildUnavatarXAvatarFallback(login: string): string {
  const safe = login.trim().replace(/^@+/, "");
  if (!safe) return "";
  return `https://unavatar.io/x/${encodeURIComponent(safe)}`;
}

function normalizePositiveDurationMs(rawValue: string | undefined, fallbackMs: number): number {
  const raw = (rawValue ?? "").trim();
  if (!raw) return fallbackMs;
  const asNumber = Number(raw);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return fallbackMs;
  return Math.floor(asNumber * 60_000);
}

function normalizeXProfileAlertState(value: unknown): XProfileAlertState {
  const state = isRecord(value) ? value : {};
  const firstTransientAtMs = normalizeNumber(state.firstTransientAtMs);
  const lastTransientAtMs = normalizeNumber(state.lastTransientAtMs);
  const lastAlertAtMs = normalizeNumber(state.lastAlertAtMs);
  const lastRecoveredAtMs = normalizeNumber(state.lastRecoveredAtMs);
  const consecutiveTransientRaw = normalizeNumber(state.consecutiveTransient);
  return {
    firstTransientAtMs,
    lastTransientAtMs,
    lastAlertAtMs,
    lastRecoveredAtMs,
    consecutiveTransient: consecutiveTransientRaw === null ? 0 : Math.max(0, Math.floor(consecutiveTransientRaw)),
  };
}

async function loadXProfileAlertState(env: Env): Promise<XProfileAlertState> {
  try {
    const raw = await env.TELEGRAM_STATE.get(X_PROFILE_ALERT_STATE_KEY);
    if (!raw) {
      return {
        firstTransientAtMs: null,
        lastTransientAtMs: null,
        lastAlertAtMs: null,
        lastRecoveredAtMs: null,
        consecutiveTransient: 0,
      };
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeXProfileAlertState(parsed);
  } catch {
    return {
      firstTransientAtMs: null,
      lastTransientAtMs: null,
      lastAlertAtMs: null,
      lastRecoveredAtMs: null,
      consecutiveTransient: 0,
    };
  }
}

async function saveXProfileAlertState(env: Env, state: XProfileAlertState): Promise<void> {
  await env.TELEGRAM_STATE.put(
    X_PROFILE_ALERT_STATE_KEY,
    JSON.stringify(state),
    { expirationTtl: X_PROFILE_ALERT_STATE_TTL_SECONDS },
  );
}

function extractAlertingUserSummary(user: VerifiedSession | null): {
  id: string | null;
  login: string | null;
  provider: string | null;
} {
  if (!user) {
    return { id: null, login: null, provider: null };
  }
  return {
    id: resolveUserId(user),
    login: user.login,
    provider: user.provider ?? null,
  };
}

async function emitXProfileTransientAlert(params: {
  env: Env;
  diagnostics: XProfileSyncDiagnostics;
  user: VerifiedSession | null;
  path: string;
  durationMs: number;
  thresholdMs: number;
}): Promise<void> {
  const payload = {
    event: "x_profile_sync_transient_failure",
    timestamp: new Date().toISOString(),
    durationMs: params.durationMs,
    thresholdMs: params.thresholdMs,
    path: params.path,
    user: extractAlertingUserSummary(params.user),
    diagnostics: {
      status: params.diagnostics.status,
      error: params.diagnostics.error ?? null,
      tokenScope: params.diagnostics.tokenScope ?? null,
      tokenUserIdHint: params.diagnostics.tokenUserIdHint ?? null,
      refreshAttempted: params.diagnostics.refreshAttempted ?? false,
      refreshSucceeded: params.diagnostics.refreshSucceeded ?? false,
      fallbackApplied: params.diagnostics.fallbackApplied ?? false,
      fallbackUserId: params.diagnostics.fallbackUserId ?? null,
    },
  };

  console.error("[auth][x_profile_sync][alert]", JSON.stringify(payload));

  const webhookUrl = (params.env.AUTH_ALERT_WEBHOOK_URL ?? "").trim();
  if (!webhookUrl) return;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(webhookUrl);
  } catch {
    return;
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return;
  }

  try {
    await fetch(parsedUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Intentionally swallow webhook errors to avoid impacting request flow.
  }
}

async function trackXProfileSyncObservability(params: {
  env: Env;
  diagnostics: XProfileSyncDiagnostics | null;
  user: VerifiedSession | null;
  path: string;
}): Promise<void> {
  const diagnostics = params.diagnostics;
  if (!diagnostics || diagnostics.required !== true) {
    return;
  }
  const thresholdMs = normalizePositiveDurationMs(
    params.env.AUTH_TRANSIENT_ALERT_MINUTES,
    DEFAULT_X_PROFILE_ALERT_THRESHOLD_MS,
  );
  const cooldownMs = normalizePositiveDurationMs(
    params.env.AUTH_TRANSIENT_ALERT_COOLDOWN_MINUTES,
    DEFAULT_X_PROFILE_ALERT_COOLDOWN_MS,
  );
  const nowMs = Date.now();
  const state = await loadXProfileAlertState(params.env);

  if (diagnostics.status === "transient_profile_failure") {
    const firstTransientAtMs = state.firstTransientAtMs ?? nowMs;
    const durationMs = Math.max(0, nowMs - firstTransientAtMs);
    const canAlert = durationMs >= thresholdMs &&
      (state.lastAlertAtMs === null || nowMs - state.lastAlertAtMs >= cooldownMs);
    if (canAlert) {
      await emitXProfileTransientAlert({
        env: params.env,
        diagnostics,
        user: params.user,
        path: params.path,
        durationMs,
        thresholdMs,
      });
    }
    await saveXProfileAlertState(params.env, {
      firstTransientAtMs,
      lastTransientAtMs: nowMs,
      lastAlertAtMs: canAlert ? nowMs : state.lastAlertAtMs,
      lastRecoveredAtMs: state.lastRecoveredAtMs,
      consecutiveTransient: state.consecutiveTransient + 1,
    });
    return;
  }

  if (diagnostics.status === "synced" && state.firstTransientAtMs !== null) {
    const recoveredPayload = {
      event: "x_profile_sync_recovered",
      timestamp: new Date().toISOString(),
      path: params.path,
      user: extractAlertingUserSummary(params.user),
      transientWindowMs: Math.max(0, nowMs - state.firstTransientAtMs),
      previousConsecutiveTransient: state.consecutiveTransient,
    };
    console.warn("[auth][x_profile_sync][recovered]", JSON.stringify(recoveredPayload));
    await saveXProfileAlertState(params.env, {
      firstTransientAtMs: null,
      lastTransientAtMs: null,
      lastAlertAtMs: state.lastAlertAtMs,
      lastRecoveredAtMs: nowMs,
      consecutiveTransient: 0,
    });
  }
}

function withDefaultSecurityHeaders(response: Response): Response {
  applyDefaultSecurityHeaders(response.headers);
  return response;
}

function withSensitiveNoStore(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set(
    "Vary",
    mergeVary(response.headers.get("Vary"), ["Origin", "Cookie", "Authorization"]),
  );
  return withDefaultSecurityHeaders(response);
}

function fromBase64Url(s: string): Uint8Array {
  const b = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b.length % 4 === 0 ? "" : "=".repeat(4 - (b.length % 4));
  const binary = atob(b + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function privateApiHeaders(origin: string | null, existingVary: string | null = null): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store, no-cache, must-revalidate",
    "CDN-Cache-Control": "no-store",
    ...corsHeaders(origin),
  });
  headers.set(
    "Vary",
    mergeVary(existingVary, ["Origin", "Cookie", "Authorization"]),
  );
  return headers;
}

function unauthorizedApiResponse(origin: string | null): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized", login_url: "/login" }),
    {
      status: 401,
      headers: privateApiHeaders(origin),
    },
  );
}

function misconfiguredApiResponse(origin: string | null): Response {
  return new Response(
    JSON.stringify({ error: "Server auth misconfigured" }),
    {
      status: 503,
      headers: privateApiHeaders(origin),
    },
  );
}

// ============================================================================
// CORS
// ============================================================================

function corsHeaders(origin?: string | null): Record<string, string> {
  return buildCorsHeaders({ origin, fallbackOrigin: ORIGIN });
}

function mergeVary(existing: string | null, values: string[]): string {
  const set = new Set<string>();
  if (existing) {
    for (const part of existing.split(",")) {
      const key = part.trim();
      if (key) set.add(key);
    }
  }
  for (const value of values) {
    const key = value.trim();
    if (key) set.add(key);
  }
  return [...set].join(", ");
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveTurnstileSiteKey(env: Env): string {
  return (env.TURNSTILE_SITE_KEY || "").trim();
}

function resolveTurnstileSecretKey(env: Env): string {
  return (env.TURNSTILE_SECRET_KEY || "").trim();
}

function isTurnstileEnabled(env: Env): boolean {
  return resolveTurnstileSiteKey(env).length > 0 && resolveTurnstileSecretKey(env).length > 0;
}

function setTurnstilePassCookie(value: string, maxAgeSeconds: number): string {
  return `${TURNSTILE_PASS_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function resolveTurnstileMode(value: unknown): TurnstileMode | null {
  const normalized = normalizeString(value)?.toLowerCase();
  if (normalized === "login" || normalized === "signup") {
    return normalized;
  }
  return null;
}

function resolveExpectedTurnstileModeForAuthPath(path: string): TurnstileMode {
  return path.includes("/signup") ? "signup" : "login";
}

type TurnstileSiteverifyResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: unknown;
};

async function verifyTurnstileTokenWithCloudflare(params: {
  env: Env;
  token: string;
  mode: TurnstileMode;
  request: Request;
}): Promise<{ ok: true } | { ok: false; code: string; detail?: string }> {
  const secret = resolveTurnstileSecretKey(params.env);
  if (!secret) {
    return { ok: false, code: "turnstile_not_configured" };
  }
  const remoteIp =
    params.request.headers.get("CF-Connecting-IP") ||
    params.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  try {
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: params.token,
        remoteip: remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
    });
    const payload = await result.json().catch(() => null) as TurnstileSiteverifyResult | null;
    if (!result.ok || !payload || payload.success !== true) {
      const codes = Array.isArray(payload?.["error-codes"])
        ? payload?.["error-codes"].filter((value): value is string => typeof value === "string")
        : [];
      return {
        ok: false,
        code: "turnstile_failed",
        detail: codes.slice(0, 4).join(",") || `http_${result.status}`,
      };
    }

    const expectedHost = new URL(ORIGIN).hostname;
    if (payload.hostname && payload.hostname !== expectedHost) {
      return { ok: false, code: "turnstile_hostname_mismatch" };
    }
    if (payload.action && payload.action !== params.mode) {
      return { ok: false, code: "turnstile_action_mismatch" };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      code: "turnstile_verify_error",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

function appendSetCookie(response: Response, setCookieValue: string): Response {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", setCookieValue);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleTurnstileVerifyApi(params: {
  request: Request;
  env: Env;
  origin: string | null;
}): Promise<Response> {
  if (params.request.method !== "POST") {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      {
        status: 405,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }

  if (!isTrustedRequestOrigin({ request: params.request })) {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: false, error: "forbidden_origin" }),
      {
        status: 403,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }

  if (!isTurnstileEnabled(params.env)) {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: true, bypassed: true }),
      {
        status: 200,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }

  const payload = await params.request.json().catch(() => null);
  const body = isRecord(payload) ? payload : {};
  const token = normalizeString(body.token);
  const mode = resolveTurnstileMode(body.mode);
  if (!token || !mode) {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: false, error: "invalid_payload" }),
      {
        status: 400,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }

  const verification = await verifyTurnstileTokenWithCloudflare({
    env: params.env,
    token,
    mode,
    request: params.request,
  });
  if (!verification.ok) {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: false, error: verification.code, detail: verification.detail ?? null }),
      {
        status: 403,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }

  const authSecret = (params.env.AUTH_SECRET || "").trim();
  if (!authSecret) {
    return withDefaultSecurityHeaders(new Response(
      JSON.stringify({ ok: false, error: "auth_secret_missing" }),
      {
        status: 503,
        headers: privateApiHeaders(params.origin),
      },
    ));
  }
  const passToken = await createTurnstileGateToken({
    secret: authSecret,
    mode,
    ttlMs: TURNSTILE_GATE_TTL_SECONDS * 1000,
  });
  const headers = privateApiHeaders(params.origin);
  headers.append("Set-Cookie", setTurnstilePassCookie(passToken, TURNSTILE_GATE_TTL_SECONDS));
  return withDefaultSecurityHeaders(new Response(
    JSON.stringify({ ok: true }),
    {
      status: 200,
      headers,
    },
  ));
}

async function enforceTurnstileGateForAuthStart(params: {
  request: Request;
  env: Env;
  mode: TurnstileMode;
  nextPath: string | null;
}): Promise<Response | null> {
  if (!isTurnstileEnabled(params.env)) return null;
  const authSecret = (params.env.AUTH_SECRET || "").trim();
  if (!authSecret) {
    return withDefaultSecurityHeaders(new Response(null, {
      status: 302,
      headers: {
        Location: buildAuthPageHref(params.mode, params.nextPath, "security_check_unavailable"),
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Set-Cookie": clearCookie(TURNSTILE_PASS_COOKIE),
      },
    }));
  }
  const cookies = parseCookies(params.request.headers.get("Cookie"));
  const gateToken = cookies[TURNSTILE_PASS_COOKIE] ?? "";
  const valid = await verifyTurnstileGateToken({
    secret: authSecret,
    token: gateToken,
    expectedMode: params.mode,
  });
  if (valid) {
    return null;
  }
  return withDefaultSecurityHeaders(new Response(null, {
    status: 302,
    headers: {
      Location: buildAuthPageHref(params.mode, params.nextPath, "security_check_required"),
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "Set-Cookie": clearCookie(TURNSTILE_PASS_COOKIE),
    },
  }));
}

function resolveUserId(user: VerifiedSession): string {
  if (typeof user.id === "string" && user.id.trim().length > 0) {
    return user.id.trim();
  }
  if (typeof user.id === "number" && Number.isFinite(user.id)) {
    return String(user.id);
  }
  return user.login;
}

function decodeBase64UrlText(value: string): string | null {
  const compact = value.trim();
  if (!compact) return null;
  const normalized = compact.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  try {
    const binary = atob(normalized + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function parseStoredOAuthToken(rawValue: string | null): StoredOAuthTokenInfo {
  const compact = normalizeString(rawValue);
  if (!compact) {
    return {
      rawToken: null,
      wrapped: false,
      decodedFromBase64: false,
      marker: null,
      issuedAtMs: null,
    };
  }

  const decoded = decodeBase64UrlText(compact);
  const candidate = decoded ?? compact;
  const wrappedMatch = candidate.match(/^(.*):(\d{10,14}):([01]):([01]):([a-z]{2,3}):1$/i);
  if (wrappedMatch) {
    const issuedRaw = Number(wrappedMatch[2]);
    const marker = wrappedMatch[5]?.toLowerCase() ?? null;
    return {
      rawToken: wrappedMatch[1] ? wrappedMatch[1] : null,
      wrapped: true,
      decodedFromBase64: decoded !== null,
      marker,
      issuedAtMs: Number.isFinite(issuedRaw) ? issuedRaw : null,
    };
  }

  return {
    rawToken: compact,
    wrapped: false,
    decodedFromBase64: false,
    marker: null,
    issuedAtMs: null,
  };
}

function tokenPreview(token: string | null): string | null {
  if (!token) return null;
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function normalizeCachedXProfile(value: unknown, expectedUserId: string): CachedXProfile | null {
  if (!isRecord(value)) return null;
  const userId = normalizeString(value.userId);
  if (!userId || userId !== expectedUserId) return null;
  const username = normalizeString(value.username);
  if (!username) return null;
  const name = normalizeString(value.name) ?? username;
  const avatarUrl = normalizeXAvatarUrl(
    normalizeString(value.avatar_url) ??
    normalizeString(value.avatarUrl) ??
    "",
  );
  const accountId = normalizeString(value.accountId);
  const updatedAtMs = Math.floor(normalizeNumber(value.updatedAtMs) ?? Date.now());
  return {
    userId,
    accountId,
    username,
    name,
    avatarUrl,
    updatedAtMs,
  };
}

function mapCachedXProfileToSession(profile: CachedXProfile): VerifiedSession {
  return {
    id: profile.userId,
    login: profile.username,
    name: profile.name,
    avatar_url: profile.avatarUrl,
    provider: "x",
  };
}

async function loadCachedXProfile(args: {
  env: Env;
  userId: string;
  accountIdHint?: string | null;
}): Promise<CachedXProfile | null> {
  const keys = [`${X_PROFILE_CACHE_USER_PREFIX}${args.userId}`];
  const accountIdHint = normalizeIdHint(args.accountIdHint);
  if (accountIdHint) {
    keys.push(`${X_PROFILE_CACHE_ACCOUNT_PREFIX}${accountIdHint}`);
  }

  for (const key of keys) {
    try {
      const raw = await args.env.TELEGRAM_STATE.get(key, "json");
      const profile = normalizeCachedXProfile(raw, args.userId);
      if (profile) return profile;
    } catch {
      // Ignore malformed cache entries and continue.
    }
  }
  return null;
}

async function persistCachedXProfile(args: {
  env: Env;
  userId: string;
  accountId?: string | null;
  profile: { username: string; name: string; avatar_url: string };
}): Promise<void> {
  const username = args.profile.username.trim();
  if (!username) return;
  const payload = JSON.stringify({
    userId: args.userId,
    accountId: normalizeIdHint(args.accountId),
    username,
    name: args.profile.name.trim() || username,
    avatar_url: normalizeXAvatarUrl(args.profile.avatar_url || ""),
    updatedAtMs: Date.now(),
  });

  const writes: Promise<void>[] = [
    args.env.TELEGRAM_STATE.put(
      `${X_PROFILE_CACHE_USER_PREFIX}${args.userId}`,
      payload,
      { expirationTtl: X_PROFILE_CACHE_TTL_SECONDS },
    ),
  ];

  const accountId = normalizeIdHint(args.accountId);
  if (accountId) {
    writes.push(
      args.env.TELEGRAM_STATE.put(
        `${X_PROFILE_CACHE_ACCOUNT_PREFIX}${accountId}`,
        payload,
        { expirationTtl: X_PROFILE_CACHE_TTL_SECONDS },
      ),
    );
  }

  await Promise.allSettled(writes);
}

async function loadLatestXAccountTokenRow(env: Env, userId: string): Promise<XAccountTokenRow | null> {
  const row = await env.INTEL_DB
    .prepare(
      `SELECT "id" AS id, "providerId" AS providerId, "accessToken" AS accessToken, "refreshToken" AS refreshToken, "idToken" AS idToken, "scope" AS scope, "accountId" AS accountId, "updatedAt" AS updatedAt
       FROM "account"
       WHERE "userId" = ? AND lower("providerId") IN ('twitter', 'x')
       ORDER BY "updatedAt" DESC
       LIMIT 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();

  if (!row) {
    return null;
  }
  return {
    id: normalizeString(row.id),
    providerId: normalizeString(row.providerId),
    accessToken: normalizeString(row.accessToken),
    refreshToken: normalizeString(row.refreshToken),
    idToken: normalizeString(row.idToken),
    scope: normalizeString(row.scope),
    accountId: normalizeString(row.accountId),
    updatedAtMs: normalizeNumber(row.updatedAt),
  };
}

async function hasLinkedXAccountForUser(env: Env, userId: string): Promise<boolean> {
  const row = await env.INTEL_DB
    .prepare(
      `SELECT 1 AS present
       FROM "account"
       WHERE "userId" = ? AND lower("providerId") IN ('twitter', 'x')
       LIMIT 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
  return Boolean(row);
}

async function resolveStableXIdentityFallback(env: Env): Promise<VerifiedSession | null> {
  let rows: Record<string, unknown>[] = [];
  try {
    const result = await env.INTEL_DB
      .prepare(
        `SELECT u."id" AS userId, u."login" AS login, u."name" AS name, u."image" AS image, a."updatedAt" AS accountUpdatedAt
         FROM "account" a
         INNER JOIN "user" u ON u."id" = a."userId"
         WHERE lower(a."providerId") IN ('twitter', 'x')
         ORDER BY a."updatedAt" DESC
         LIMIT 24`,
      )
      .all<Record<string, unknown>>();
    rows = Array.isArray(result.results) ? result.results : [];
  } catch {
    return null;
  }
  if (rows.length === 0) {
    return null;
  }

  const candidates = rows
    .map((row) => {
      const userId = normalizeString(row.userId);
      const login = normalizeString(row.login);
      if (!userId || !login) {
        return null;
      }
      const name = normalizeString(row.name) ?? login;
      const avatar = normalizeXAvatarUrl(normalizeString(row.image) ?? "");
      return {
        userId,
        login,
        name,
        avatar,
        updatedAtMs: normalizeNumber(row.accountUpdatedAt) ?? 0,
      };
    })
    .filter((row): row is { userId: string; login: string; name: string; avatar: string; updatedAtMs: number } => row !== null)
    .filter((row) => !isSyntheticXIdentity(row.login, row.name));
  if (candidates.length === 0) {
    return null;
  }

  // Only auto-fallback when we can unambiguously identify a single non-synthetic identity.
  const distinctUserIds = Array.from(new Set(candidates.map((candidate) => candidate.userId)));
  if (distinctUserIds.length !== 1) {
    return null;
  }
  candidates.sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  const selected = candidates[0];
  return {
    id: selected.userId,
    login: selected.login,
    name: selected.name,
    avatar_url: selected.avatar,
    provider: "x",
  };
}

async function applyStableXIdentityFallbackIfNeeded(params: {
  env: Env;
  currentUser: VerifiedSession;
}): Promise<VerifiedSession | null> {
  const provider = (params.currentUser.provider ?? "").trim().toLowerCase();
  const isXProvider = provider === "x" || provider === "twitter";
  if (!isXProvider && !isSyntheticXIdentity(params.currentUser.login, params.currentUser.name)) {
    return null;
  }
  const fallback = await resolveStableXIdentityFallback(params.env);
  if (!fallback) {
    return null;
  }
  const fallbackId = resolveUserId(fallback);
  const currentId = resolveUserId(params.currentUser);
  if (fallbackId === currentId && fallback.login === params.currentUser.login) {
    return null;
  }
  return fallback;
}

async function persistResolvedXProfile(args: {
  env: Env;
  userId: string;
  profile: { username: string; name: string; avatar_url: string; id?: string };
}): Promise<void> {
  const updatedAt = Date.now();
  await args.env.INTEL_DB
    .prepare(
      `UPDATE "user"
       SET "login" = ?, "name" = ?, "image" = ?, "updatedAt" = ?
       WHERE "id" = ?`,
    )
    .bind(
      args.profile.username,
      args.profile.name || args.profile.username,
      args.profile.avatar_url || null,
      updatedAt,
      args.userId,
    )
    .run();

  if (args.profile.id && args.profile.id.trim().length > 0) {
    await args.env.INTEL_DB
      .prepare(
        `UPDATE "account"
         SET "accountId" = ?, "updatedAt" = ?
         WHERE "userId" = ? AND lower("providerId") IN ('twitter', 'x')`,
      )
      .bind(args.profile.id.trim(), updatedAt, args.userId)
      .run();
  }
}

async function hydrateXProfileFromStoredAccount(args: {
  env: Env;
  user: VerifiedSession;
}): Promise<{ user: VerifiedSession; diagnostics: XProfileSyncDiagnostics | null }> {
  const provider = (args.user.provider ?? "").trim().toLowerCase();
  const userId = resolveUserId(args.user);
  const hasLinkedXAccount = await hasLinkedXAccountForUser(args.env, userId);
  const requiresSync =
    needsXProfileSync(args.user) || provider === "x" || provider === "twitter" || hasLinkedXAccount;
  if (!requiresSync) {
    return { user: args.user, diagnostics: null };
  }

  let cachedProfile = await loadCachedXProfile({
    env: args.env,
    userId,
    accountIdHint: normalizeIdHint(args.user.id),
  });
  const applyFallbackIfAvailable = async (diagnostics: XProfileSyncDiagnostics) => {
    if (cachedProfile) {
      const cachedUser = mapCachedXProfileToSession(cachedProfile);
      return {
        user: cachedUser,
        diagnostics: {
          ...diagnostics,
          fallbackApplied: true,
          fallbackUserId: resolveUserId(cachedUser),
        },
      };
    }
    const fallbackUser = await applyStableXIdentityFallbackIfNeeded({
      env: args.env,
      currentUser: args.user,
    });
    if (!fallbackUser) {
      return {
        user: args.user,
        diagnostics,
      };
    }
    return {
      user: fallbackUser,
      diagnostics: {
        ...diagnostics,
        fallbackApplied: true,
        fallbackUserId: resolveUserId(fallbackUser),
      },
    };
  };

  let tokenRow: XAccountTokenRow | null = null;
  try {
    tokenRow = await loadLatestXAccountTokenRow(args.env, userId);
  } catch (error) {
    return applyFallbackIfAvailable({
      required: true,
      status: "db_error",
      accessSource: "d1_account",
      error: String(error),
    });
  }

  if (!tokenRow) {
    return applyFallbackIfAvailable({
      required: true,
      status: "missing_account",
      accessSource: "d1_account",
    });
  }

  if (!cachedProfile) {
    cachedProfile = await loadCachedXProfile({
      env: args.env,
      userId,
      accountIdHint: normalizeIdHint(tokenRow.accountId),
    });
  }

  const parsedAccessToken = parseStoredOAuthToken(tokenRow.accessToken);
  const parsedRefreshToken = parseStoredOAuthToken(tokenRow.refreshToken);
  const parsedIdToken = parseStoredOAuthToken(tokenRow.idToken);
  let accessToken = parsedAccessToken.rawToken;
  let refreshToken = parsedRefreshToken.rawToken;
  let idToken = parsedIdToken.rawToken;
  let scope = tokenRow.scope;
  const tokenUserIdHint =
    normalizeIdHint(tokenRow.accountId) ??
    normalizeIdHint(parseJwtSub(accessToken ?? "")) ??
    normalizeIdHint(parseJwtSub(refreshToken ?? "")) ??
    normalizeIdHint(parseJwtSub(idToken ?? ""));

  let refreshAttempted = false;
  let refreshSucceeded = false;

  if (!accessToken && refreshToken) {
    refreshAttempted = true;
    const refreshed = await refreshXAccessToken(args.env, refreshToken);
    const refreshedAccess = normalizeString(refreshed.access_token);
    if (refreshedAccess) {
      refreshSucceeded = true;
      accessToken = refreshedAccess;
      refreshToken = normalizeString(refreshed.refresh_token) ?? refreshToken;
      idToken = normalizeString(refreshed.id_token) ?? idToken;
      scope = normalizeString(refreshed.scope) ?? scope;
    }
  }

  if (!accessToken) {
    return applyFallbackIfAvailable({
      required: true,
      status: "missing_access_token",
      accessSource: "d1_account",
      hasRefreshToken: Boolean(refreshToken),
      refreshAttempted,
      refreshSucceeded,
      tokenScope: scope,
      tokenUserIdHint,
    });
  }

  let profileResult = await resolveXUserProfile({
    env: args.env,
    accessToken,
    refreshToken,
    userIdHint: tokenUserIdHint,
    usernameHint: args.user.login,
    tokenData: {
      access_token: accessToken,
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
      ...(idToken ? { id_token: idToken } : {}),
      ...(tokenUserIdHint ? { user_id: tokenUserIdHint } : {}),
      ...(scope ? { scope } : {}),
    },
    allowProvisional: false,
  });

  if (!profileResult.user && refreshToken && !refreshAttempted) {
    refreshAttempted = true;
    const refreshed = await refreshXAccessToken(args.env, refreshToken);
    const refreshedAccess = normalizeString(refreshed.access_token);
    if (refreshedAccess) {
      refreshSucceeded = true;
      accessToken = refreshedAccess;
      refreshToken = normalizeString(refreshed.refresh_token) ?? refreshToken;
      idToken = normalizeString(refreshed.id_token) ?? idToken;
      scope = normalizeString(refreshed.scope) ?? scope;

      profileResult = await resolveXUserProfile({
        env: args.env,
        accessToken,
        refreshToken,
        userIdHint: tokenUserIdHint,
        usernameHint: args.user.login,
        tokenData: {
          access_token: accessToken,
          ...(refreshToken ? { refresh_token: refreshToken } : {}),
          ...(idToken ? { id_token: idToken } : {}),
          ...(tokenUserIdHint ? { user_id: tokenUserIdHint } : {}),
          ...(scope ? { scope } : {}),
        },
        allowProvisional: false,
      });
    }
  }

  if (!profileResult.user) {
    const status = isTransientXProfileFailure(profileResult.error)
      ? "transient_profile_failure"
      : "profile_lookup_failed";
    return applyFallbackIfAvailable({
      required: true,
      status,
      accessSource: "d1_account",
      hasRefreshToken: Boolean(refreshToken),
      refreshAttempted,
      refreshSucceeded,
      tokenScope: scope,
      tokenUserIdHint,
      error: profileResult.error,
    });
  }

  const hydratedUser: VerifiedSession = {
    login: profileResult.user.username,
    name: profileResult.user.name || profileResult.user.username,
    avatar_url: profileResult.user.avatar_url || cachedProfile?.avatarUrl || "",
    id: profileResult.user.id ?? args.user.id,
    provider: "x",
  };

  try {
    await persistResolvedXProfile({
      env: args.env,
      userId,
      profile: profileResult.user,
    });
  } catch (error) {
    return {
      user: hydratedUser,
      diagnostics: {
        required: true,
        status: "db_error",
        accessSource: "d1_account",
        hasRefreshToken: Boolean(refreshToken),
        refreshAttempted,
        refreshSucceeded,
        tokenScope: scope,
        tokenUserIdHint,
        error: String(error),
      },
    };
  }
  try {
    await persistCachedXProfile({
      env: args.env,
      userId,
      accountId: profileResult.user.id ?? tokenUserIdHint ?? tokenRow.accountId,
      profile: profileResult.user,
    });
  } catch {
    // Cache persistence is best-effort and should not block auth.
  }

  return {
    user: hydratedUser,
    diagnostics: {
      required: true,
      status: "synced",
      accessSource: "d1_account",
      hasRefreshToken: Boolean(refreshToken),
      refreshAttempted,
      refreshSucceeded,
      tokenScope: scope,
      tokenUserIdHint,
      error: null,
    },
  };
}

function parseTimestampMs(value: unknown): number | null {
  const numeric = normalizeNumber(value);
  if (numeric !== null) {
    if (numeric > 1_000_000_000_000) {
      return Math.floor(numeric);
    }
    if (numeric > 1_000_000_000) {
      return Math.floor(numeric * 1000);
    }
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractNewsTimestampMs(item: unknown): number | null {
  if (!isRecord(item)) {
    return null;
  }

  const keys = [
    "timestamp",
    "publishedAt",
    "published_at",
    "stored_at",
    "storedAt",
    "datetime",
    "date",
    "createdAt",
    "publishedAtMs",
  ];
  for (const key of keys) {
    const parsed = parseTimestampMs(item[key]);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function filterNewsArrayByCutoff(items: unknown[], cutoffMs: number): unknown[] {
  return items.filter((item) => {
    const ts = extractNewsTimestampMs(item);
    return ts === null || ts <= cutoffMs;
  });
}

function applyLimit<T>(items: T[], maxItems: number | null): {
  items: T[];
  totalBefore: number;
  capped: boolean;
} {
  const totalBefore = items.length;
  if (maxItems === null) {
    return {
      items,
      totalBefore,
      capped: false,
    };
  }
  if (totalBefore <= maxItems) {
    return {
      items,
      totalBefore,
      capped: false,
    };
  }
  return {
    items: items.slice(0, maxItems),
    totalBefore,
    capped: true,
  };
}

function applyDelayAndCapsToApiPayload(args: {
  path: string;
  payload: unknown;
  delayMinutes: number;
  caps: FeedTierCaps;
}): {
  payload: unknown;
  capped: boolean;
  totalBefore: number | null;
  totalVisible: number | null;
} {
  const cutoffMs = args.delayMinutes > 0
    ? Date.now() - args.delayMinutes * 60 * 1000
    : null;
  const filterByDelay = (items: unknown[]): unknown[] =>
    cutoffMs === null ? items : filterNewsArrayByCutoff(items, cutoffMs);

  if ((args.path === "/api/intel" || args.path === "/api/briefings") && Array.isArray(args.payload)) {
    const delayed = filterByDelay(args.payload);
    const cap = args.path === "/api/intel" ? args.caps.intelMaxItems : args.caps.briefingsMaxItems;
    const limited = applyLimit(delayed, cap);
    return {
      payload: limited.items,
      capped: limited.capped,
      totalBefore: limited.totalBefore,
      totalVisible: limited.items.length,
    };
  }

  if (args.path === "/api/air-sea" && isRecord(args.payload) && Array.isArray(args.payload.intelFeed)) {
    const delayedIntelFeed = filterByDelay(args.payload.intelFeed);
    const limitedIntelFeed = applyLimit(delayedIntelFeed, args.caps.airSeaMaxItems);
    const intelFeed = limitedIntelFeed.items;
    if (!isRecord(args.payload.stats)) {
      return {
        payload: {
          ...args.payload,
          intelFeed,
        },
        capped: limitedIntelFeed.capped,
        totalBefore: limitedIntelFeed.totalBefore,
        totalVisible: intelFeed.length,
      };
    }

    let critical = 0;
    let high = 0;
    let airIntelCount = 0;
    let seaIntelCount = 0;
    for (const item of intelFeed) {
      if (!isRecord(item)) continue;
      if (item.severity === "critical") critical += 1;
      if (item.severity === "high") high += 1;
      if (item.domain === "air") airIntelCount += 1;
      if (item.domain === "sea") seaIntelCount += 1;
    }

    return {
      payload: {
        ...args.payload,
        intelFeed,
        stats: {
          ...args.payload.stats,
          totalIntel: intelFeed.length,
          critical,
          high,
          airIntelCount,
          seaIntelCount,
        },
      },
      capped: limitedIntelFeed.capped,
      totalBefore: limitedIntelFeed.totalBefore,
      totalVisible: intelFeed.length,
    };
  }

  if (args.path === "/api/telegram" && isRecord(args.payload) && Array.isArray(args.payload.channels)) {
    let capped = false;
    let totalBefore = 0;
    let totalMessages = 0;
    let remainingAcrossChannels = args.caps.telegramTotalMessagesMax;

    const channels = args.payload.channels.map((channel) => {
      if (!isRecord(channel) || !Array.isArray(channel.messages)) {
        return channel;
      }
      const delayedMessages = filterByDelay(channel.messages);
      totalBefore += delayedMessages.length;
      const perChannelLimited = applyLimit(delayedMessages, args.caps.telegramChannelMessagesMax);
      if (perChannelLimited.capped) capped = true;
      let visibleMessages = perChannelLimited.items;

      if (remainingAcrossChannels !== null) {
        if (remainingAcrossChannels <= 0) {
          if (visibleMessages.length > 0) capped = true;
          visibleMessages = [];
        } else if (visibleMessages.length > remainingAcrossChannels) {
          visibleMessages = visibleMessages.slice(0, remainingAcrossChannels);
          capped = true;
        }
        remainingAcrossChannels -= visibleMessages.length;
      }
      totalMessages += visibleMessages.length;
      return {
        ...channel,
        messages: visibleMessages,
        message_count: visibleMessages.length,
      };
    });
    return {
      payload: {
        ...args.payload,
        channels,
        total_messages: totalMessages,
      },
      capped,
      totalBefore,
      totalVisible: totalMessages,
    };
  }

  return {
    payload: args.payload,
    capped: false,
    totalBefore: null,
    totalVisible: null,
  };
}

function defaultFeedEntitlement(): FeedEntitlement {
  return {
    tier: "free",
    entitled: false,
    delayMinutes: DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES,
    role: "free",
  };
}

function normalizeFeedCap(rawValue: string | undefined, fallback: number): number | null {
  const raw = (rawValue || "").trim().toLowerCase();
  if (!raw) {
    return fallback;
  }
  if (raw === "none" || raw === "unlimited" || raw === "off" || raw === "0") {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  if (parsed <= 0) {
    return null;
  }
  return Math.min(parsed, MAX_FEED_CAP_ITEMS);
}

function resolveFeedTierCaps(env: Env, entitlement: FeedEntitlement): FeedTierCaps {
  if (entitlement.entitled || entitlement.tier === "subscriber" || entitlement.role === "owner") {
    return {
      intelMaxItems: null,
      briefingsMaxItems: null,
      airSeaMaxItems: null,
      telegramTotalMessagesMax: null,
      telegramChannelMessagesMax: null,
    };
  }
  const isTrial = entitlement.tier === "trial";
  if (isTrial) {
    return {
      intelMaxItems: normalizeFeedCap(env.TRIAL_INTEL_MAX_ITEMS, DEFAULT_TRIAL_INTEL_MAX_ITEMS),
      briefingsMaxItems: normalizeFeedCap(env.TRIAL_BRIEFINGS_MAX_ITEMS, DEFAULT_TRIAL_BRIEFINGS_MAX_ITEMS),
      airSeaMaxItems: normalizeFeedCap(env.TRIAL_AIR_SEA_MAX_ITEMS, DEFAULT_TRIAL_AIR_SEA_MAX_ITEMS),
      telegramTotalMessagesMax: normalizeFeedCap(
        env.TRIAL_TELEGRAM_TOTAL_MESSAGES_MAX,
        DEFAULT_TRIAL_TELEGRAM_TOTAL_MESSAGES_MAX,
      ),
      telegramChannelMessagesMax: normalizeFeedCap(
        env.TRIAL_TELEGRAM_CHANNEL_MESSAGES_MAX,
        DEFAULT_TRIAL_TELEGRAM_CHANNEL_MESSAGES_MAX,
      ),
    };
  }
  return {
    intelMaxItems: normalizeFeedCap(env.FREE_INTEL_MAX_ITEMS, DEFAULT_FREE_INTEL_MAX_ITEMS),
    briefingsMaxItems: normalizeFeedCap(env.FREE_BRIEFINGS_MAX_ITEMS, DEFAULT_FREE_BRIEFINGS_MAX_ITEMS),
    airSeaMaxItems: normalizeFeedCap(env.FREE_AIR_SEA_MAX_ITEMS, DEFAULT_FREE_AIR_SEA_MAX_ITEMS),
    telegramTotalMessagesMax: normalizeFeedCap(
      env.FREE_TELEGRAM_TOTAL_MESSAGES_MAX,
      DEFAULT_FREE_TELEGRAM_TOTAL_MESSAGES_MAX,
    ),
    telegramChannelMessagesMax: normalizeFeedCap(
      env.FREE_TELEGRAM_CHANNEL_MESSAGES_MAX,
      DEFAULT_FREE_TELEGRAM_CHANNEL_MESSAGES_MAX,
    ),
  };
}

async function fetchFeedEntitlement(params: {
  env: Env;
  userId: string;
  userLogin?: string;
}): Promise<FeedEntitlement> {
  const nowMs = Date.now();
  const primaryCache = feedEntitlementCache.get(params.userId);
  if (primaryCache && primaryCache.expiresAtMs > nowMs) {
    return primaryCache.value;
  }

  const fallback = defaultFeedEntitlement();
  const backendApiToken = (params.env.USAGE_DATA_SOURCE_TOKEN || params.env.INTEL_API_TOKEN || "").trim();

  const queryEntitlement = async (principal: string): Promise<FeedEntitlement> => {
    const backendUrl = resolveBackendEndpointUrl(params.env, "/api/intel-dashboard/user-info");
    const body = JSON.stringify({ userId: principal });
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (backendApiToken) {
      headers.Authorization = `Bearer ${backendApiToken}`;
    }
    const backendRequest = new Request(backendUrl, {
      method: "POST",
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    const backendResponse = usesBackendServiceBinding(params.env)
      ? await params.env.INTEL_BACKEND.fetch(backendRequest)
      : await fetch(backendRequest);
    if (!backendResponse.ok) {
      throw new Error(`user_info_http_${backendResponse.status}`);
    }

    const parsed = await backendResponse.json() as BackendUserInfoResponse;
    const result = isRecord(parsed.result) ? parsed.result : {};
    const role = normalizeString(result.role)?.toLowerCase();
    const tierRaw = normalizeString(result.tier)?.toLowerCase();
    const entitledRaw = result.entitled === true;
    const entitled = entitledRaw || role === "owner" || tierRaw === "subscriber";
    const configuredDelay = normalizeNumber(result.delayMinutes);
    const delayMinutes = entitled
      ? 0
      : Math.max(
        DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES,
        configuredDelay === null ? DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES : Math.floor(configuredDelay),
      );
    return {
      tier: tierRaw ?? (entitled ? "subscriber" : "free"),
      entitled,
      delayMinutes,
      role: role ?? (tierRaw ?? (entitled ? "subscriber" : "free")),
    };
  };

  try {
    const primary = await queryEntitlement(params.userId);
    let selected = primary;
    const loginPrincipal = (params.userLogin ?? "").trim();
    if (
      loginPrincipal.length > 0 &&
      loginPrincipal !== params.userId &&
      !primary.entitled
    ) {
      const loginCache = feedEntitlementCache.get(loginPrincipal);
      const fromLogin = loginCache && loginCache.expiresAtMs > nowMs
        ? loginCache.value
        : await queryEntitlement(loginPrincipal);
      if (fromLogin.entitled || fromLogin.tier === "subscriber" || fromLogin.role === "owner") {
        selected = fromLogin;
      }
      feedEntitlementCache.set(loginPrincipal, {
        value: fromLogin,
        expiresAtMs: nowMs + ENTITLEMENT_CACHE_TTL_MS,
      });
    }

    feedEntitlementCache.set(params.userId, {
      value: selected,
      expiresAtMs: nowMs + ENTITLEMENT_CACHE_TTL_MS,
    });
    return selected;
  } catch {
    feedEntitlementCache.set(params.userId, {
      value: fallback,
      expiresAtMs: nowMs + ENTITLEMENT_CACHE_STALE_TTL_MS,
    });
    return fallback;
  }
}

function resolveBackendEndpoint(env: Env, backendPath: string): string {
  return resolveBackendEndpointUrl(env, backendPath);
}

function resolveBackendApiToken(env: Env): string {
  return (env.USAGE_DATA_SOURCE_TOKEN || env.INTEL_API_TOKEN || "").trim();
}

function parseProviderList(raw: unknown): string[] {
  const value = normalizeString(raw);
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

async function loadCrmDirectorySnapshot(env: Env): Promise<{
  totalUsers: number;
  activeSessions: number;
  newUsers24h: number;
  newUsers7d: number;
  users: CrmDirectoryUser[];
}> {
  const nowMs = Date.now();
  const min24h = nowMs - 24 * 60 * 60 * 1000;
  const min7d = nowMs - 7 * 24 * 60 * 60 * 1000;

  const [totalsRow, activeSessionsRow, newUsers24hRow, newUsers7dRow, usersResult] = await Promise.all([
    env.INTEL_DB.prepare(`SELECT COUNT(*) AS totalUsers FROM "user"`).first<Record<string, unknown>>(),
    env.INTEL_DB.prepare(`SELECT COUNT(*) AS activeSessions FROM "session" WHERE "expiresAt" > ?`)
      .bind(nowMs)
      .first<Record<string, unknown>>(),
    env.INTEL_DB.prepare(`SELECT COUNT(*) AS newUsers24h FROM "user" WHERE "createdAt" >= ?`)
      .bind(min24h)
      .first<Record<string, unknown>>(),
    env.INTEL_DB.prepare(`SELECT COUNT(*) AS newUsers7d FROM "user" WHERE "createdAt" >= ?`)
      .bind(min7d)
      .first<Record<string, unknown>>(),
    env.INTEL_DB
      .prepare(
        `SELECT
           u."id" AS id,
           u."login" AS login,
           u."name" AS name,
           u."email" AS email,
           u."image" AS image,
           u."createdAt" AS createdAt,
           u."updatedAt" AS updatedAt,
           COALESCE(GROUP_CONCAT(DISTINCT lower(a."providerId")), '') AS providers
         FROM "user" u
         LEFT JOIN "account" a ON a."userId" = u."id"
         GROUP BY u."id", u."login", u."name", u."email", u."image", u."createdAt", u."updatedAt"
         ORDER BY u."createdAt" DESC
         LIMIT 400`,
      )
      .all<Record<string, unknown>>(),
  ]);

  const rows = Array.isArray(usersResult.results) ? usersResult.results : [];
  const users = rows
    .map((row) => {
      const id = normalizeString(row.id);
      const login = normalizeString(row.login);
      const name = normalizeString(row.name);
      const email = normalizeString(row.email);
      if (!id || !login || !name || !email) {
        return null;
      }
      return {
        id,
        login,
        name,
        email,
        avatarUrl: normalizeString(row.image) ?? "",
        providers: parseProviderList(row.providers),
        createdAtMs: Math.max(0, Math.floor(normalizeNumber(row.createdAt) ?? 0)),
        updatedAtMs: Math.max(0, Math.floor(normalizeNumber(row.updatedAt) ?? 0)),
      } satisfies CrmDirectoryUser;
    })
    .filter((entry): entry is CrmDirectoryUser => entry !== null);

  return {
    totalUsers: Math.max(0, Math.floor(normalizeNumber(totalsRow?.totalUsers) ?? users.length)),
    activeSessions: Math.max(0, Math.floor(normalizeNumber(activeSessionsRow?.activeSessions) ?? 0)),
    newUsers24h: Math.max(0, Math.floor(normalizeNumber(newUsers24hRow?.newUsers24h) ?? 0)),
    newUsers7d: Math.max(0, Math.floor(normalizeNumber(newUsers7dRow?.newUsers7d) ?? 0)),
    users,
  };
}

async function fetchOwnerCrmBackendSummary(params: {
  env: Env;
  user: VerifiedSession;
}): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const backendToken = resolveBackendApiToken(params.env);
  if (!backendToken) {
    return { ok: false, status: 503, error: "Backend API token is not configured." };
  }

  const backendRequest = new Request(
    resolveBackendEndpoint(params.env, "/api/intel-dashboard/admin/crm/summary"),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${backendToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: resolveUserId(params.user),
        userLogin: params.user.login,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  );

  let backendResponse: Response;
  try {
    backendResponse = usesBackendServiceBinding(params.env)
      ? await params.env.INTEL_BACKEND.fetch(backendRequest)
      : await fetch(backendRequest);
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : "Backend unavailable",
    };
  }

  const parsed = await backendResponse.json().catch(() => null) as BackendCrmSummaryResponse | null;
  const result = parsed && isRecord(parsed.result) ? parsed.result : null;
  if (!backendResponse.ok || !result) {
    const error = parsed && typeof parsed.error === "string"
      ? parsed.error
      : `Backend CRM summary failed with HTTP ${backendResponse.status}`;
    return {
      ok: false,
      status: backendResponse.status || 502,
      error,
    };
  }

  return { ok: true, payload: result };
}

async function parseOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (request.method === "GET" || request.method === "HEAD") {
    return {};
  }
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Expected JSON object body.");
  }
  return parsed;
}

async function proxySessionBillingRoute(params: {
  request: Request;
  env: Env;
  origin: string | null;
  user: VerifiedSession;
  backendPath: string;
  allowMethods: ReadonlyArray<string>;
}): Promise<Response> {
  if (!params.allowMethods.includes(params.request.method)) {
    const headers = privateApiHeaders(params.origin);
    headers.set("Allow", params.allowMethods.join(", "));
    return new Response(
      JSON.stringify({ error: "Method Not Allowed" }),
      {
        status: 405,
        headers,
      },
    );
  }

  const backendToken = resolveBackendApiToken(params.env);
  if (!backendToken) {
    return new Response(
      JSON.stringify({ error: "Backend API token is not configured." }),
      {
        status: 503,
        headers: privateApiHeaders(params.origin),
      },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = await parseOptionalJsonObject(params.request);
  } catch {
    return new Response(
      JSON.stringify({ error: "Expected JSON object body." }),
      {
        status: 400,
        headers: privateApiHeaders(params.origin),
      },
    );
  }

  const backendRequest = new Request(
    resolveBackendEndpoint(params.env, params.backendPath),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${backendToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...payload,
        userId: resolveUserId(params.user),
        userLogin: params.user.login,
      }),
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    },
  );

  let backendResponse: Response;
  try {
    backendResponse = usesBackendServiceBinding(params.env)
      ? await params.env.INTEL_BACKEND.fetch(backendRequest)
      : await fetch(backendRequest);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Backend unavailable",
        detail: error instanceof Error ? error.message : "unknown_error",
      }),
      {
        status: 502,
        headers: privateApiHeaders(params.origin),
      },
    );
  }

  const response = new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: backendResponse.headers,
  });
  const privateHeaders = privateApiHeaders(params.origin, response.headers.get("Vary"));
  for (const [key, value] of privateHeaders.entries()) {
    response.headers.set(key, value);
  }
  return response;
}

async function authorizePrivilegedRoute(params: {
  request: Request;
  env: Env;
  path: string;
  origin: string | null;
}): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (params.request.method !== "POST") {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(params.origin),
        },
      }),
    };
  }

  const signed = await verifySignedAdminRequest({
    method: params.request.method,
    path: params.path,
    headers: params.request.headers,
    configuredSecret: params.env.CACHE_BUST_SECRET,
  });
  if (!signed.ok) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "Forbidden", reason: signed.reason }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(params.origin),
          },
        },
      ),
    };
  }

  const guardId = params.env.INTEL_CACHE.idFromName("main");
  const guardStub = params.env.INTEL_CACHE.get(guardId);
  const guardRes = await guardStub.fetch(new Request("https://do/api/admin/guard", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scope: params.path,
      nonce: signed.nonce,
      timestampMs: signed.timestampMs,
      clientIp: params.request.headers.get("CF-Connecting-IP") ?? "unknown",
    }),
  }));

  if (!guardRes.ok) {
    const body = await guardRes.text();
    return {
      ok: false,
      response: new Response(
        body || JSON.stringify({ error: "Forbidden" }),
        {
          status: guardRes.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(params.origin),
          },
        },
      ),
    };
  }

  return { ok: true };
}

async function handleStripeWebhook(params: {
  request: Request;
  env: Env;
  origin: string | null;
}): Promise<Response> {
  if (params.request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(params.origin),
      },
    });
  }

  const signature = params.request.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response(JSON.stringify({ error: "Stripe-Signature header is required." }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders(params.origin),
      },
    });
  }

  const rawBody = await params.request.text();
  const backendUrl = resolveBackendEndpointUrl(params.env, "/api/intel-dashboard/billing/webhook");
  const headers = new Headers({
    "Stripe-Signature": signature,
    "Content-Type": params.request.headers.get("Content-Type") ?? "application/json",
  });

  try {
    const backendRequest = new Request(backendUrl, {
      method: "POST",
      headers,
      body: rawBody,
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const backendResponse = usesBackendServiceBinding(params.env)
      ? await params.env.INTEL_BACKEND.fetch(backendRequest)
      : await fetch(backendRequest);
    const response = new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: backendResponse.headers,
    });
    for (const [k, v] of Object.entries(corsHeaders(params.origin))) {
      response.headers.set(k, v);
    }
    response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
    response.headers.set("CDN-Cache-Control", "no-store");
    response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Origin"]));
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Backend webhook forwarding failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(params.origin),
        },
      },
    );
  }
}

function renderAuthPage(params: {
  mode: TurnstileMode;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  errorCode: string | null;
  nextPath: string | null;
}): string {
  const isSignup = params.mode === "signup";
  const copy = getAuthCopy(params.mode);
  const heading = copy.title;
  const subheading = copy.description;
  const xLabel = copy.xLabel;
  const githubLabel = copy.githubLabel;
  const switchHref = buildAuthModeSwitchHref(isSignup ? "signup" : "login", params.nextPath);
  const switchLabel = copy.switchLabel;
  const xHref = buildAuthProviderHref("x", isSignup ? "signup" : "login", params.nextPath);
  const githubHref = buildAuthProviderHref("github", isSignup ? "signup" : "login", params.nextPath);
  const turnstileHint = params.turnstileEnabled
    ? "Complete the security check before continuing."
    : "Security check unavailable: contact support if this persists.";
  const serverErrorMessage = (() => {
    if (!params.errorCode) return "";
    switch (params.errorCode) {
      case "security_check_required":
        return "Complete the security check, then try login again.";
      case "security_check_unavailable":
        return "Security check setup is unavailable. Please try again shortly.";
      default:
        return "";
    }
  })();
  const turnstileScript = params.turnstileEnabled
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
  <script>
    (() => {
      const mode = ${JSON.stringify(params.mode)};
      const siteKey = ${JSON.stringify(params.turnstileSiteKey)};
      const verifyUrl = "/api/auth/turnstile/verify";
      let widgetId = null;
      let token = "";

      const buttons = Array.from(document.querySelectorAll("[data-auth-href]"));
      const statusEl = document.getElementById("turnstile-status");
      const errorEl = document.getElementById("turnstile-error");

      const setBusy = (busy) => {
        for (const button of buttons) {
          button.disabled = busy || token.length === 0;
        }
      };
      const setStatus = (text) => {
        if (statusEl) statusEl.textContent = text;
      };
      const setError = (text) => {
        if (errorEl) errorEl.textContent = text;
      };

      const renderWidget = () => {
        if (!window.turnstile || widgetId) return;
        widgetId = window.turnstile.render("#turnstile-widget", {
          sitekey: siteKey,
          action: mode,
          callback: (newToken) => {
            token = newToken;
            setError("");
            setStatus("Security check completed.");
            setBusy(false);
          },
          "expired-callback": () => {
            token = "";
            setStatus("Security check expired. Please verify again.");
            setBusy(true);
          },
          "error-callback": () => {
            token = "";
            setError("Security verification failed. Please retry.");
            setBusy(true);
          }
        });
      };

      setBusy(true);
      setStatus("Waiting for security check...");
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 80);
      setTimeout(() => clearInterval(interval), 15_000);

      for (const button of buttons) {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          if (!token) {
            setError("Complete the security check first.");
            if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
            setBusy(true);
            return;
          }
          setError("");
          setStatus("Verifying security check...");
          setBusy(true);

          try {
            const response = await fetch(verifyUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              credentials: "same-origin",
              body: JSON.stringify({ token, mode })
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload || payload.ok !== true) {
              throw new Error((payload && payload.error) || "verification_failed");
            }
            const href = button.getAttribute("data-auth-href");
            if (href) {
              window.location.href = href;
              return;
            }
            throw new Error("missing_redirect");
          } catch {
            token = "";
            setStatus("Security check required.");
            setError("Verification failed. Please try again.");
            if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
            setBusy(true);
          }
        });
      }
    })();
  </script>`
    : "";
  const primaryCta = params.turnstileEnabled
    ? `<button type="button" class="btn btn-primary" data-auth-href="${xHref}" disabled>${xLabel}</button>`
    : `<a class="btn btn-primary" href="${xHref}">${xLabel}</a>`;
  const secondaryCta = params.turnstileEnabled
    ? `<button type="button" class="btn btn-secondary" data-auth-href="${githubHref}" disabled>${githubLabel}</button>`
    : `<a class="btn btn-secondary" href="${githubHref}">${githubLabel}</a>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${SITE_NAME} | ${isSignup ? "Create Account" : "Login"}</title>
  <meta name="description" content="${isSignup ? SIGNUP_DESCRIPTION : LOGIN_DESCRIPTION}" />
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root {
      --bg: #080b10;
      --panel: rgba(15, 18, 24, 0.92);
      --line: rgba(255, 255, 255, 0.12);
      --text: #e5edf7;
      --muted: #97a7bc;
      --primary: #3ccca2;
      --primary-dark: #2ea787;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Manrope", "IBM Plex Sans", "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(820px 420px at 8% 10%, rgba(60, 204, 162, 0.25), transparent 70%),
        radial-gradient(760px 380px at 92% 80%, rgba(74, 125, 255, 0.18), transparent 65%),
        linear-gradient(180deg, #07090d, #090d13 52%, #06080c);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .panel {
      width: min(100%, 440px);
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--panel);
      backdrop-filter: blur(12px);
      padding: 28px;
      box-shadow: 0 24px 72px rgba(0, 0, 0, 0.48);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 18px;
    }
    .dot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: var(--primary);
      box-shadow: 0 0 0 6px rgba(60, 204, 162, 0.2);
    }
    h1 {
      margin: 0;
      font-size: clamp(26px, 5vw, 34px);
      line-height: 1.08;
      letter-spacing: -0.03em;
    }
    p {
      margin: 10px 0 0;
      color: var(--muted);
      line-height: 1.6;
      font-size: 14px;
    }
    .stack {
      margin-top: 22px;
      display: grid;
      gap: 10px;
    }
    .turnstile-wrap {
      margin-top: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.02);
      padding: 12px 12px 10px;
    }
    .turnstile-row {
      min-height: 66px;
      display: grid;
      place-items: center;
    }
    .turnstile-hint {
      margin-top: 8px;
      color: #8fa5bf;
      font-size: 12px;
      line-height: 1.4;
    }
    .turnstile-error {
      margin-top: 6px;
      color: #fca5a5;
      font-size: 12px;
      min-height: 16px;
    }
    .server-error {
      margin-top: 12px;
      border: 1px solid rgba(252, 165, 165, 0.35);
      background: rgba(252, 165, 165, 0.08);
      color: #fecaca;
      border-radius: 12px;
      font-size: 12px;
      padding: 8px 10px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 46px;
      border-radius: 14px;
      border: 1px solid transparent;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
      width: 100%;
      cursor: pointer;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn[disabled] {
      cursor: not-allowed;
      opacity: 0.55;
      transform: none;
    }
    .btn-primary {
      color: #08251d;
      background: linear-gradient(180deg, #59ddb6, #3ccca2);
      border-color: rgba(60, 204, 162, 0.75);
    }
    .btn-secondary {
      color: var(--text);
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.16);
    }
    .meta {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
    }
    .meta a {
      color: #b6c8df;
      text-decoration: none;
    }
    .meta a:hover { color: #dbe7f8; }
    .home {
      margin-top: 16px;
      display: inline-flex;
      color: #8fa5bf;
      font-size: 12px;
      text-decoration: none;
    }
    .home:hover { color: #d4e2f5; }
  </style>
</head>
<body>
  <main class="panel">
    <div class="brand"><span class="dot"></span><span>${SITE_NAME} Access</span></div>
    <h1>${heading}</h1>
    <p>${subheading}</p>
    ${params.turnstileEnabled ? `<div class="turnstile-wrap">
      <div id="turnstile-widget" class="turnstile-row" aria-live="polite"></div>
      <div id="turnstile-status" class="turnstile-hint">${turnstileHint}</div>
      <div id="turnstile-error" class="turnstile-error"></div>
    </div>` : ""}
    ${serverErrorMessage ? `<div class="server-error">${serverErrorMessage}</div>` : ""}
    <div class="stack">
      ${primaryCta}
      ${secondaryCta}
    </div>
    <div class="meta">
      <span>Secured by Cloudflare Workers</span>
      <a href="${switchHref}">${switchLabel}</a>
    </div>
    <a class="home" href="/">Back to ${SITE_NAME}</a>
  </main>
  ${turnstileScript}
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveAuthErrorCopy(errorCode: string): { title: string; message: string } {
  switch (errorCode) {
    case "unable_to_get_user_info":
      return {
        title: "Unable to retrieve account details",
        message: "OAuth completed, but SentinelStream could not finish retrieving your provider profile. Retry the login flow, then inspect provider permissions and callback handling if it repeats.",
      };
    case "unable_to_create_user":
      return {
        title: "Unable to create your account",
        message: "The upstream provider accepted the login, but local account creation failed. This is usually a worker or backend auth pipeline issue, not an end-user credential problem.",
      };
    case "state_not_found":
      return {
        title: "Login session expired",
        message: `The OAuth callback returned without a valid state token. Start the flow again from ${SITE_NAME} so the security context can be re-established cleanly.`,
      };
    case "invalid_callback_request":
      return {
        title: "Invalid callback payload",
        message: "The provider callback returned incomplete or invalid data. Retry once, then verify the BetterAuth callback and redirect URI configuration if it repeats.",
      };
    case "invalid_code":
      return {
        title: "Authorization code rejected",
        message: "The provider did not accept the returned authorization code. Re-run the flow and verify that the production callback URI and app credentials match the active deployment.",
      };
    case "internal_server_error":
      return {
        title: "Internal auth pipeline error",
        message: `${SITE_NAME} encountered a server-side auth error. Inspect worker and backend logs for the BetterAuth callback path to resolve the failure.`,
      };
    default:
      return {
        title: "Authentication could not be completed",
        message: `The login flow did not finish cleanly. Retry once from the ${SITE_NAME} login page. If it repeats, inspect the provider callback and BetterAuth error trace.`,
      };
  }
}

function renderAuthErrorPage(url: URL): string {
  const rawCode = normalizeString(url.searchParams.get("error")) || normalizeString(url.searchParams.get("state")) || "unknown_auth_error";
  const errorCode = rawCode.toLowerCase();
  const detail = normalizeString(url.searchParams.get("error_description"));
  const copy = resolveAuthErrorCopy(errorCode);
  const safeCode = escapeHtml(errorCode);
  const safeDetail = detail ? escapeHtml(detail) : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${SITE_NAME} | Authentication Error</title>
  <meta name="description" content="Authentication error details for ${SITE_NAME} OAuth login and signup flows." />
  <meta name="robots" content="noindex,nofollow" />
  <style>
    :root {
      --bg: #070b10;
      --panel: rgba(10, 14, 20, 0.92);
      --line: rgba(255, 255, 255, 0.12);
      --text: #e7edf6;
      --muted: #9caabd;
      --primary: #34d399;
      --danger: #fb7185;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      color: var(--text);
      font-family: "Manrope", "IBM Plex Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(820px 420px at 10% 10%, rgba(52, 211, 153, 0.14), transparent 72%),
        radial-gradient(760px 420px at 90% 85%, rgba(59, 130, 246, 0.14), transparent 70%),
        linear-gradient(180deg, #05070b, #090d13 52%, #06080c);
    }
    .panel {
      width: min(100%, 760px);
      border: 1px solid var(--line);
      border-radius: 28px;
      background: var(--panel);
      backdrop-filter: blur(14px);
      box-shadow: 0 28px 88px rgba(0,0,0,0.5);
      padding: 32px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      border: 1px solid rgba(251, 113, 133, 0.28);
      background: rgba(251, 113, 133, 0.1);
      color: #fecdd3;
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--danger);
      box-shadow: 0 0 0 5px rgba(251, 113, 133, 0.15);
    }
    h1 {
      margin: 18px 0 0;
      font-size: clamp(30px, 5vw, 44px);
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    .lede {
      margin: 16px 0 0;
      color: var(--muted);
      line-height: 1.7;
      font-size: 15px;
      max-width: 64ch;
    }
    .card {
      margin-top: 22px;
      border: 1px solid var(--line);
      border-radius: 18px;
      background: rgba(255,255,255,0.03);
      padding: 18px;
    }
    .label {
      color: #99a7ba;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    code {
      margin-top: 10px;
      display: block;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      background: rgba(0,0,0,0.28);
      padding: 12px;
      color: #a7f3d0;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .detail {
      margin-top: 16px;
      color: #d3dbe8;
      font-size: 14px;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }
    .cta-row {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .btn {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      padding: 0 16px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      border: 1px solid transparent;
    }
    .btn-primary {
      background: linear-gradient(180deg, #59ddb6, #34d399);
      border-color: rgba(52, 211, 153, 0.78);
      color: #06291f;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.04);
      border-color: rgba(255,255,255,0.14);
      color: var(--text);
    }
    .operator-note {
      margin-top: 20px;
      border: 1px solid rgba(245, 158, 11, 0.22);
      background: rgba(245, 158, 11, 0.08);
      color: #fde68a;
      border-radius: 18px;
      padding: 16px;
      font-size: 14px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <main class="panel">
    <div class="badge"><span class="badge-dot"></span><span>Authentication Error</span></div>
    <h1>${escapeHtml(copy.title)}</h1>
    <p class="lede">${escapeHtml(copy.message)}</p>
    <section class="card">
      <div class="label">Error Code</div>
      <code>${safeCode}</code>
      ${safeDetail ? `<div class="label" style="margin-top:16px">Provider Detail</div><div class="detail">${safeDetail}</div>` : ""}
    </section>
    <div class="cta-row">
      <a class="btn btn-primary" href="/login">Retry Login</a>
      <a class="btn btn-secondary" href="/signup">Create Account</a>
      <a class="btn btn-secondary" href="/">Back Home</a>
    </div>
    <div class="operator-note">
      <strong>Operator note</strong><br />
      If this repeats after a fresh OAuth attempt, inspect the BetterAuth callback trace, provider redirect URI, and downstream user creation pipeline.
    </div>
  </main>
</body>
</html>`;
}

function handleAuthPage(params: {
  mode: TurnstileMode;
  env: Env;
  url: URL;
}): Response {
  const turnstileEnabled = isTurnstileEnabled(params.env);
  const turnstileSiteKey = resolveTurnstileSiteKey(params.env);
  const errorCode = normalizeString(params.url.searchParams.get("error"));
  const nextPath = normalizeSafePostAuthPath(params.url.searchParams.get("next"));
  return withDefaultSecurityHeaders(new Response(renderAuthPage({
    mode: params.mode,
    turnstileEnabled,
    turnstileSiteKey,
    errorCode,
    nextPath,
  }), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  }));
}

// ============================================================================
// X (Twitter) OAuth 2.0 with PKCE
// ============================================================================

async function refreshXAccessToken(
  env: Env,
  refreshToken: string,
): Promise<Record<string, string>> {
  const clientId = env.X_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.X_CLIENT_SECRET?.trim() ?? "";
  const safeRefreshToken = refreshToken.trim();
  if (!clientId) {
    return {
      error: "server_misconfigured",
      error_description: "X client id is missing.",
    };
  }
  if (!safeRefreshToken) {
    return {
      error: "invalid_refresh_token",
      error_description: "X refresh token is missing.",
    };
  }

  const tokenBodyBase = {
    grant_type: "refresh_token",
    refresh_token: safeRefreshToken,
  };

  const modeRaw = env.X_OAUTH_CLIENT_TYPE?.trim().toLowerCase();
  const preferredMode = modeRaw === "public" || modeRaw === "confidential"
    ? modeRaw
    : clientSecret
    ? "confidential"
    : "public";
  if (preferredMode === "confidential" && !clientSecret) {
    return {
      error: "server_misconfigured",
      error_description: "X OAuth client is confidential but X_CLIENT_SECRET is missing.",
    };
  }

  const requestToken = async (
    mode: "public" | "confidential",
    authorizationHeader: string | null,
  ): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    if (authorizationHeader) {
      headers.Authorization = authorizationHeader;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const body = new URLSearchParams({
          ...tokenBodyBase,
          ...(mode === "confidential" && authorizationHeader ? {} : { client_id: clientId }),
        });
        const res = await fetch("https://api.x.com/2/oauth2/token", {
          method: "POST",
          cache: "no-store",
          headers,
          body,
          signal: AbortSignal.timeout(X_API_TIMEOUT_MS),
        });

        const rawBody = await res.text().catch(() => "");
        let parsed: Record<string, unknown> | null = null;
        if (rawBody.trim().length > 0) {
          try {
            parsed = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            parsed = null;
          }
        }

        const normalized: Record<string, string> = {};
        if (parsed) {
          for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === "string") {
              normalized[key] = value;
            } else if (typeof value === "number" || typeof value === "boolean") {
              normalized[key] = String(value);
            }
          }
        }

        if (res.ok && normalized.access_token) {
          return normalized;
        }

        const fallbackError = res.ok ? "token_response_invalid" : `token_http_${res.status}`;
        const fallbackDetail = rawBody.slice(0, 260) || `X token refresh failed with status ${res.status}.`;
        if (!normalized.error) normalized.error = fallbackError;
        if (!normalized.error_description) normalized.error_description = fallbackDetail;

        if (isRetriableXStatus(res.status) && attempt < 2) {
          const retryAfterMs = parseRetryAfterMs(res);
          const fallbackBackoff = Math.min(2_500, 450 * attempt * attempt);
          await delayMs(retryAfterMs ?? fallbackBackoff);
          continue;
        }

        return normalized;
      } catch (error) {
        if (attempt < 2) {
          const fallbackBackoff = Math.min(2_500, 450 * attempt * attempt);
          await delayMs(fallbackBackoff);
          continue;
        }
        return {
          error: "token_request_failed",
          error_description: String(error),
        };
      }
    }

    return {
      error: "token_request_failed",
      error_description: "Token refresh failed after retries.",
    };
  };

  const attempts: Array<{ mode: "public" | "confidential"; auth: string | null }> = [];
  const enqueueAttempt = (mode: "public" | "confidential") => {
    if (mode === "confidential" && !clientSecret) return;
    if (attempts.some((attempt) => attempt.mode === mode)) return;
    attempts.push({
      mode,
      auth: mode === "confidential" ? `Basic ${btoa(`${clientId}:${clientSecret}`)}` : null,
    });
  };

  enqueueAttempt(preferredMode);
  enqueueAttempt(preferredMode === "confidential" ? "public" : "confidential");

  let lastError: Record<string, string> = {
    error: "token_request_failed",
    error_description: "Token refresh failed before request execution.",
  };

  for (const attempt of attempts) {
    const tokenData = await requestToken(attempt.mode, attempt.auth);
    if (tokenData.access_token && !tokenData.error) {
      return tokenData;
    }
    lastError = tokenData.error ? tokenData : {
      ...tokenData,
      error: tokenData.error || "token_request_failed",
      error_description: tokenData.error_description || "Token refresh attempt failed.",
    };
  }

  return lastError;
}

async function fetchXUserInfoWithRetry(
  accessToken: string,
): Promise<{ user: { username: string; name: string; avatar_url: string; id?: string } | null; error: string | null }> {
  const endpoints: Array<{ url: string; parser: "v2" | "v11" }> = [
    { url: "https://api.x.com/2/users/me?user.fields=id,profile_image_url,name,username", parser: "v2" },
    { url: "https://api.x.com/2/users/me", parser: "v2" },
    { url: "https://api.twitter.com/2/users/me?user.fields=id,profile_image_url,name,username", parser: "v2" },
    { url: "https://api.twitter.com/2/users/me", parser: "v2" },
  ];

  return tryXProfileEndpoints(accessToken, endpoints, 2);
}

async function fetchXUserByIdWithRetry(
  accessToken: string,
  userId: string,
): Promise<{ user: { username: string; name: string; avatar_url: string; id?: string } | null; error: string | null }> {
  const safeUserId = userId.trim();
  if (!safeUserId) {
    return { user: null, error: "missing_user_id" };
  }
  const encoded = encodeURIComponent(safeUserId);
  const endpoints: Array<{ url: string; parser: "v2" | "v11" }> = [
    { url: `https://api.x.com/2/users/${encoded}?user.fields=id,profile_image_url,name,username`, parser: "v2" },
    { url: `https://api.x.com/2/users/${encoded}`, parser: "v2" },
    { url: `https://api.twitter.com/2/users/${encoded}?user.fields=id,profile_image_url,name,username`, parser: "v2" },
    { url: `https://api.twitter.com/2/users/${encoded}`, parser: "v2" },
  ];

  return tryXProfileEndpoints(accessToken, endpoints, 2);
}

async function fetchXUserByUsernameWithAppBearer(
  env: Env,
  username: string,
): Promise<{ user: { username: string; name: string; avatar_url: string; id?: string } | null; error: string | null }> {
  const bearer = (env.X_BEARER_TOKEN ?? "").trim();
  const safeUsername = username.trim().replace(/^@+/, "");
  if (!bearer || !safeUsername) {
    return { user: null, error: "missing_app_bearer_or_username" };
  }
  const encoded = encodeURIComponent(safeUsername);
  const endpoints: Array<{ url: string; parser: "v2" | "v11" }> = [
    { url: `https://api.x.com/2/users/by/username/${encoded}?user.fields=id,profile_image_url,name,username`, parser: "v2" },
    { url: `https://api.twitter.com/2/users/by/username/${encoded}?user.fields=id,profile_image_url,name,username`, parser: "v2" },
  ];
  return tryXProfileEndpoints(bearer, endpoints, 2);
}

function normalizeXUserIdHint(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  // BetterAuth provisional IDs use synthetic prefixes that are not valid X user IDs.
  if (raw.toLowerCase().startsWith("xid_")) {
    const candidate = raw.slice(4).trim();
    return /^[0-9]{5,}$/.test(candidate) ? candidate : null;
  }
  if (raw.toLowerCase().startsWith("xacct-")) {
    return null;
  }
  return /^[0-9]{5,}$/.test(raw) ? raw : null;
}

function normalizeXAvatarUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "";
  }
  const host = parsed.hostname.toLowerCase();
  const trustedHost = host === "pbs.twimg.com" || host === "abs.twimg.com" || host.endsWith(".twimg.com");
  if (!trustedHost || parsed.protocol !== "https:") {
    return "";
  }
  return parsed.toString().replace("_normal.", "_400x400.");
}

function extractXUser(parsed: unknown, parser: "v2" | "v11"): { username: string; name: string; avatar_url: string; id?: string } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const data = parser === "v2"
    ? (root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null)
    : root;
  if (!data) return null;

  const usernameKey = parser === "v2" ? "username" : "screen_name";
  const avatarKey = parser === "v2" ? "profile_image_url" : "profile_image_url_https";
  const username = typeof data[usernameKey] === "string" ? data[usernameKey].trim() : "";
  if (!username) return null;
  const name = typeof data.name === "string" && data.name.trim().length > 0 ? data.name.trim() : username;
  const avatarRaw = typeof data[avatarKey] === "string" ? data[avatarKey] : "";
  const idRaw = data.id_str ?? data.id;

  return {
    username,
    name,
    avatar_url: normalizeXAvatarUrl(avatarRaw),
    id: typeof idRaw === "string" || typeof idRaw === "number" ? String(idRaw) : undefined,
  };
}

function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("Retry-After");
  if (!raw) return null;
  const sec = Number.parseInt(raw, 10);
  if (Number.isFinite(sec) && sec >= 0) {
    return Math.min(5_000, sec * 1000);
  }
  const dateMs = Date.parse(raw);
  if (!Number.isNaN(dateMs)) {
    return Math.min(5_000, Math.max(0, dateMs - Date.now()));
  }
  return null;
}

function isRetriableXStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function delayMs(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientXProfileFailure(errorText: string | null): boolean {
  if (!errorText) return false;
  return (
    /HTTP 5\d\d/i.test(errorText) ||
    /timed out/i.test(errorText) ||
    /network/i.test(errorText) ||
    /fetch/i.test(errorText)
  );
}

async function tryXProfileEndpoints(
  accessToken: string,
  endpoints: Array<{ url: string; parser: "v2" | "v11" }>,
  maxAttempts: number,
): Promise<{ user: { username: string; name: string; avatar_url: string; id?: string } | null; error: string | null }> {
  let lastError: string | null = null;
  let preferredError: string | null = null;
  const endpointErrors: string[] = [];
  const startedAt = Date.now();

  for (const endpoint of endpoints) {
    if (Date.now() - startedAt >= X_PROFILE_MAX_TOTAL_MS) {
      return { user: null, error: lastError ?? "profile_lookup_timeout" };
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(endpoint.url, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
            "User-Agent": `SentinelStream-Auth/1.0 (+${SITE_ORIGIN})`,
          },
          signal: AbortSignal.timeout(X_API_TIMEOUT_MS),
        });
        const parsed = (await response.json().catch(() => null)) as Record<string, unknown> | null;
        const user = response.ok ? extractXUser(parsed, endpoint.parser) : null;
        if (user) {
          return { user, error: null };
        }

        const bodySnippet = parsed ? JSON.stringify(parsed).slice(0, 260) : "unknown";
        lastError = `HTTP ${response.status} [${endpoint.url}] ${bodySnippet}`;
        if (endpointErrors.length < 8) {
          endpointErrors.push(lastError);
        }
        const detail = typeof parsed?.detail === "string" ? parsed.detail.toLowerCase() : "";
        const title = typeof parsed?.title === "string" ? parsed.title.toLowerCase() : "";
        const problemType = typeof parsed?.type === "string" ? parsed.type.toLowerCase() : "";
        const unsupportedOAuthEndpoint =
          detail.includes("not permitted to use oauth2 on this endpoint") ||
          detail.includes("unsupported authentication") ||
          title.includes("unsupported authentication") ||
          problemType.includes("unsupported-authentication");
        if (unsupportedOAuthEndpoint) {
          preferredError = preferredError ?? lastError;
          break;
        }
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 429
        ) {
          preferredError = lastError;
          if (
            detail.includes("unsupported authentication") ||
            title.includes("unsupported authentication") ||
            problemType.includes("unsupported-authentication")
          ) {
            return { user: null, error: preferredError };
          }
        }
        if (isRetriableXStatus(response.status) && attempt < maxAttempts) {
          const retryAfterMs = parseRetryAfterMs(response);
          const fallbackBackoff = Math.min(2_500, 450 * attempt * attempt);
          if (Date.now() - startedAt >= X_PROFILE_MAX_TOTAL_MS) {
            return { user: null, error: lastError };
          }
          await delayMs(retryAfterMs ?? fallbackBackoff);
          continue;
        }
      } catch (error) {
        lastError = String(error);
        if (endpointErrors.length < 8) {
          endpointErrors.push(`FETCH_ERROR [${endpoint.url}] ${lastError}`);
        }
        if (attempt < maxAttempts) {
          const fallbackBackoff = Math.min(2_500, 450 * attempt * attempt);
          if (Date.now() - startedAt >= X_PROFILE_MAX_TOTAL_MS) {
            return { user: null, error: lastError };
          }
          await delayMs(fallbackBackoff);
          continue;
        }
      }
      break;
    }
  }

  const primaryError = preferredError ?? lastError ?? "unknown";
  if (endpointErrors.length <= 1) {
    return { user: null, error: primaryError };
  }
  const trace = endpointErrors
    .map((entry) => entry.slice(0, 180))
    .join(" || ")
    .slice(0, 1200);
  return { user: null, error: `${primaryError} | trace: ${trace}` };
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const decoded = new TextDecoder().decode(fromBase64Url(parts[1]!));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseJwtSub(accessToken: string): string | null {
  const parsed = parseJwtClaims(accessToken);
  if (!parsed) return null;
  const sub = typeof parsed.sub === "string" ? parsed.sub.trim() : "";
  return sub.length > 0 ? sub : null;
}

function parseClaimString(claims: Record<string, unknown>, key: string): string | null {
  const value = claims[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildXUserFromTokenClaims(tokenData: Record<string, string>): { username: string; name: string; avatar_url: string; id: string } | null {
  const candidates = [tokenData.id_token, tokenData.access_token]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);

  for (const token of candidates) {
    const claims = parseJwtClaims(token);
    if (!claims) continue;
    const username =
      parseClaimString(claims, "preferred_username") ??
      parseClaimString(claims, "username") ??
      parseClaimString(claims, "screen_name");
    if (!username) continue;

    const id =
      parseClaimString(claims, "sub") ??
      parseClaimString(claims, "user_id") ??
      parseClaimString(claims, "id") ??
      username;

    const name = parseClaimString(claims, "name") ?? username;
    const avatar = normalizeXAvatarUrl(
      parseClaimString(claims, "picture") ??
      parseClaimString(claims, "profile_image_url") ??
      "",
    );
    return {
      username,
      name,
      avatar_url: avatar,
      id,
    };
  }

  return null;
}

async function buildProvisionalXUser(accessToken: string): Promise<{ username: string; name: string; avatar_url: string; id: string }> {
  const sub = parseJwtSub(accessToken);
  if (sub) {
    const suffix = sub.replace(/[^a-zA-Z0-9_-]/g, "").slice(-10) || "user";
    return {
      id: sub,
      username: `xacct_${suffix}`,
      name: "X Account",
      avatar_url: "",
    };
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken),
  );
  const hash = Array.from(new Uint8Array(digest).slice(0, 6))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return {
    id: `xacct-${hash}`,
    username: `xacct_${hash}`,
    name: "X Account",
    avatar_url: "",
  };
}

async function resolveXUserProfile(args: {
  env: Env;
  accessToken: string;
  refreshToken?: string | null;
  userIdHint?: string | null;
  usernameHint?: string | null;
  tokenData?: Record<string, string>;
  allowProvisional: boolean;
}): Promise<{ user: { username: string; name: string; avatar_url: string; id?: string } | null; error: string | null }> {
  const meResult = await fetchXUserInfoWithRetry(args.accessToken);
  let xUser = meResult.user;
  let profileError = meResult.error;

  if (!xUser) {
    const subjectId =
      normalizeXUserIdHint(args.userIdHint) ??
      parseJwtSub(args.accessToken) ??
      parseJwtSub(args.refreshToken ?? "");
    if (subjectId) {
      const byIdResult = await fetchXUserByIdWithRetry(args.accessToken, subjectId);
      xUser = byIdResult.user;
      profileError = byIdResult.error ?? profileError;
    }
  }

  if (!xUser) {
    const claimsSource = args.tokenData ?? { access_token: args.accessToken };
    xUser = buildXUserFromTokenClaims(claimsSource);
  }

  if (!xUser) {
    const usernameHint = normalizeString(args.usernameHint);
    if (usernameHint && !isSyntheticXIdentity(usernameHint, usernameHint)) {
      const byUsernameResult = await fetchXUserByUsernameWithAppBearer(args.env, usernameHint);
      xUser = byUsernameResult.user;
      profileError = byUsernameResult.error ?? profileError;
    }
  }

  if (!xUser && args.allowProvisional && isTransientXProfileFailure(profileError)) {
    xUser = await buildProvisionalXUser(args.accessToken);
  }

  return {
    user: xUser,
    error: profileError,
  };
}

function isDashboardAppRoute(path: string): boolean {
  for (const prefix of DASHBOARD_APP_ROUTE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

function normalizeBuildAssetPath(path: string): string {
  if (path.startsWith("/_build/")) return path;
  if (path.startsWith("/")) return `/_build${path}`;
  return `/_build/${path}`;
}

function collectCssForEntry(
  key: string,
  manifest: Record<string, ViteManifestEntry>,
  seen: Set<string>,
  cssOut: Set<string>,
): void {
  if (seen.has(key)) return;
  seen.add(key);

  const entry = manifest[key];
  if (!entry) return;

  for (const cssPath of entry.css || []) {
    cssOut.add(normalizeBuildAssetPath(cssPath));
  }

  for (const dep of entry.imports || []) {
    collectCssForEntry(dep, manifest, seen, cssOut);
  }
}

function buildClientInputManifest(
  manifest: Record<string, ViteManifestEntry>,
): Record<string, ClientInputManifestEntry> {
  const output: Record<string, ClientInputManifestEntry> = {};

  for (const [key, entry] of Object.entries(manifest)) {
    if (!entry.file) continue;

    const cssSet = new Set<string>();
    collectCssForEntry(key, manifest, new Set<string>(), cssSet);

    output[key] = {
      output: normalizeBuildAssetPath(entry.file),
      assets: [...cssSet]
        .sort((a, b) => a.localeCompare(b))
        .map((href) => ({
          tag: "link",
          attrs: { rel: "stylesheet", href },
        })),
    };
  }

  return output;
}

function escapeForInlineScript(rawJson: string): string {
  return rawJson
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

async function loadDashboardShellBundle(
  env: Env,
  requestUrl: URL,
): Promise<DashboardShellBundle | null> {
  if (dashboardShellCache && Date.now() - dashboardShellCache.loadedAtMs < DASHBOARD_SHELL_CACHE_TTL_MS) {
    return dashboardShellCache;
  }

  const manifestUrl = new URL(requestUrl.toString());
  manifestUrl.pathname = VITE_MANIFEST_ASSET_PATH;
  manifestUrl.search = "";
  manifestUrl.hash = "";

  const manifestRes = await env.ASSETS.fetch(new Request(manifestUrl.toString(), { method: "GET" }));
  if (!manifestRes.ok) {
    return null;
  }

  const manifest = (await manifestRes.json()) as Record<string, ViteManifestEntry>;
  const clientEntryKey = "virtual:$vinxi/handler/client";
  const clientEntry = manifest[clientEntryKey];
  if (!clientEntry?.file) {
    return null;
  }

  const entryStyles = new Set<string>();
  collectCssForEntry(clientEntryKey, manifest, new Set<string>(), entryStyles);

  dashboardShellCache = {
    entryScript: normalizeBuildAssetPath(clientEntry.file),
    entryStyles: [...entryStyles].sort((a, b) => a.localeCompare(b)),
    manifest: buildClientInputManifest(manifest),
    loadedAtMs: Date.now(),
  };

  return dashboardShellCache;
}

function resolveDashboardShellMetadata(path: string): DashboardShellMetadata {
  return {
    title: resolveDashboardShellTitle(path),
  };
}

function renderDashboardAppShellWithMetadata(bundle: DashboardShellBundle, path: string): Response {
  const styles = bundle.entryStyles
    .map((href) => `<link rel="stylesheet" href="${href}" />`)
    .join("\n");
  const manifestJson = escapeForInlineScript(JSON.stringify(bundle.manifest));
  const metadata = resolveDashboardShellMetadata(path);

  const html = `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(metadata.title)}</title>
  <meta name="robots" content="noindex,nofollow" />
  ${styles}
</head>
<body>
  <div id="app"></div>
  <script>
    window._$HY = window._$HY || { done: true, events: [], r: {}, completed: new WeakSet() };
  </script>
  <script>window.manifest=${manifestJson};</script>
  <script type="module" src="${bundle.entryScript}"></script>
</body>
</html>`;

  return withDefaultSecurityHeaders(new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
      "CDN-Cache-Control": "no-store",
      Vary: "Accept-Encoding",
    },
  }));
}

// ============================================================================
// Main Worker
// ============================================================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin");
    let authInstance: ReturnType<typeof createEdgeAuth> | null = null;
    const getAuth = (): ReturnType<typeof createEdgeAuth> => {
      if (authInstance) return authInstance;
      const requestWithCf = request as Request & { cf?: IncomingRequestCfProperties };
      authInstance = createEdgeAuth(env, requestWithCf.cf ?? null);
      return authInstance;
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return withDefaultSecurityHeaders(new Response(null, {
        headers: {
          ...corsHeaders(origin),
          "Access-Control-Max-Age": "86400",
        },
      }));
    }

    // ----------------------------------------------------------------
    // Auth routes (no session required)
    // ----------------------------------------------------------------
    if (path === "/login") return handleAuthPage({ mode: "login", env, url });
    if (path === "/signup") return handleAuthPage({ mode: "signup", env, url });
    if (path === "/auth/error") {
      return withDefaultSecurityHeaders(new Response(renderAuthErrorPage(url), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      }));
    }
    if (path === "/api/auth/turnstile/verify") {
      return withSensitiveNoStore(await handleTurnstileVerifyApi({
        request,
        env,
        origin,
      }));
    }
    if (GITHUB_LOGIN_PATHS.has(path)) {
      const turnstileMode = resolveExpectedTurnstileModeForAuthPath(path);
      const nextPath = normalizeSafePostAuthPath(url.searchParams.get("next"));
      const blocked = await enforceTurnstileGateForAuthStart({
        request,
        env,
        mode: turnstileMode,
        nextPath,
      });
      if (blocked) {
        return withSensitiveNoStore(blocked);
      }
      const loginResponse = await startBetterAuthSocialLogin({
        auth: getAuth(),
        request,
        provider: "github",
        mode: turnstileMode,
        nextPath,
      });
      return withSensitiveNoStore(appendSetCookie(loginResponse, clearCookie(TURNSTILE_PASS_COOKIE)));
    }
    if (X_LOGIN_PATHS.has(path)) {
      const turnstileMode = resolveExpectedTurnstileModeForAuthPath(path);
      const nextPath = normalizeSafePostAuthPath(url.searchParams.get("next"));
      const blocked = await enforceTurnstileGateForAuthStart({
        request,
        env,
        mode: turnstileMode,
        nextPath,
      });
      if (blocked) {
        return withSensitiveNoStore(blocked);
      }
      const loginResponse = await startBetterAuthSocialLogin({
        auth: getAuth(),
        request,
        provider: "twitter",
        mode: turnstileMode,
        nextPath,
      });
      return withSensitiveNoStore(appendSetCookie(loginResponse, clearCookie(TURNSTILE_PASS_COOKIE)));
    }
    if (LOGOUT_PATHS.has(path)) {
      return withSensitiveNoStore(await logoutWithBetterAuth({
        auth: getAuth(),
        request,
      }));
    }

    if (path.startsWith("/auth/") || path.startsWith("/oauth/")) {
      const rewrittenPath = rewriteLegacyAuthPath(path);
      if (rewrittenPath !== path) {
        const rewrittenUrl = new URL(request.url);
        rewrittenUrl.pathname = rewrittenPath;
        return withSensitiveNoStore(await getAuth().handler(new Request(rewrittenUrl.toString(), request)));
      }
      return withSensitiveNoStore(await getAuth().handler(request));
    }

    if (path === "/api/webhooks/stripe") return withSensitiveNoStore(await handleStripeWebhook({ request, env, origin }));

    if (REMOVED_PAGE_PATHS.has(path)) {
      return withDefaultSecurityHeaders(new Response(null, {
        status: 302,
        headers: {
          Location: `${ORIGIN}/`,
        },
      }));
    }

    if (path === "/robots.txt") {
      const robots = buildRobotsTxt();
      return withDefaultSecurityHeaders(new Response(robots, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600, s-maxage=3600",
        },
      }));
    }

    if (path === "/sitemap.xml") {
      const sitemap = buildSitemapXml(new Date().toISOString());
      return withDefaultSecurityHeaders(new Response(sitemap, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600, s-maxage=3600",
        },
      }));
    }

    if (path === "/") {
      const landingHtml = `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${PRODUCTION_HOME_TITLE}</title>
  <meta name="description" content="${PRODUCTION_HOME_DESCRIPTION}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <meta name="theme-color" content="#0b2238" />
  <meta name="keywords" content="OSINT dashboard, geopolitical intelligence, real-time conflict monitoring, open source intelligence platform, threat intelligence feed" />
  <link rel="canonical" href="${siteUrl("/")}" />
  <link rel="alternate" href="${siteUrl("/")}" hreflang="en-us" />
  <link rel="alternate" href="${siteUrl("/")}" hreflang="x-default" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:title" content="${PRODUCTION_HOME_TITLE}" />
  <meta property="og:description" content="${PRODUCTION_HOME_OG_DESCRIPTION}" />
  <meta property="og:url" content="${siteUrl("/")}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${PRODUCTION_HOME_TITLE}" />
  <meta name="twitter:description" content="${PRODUCTION_HOME_TWITTER_DESCRIPTION}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap" rel="stylesheet" />

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "${SITE_NAME}",
        "url": "${siteUrl("/")}"
      },
      {
        "@type": "WebSite",
        "name": "${SITE_NAME}",
        "url": "${siteUrl("/")}",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "${siteUrl("/osint")}?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "SoftwareApplication",
        "name": "${SITE_NAME}",
        "applicationCategory": "SecurityApplication",
        "operatingSystem": "Web",
        "description": "Real-time OSINT intelligence platform for geopolitical and conflict monitoring.",
        "offers": [
          {
            "@type": "Offer",
            "name": "${FREE_PLAN_NAME}",
            "price": "0",
            "priceCurrency": "USD"
          },
          {
            "@type": "Offer",
            "name": "${PREMIUM_PLAN_NAME}",
            "price": "${PREMIUM_PRICE_USD}",
            "priceCurrency": "USD"
          }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          ${LANDING_FAQ_ITEMS.map((item) => `{
            "@type": "Question",
            "name": ${JSON.stringify(item.question)},
            "acceptedAnswer": {
              "@type": "Answer",
              "text": ${JSON.stringify(item.answer)}
            }
          }`).join(",\n          ")}
        ]
      }
    ]
  }
  </script>

  <style>
    :root {
      --page: #f3f9ff;
      --ink: #0b2238;
      --ink-soft: #38536f;
      --line: rgba(14, 58, 97, 0.14);
      --line-soft: rgba(14, 58, 97, 0.09);
      --surface: rgba(255, 255, 255, 0.92);
      --surface-solid: #ffffff;
      --primary: #0ea5e9;
      --primary-deep: #0369a1;
      --accent: #f97316;
      --accent-deep: #c2410c;
      --success: #10b981;
      --radius-lg: 30px;
      --radius-md: 18px;
      --radius-sm: 12px;
      --container: 1180px;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      color: var(--ink);
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(1000px 520px at 0% 0%, rgba(14, 165, 233, 0.26), transparent 70%),
        radial-gradient(840px 460px at 100% 100%, rgba(249, 115, 22, 0.16), transparent 74%),
        linear-gradient(180deg, #f7fbff, #edf6ff 44%, #e6f2ff);
      overflow-x: hidden;
    }
    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(to right, rgba(17, 62, 102, 0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(17, 62, 102, 0.05) 1px, transparent 1px);
      background-size: 36px 36px;
      opacity: 0.4;
    }
    .skip-link {
      position: absolute;
      left: -9999px;
      top: auto;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    .skip-link:focus {
      left: 10px;
      top: 10px;
      width: auto;
      height: auto;
      padding: 10px 12px;
      border-radius: 10px;
      background: #ffffff;
      color: #07335a;
      z-index: 9999;
    }
    .page {
      position: relative;
      z-index: 1;
      max-width: var(--container);
      margin: 0 auto;
      padding: 16px 16px 76px;
    }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 14px;
      border: 1px solid var(--line);
      border-radius: var(--radius-md);
      background: var(--surface);
      backdrop-filter: blur(12px);
      box-shadow: 0 12px 32px rgba(7, 38, 66, 0.08);
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      color: #0c2d4a;
      letter-spacing: -0.02em;
      text-decoration: none;
      font-size: 15px;
    }
    .brand-dot {
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: var(--success);
      box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.18);
    }
    .nav {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .link-chip, .cta-chip {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      text-decoration: none;
      font-size: 11px;
      padding: 8px 14px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-weight: 700;
      transition: transform 160ms ease, background 160ms ease, border-color 160ms ease, color 160ms ease;
      cursor: pointer;
      border: 1px solid #bde4fb;
      color: #0b4a76;
      background: #f2faff;
    }
    .link-chip:hover, .cta-chip:hover { transform: translateY(-1px); }
    .cta-chip {
      background: var(--accent);
      color: #fff;
      border-color: var(--accent);
    }
    .cta-chip:hover {
      background: var(--accent-deep);
      border-color: var(--accent-deep);
    }
    .hero {
      margin-top: 16px;
      border: 1px solid var(--line);
      border-radius: var(--radius-lg);
      background: var(--surface);
      box-shadow: 0 24px 64px rgba(9, 37, 62, 0.13);
      display: grid;
      grid-template-columns: 1.08fr 0.92fr;
      gap: 18px;
      padding: 26px;
      overflow: hidden;
      position: relative;
    }
    .hero::after {
      content: "";
      position: absolute;
      width: 410px;
      height: 410px;
      top: -180px;
      right: -120px;
      border-radius: 999px;
      background: radial-gradient(circle at center, rgba(14, 165, 233, 0.2), transparent 70%);
      pointer-events: none;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid #bae6fd;
      border-radius: 999px;
      padding: 6px 11px;
      background: #eff9ff;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #0a5689;
      font-weight: 700;
    }
    .eyebrow i {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--primary);
      box-shadow: 0 0 0 5px rgba(14, 165, 233, 0.14);
    }
    h1 {
      margin: 14px 0 0;
      font-family: "Source Serif 4", Georgia, serif;
      font-size: clamp(37px, 6.3vw, 69px);
      line-height: 0.93;
      letter-spacing: -0.03em;
      color: #07243d;
      max-width: 13ch;
    }
    .lead {
      margin: 18px 0 0;
      font-size: 16px;
      line-height: 1.62;
      color: var(--ink-soft);
      max-width: 66ch;
    }
    .hero-list {
      margin: 15px 0 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 8px;
      color: #234d73;
      font-size: 14px;
    }
    .hero-list li {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .hero-list li::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 999px;
      background: #10b981;
      box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.16);
      flex-shrink: 0;
    }
    .cta-row {
      margin-top: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .btn {
      min-height: 46px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 14px;
      text-decoration: none;
      border: 1px solid transparent;
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 700;
      transition: transform 170ms ease, background 170ms ease, border-color 170ms ease, color 170ms ease;
      cursor: pointer;
    }
    .btn:hover { transform: translateY(-1px); }
    .btn-primary {
      color: #fff;
      background: var(--accent);
      border-color: var(--accent);
    }
    .btn-primary:hover {
      background: var(--accent-deep);
      border-color: var(--accent-deep);
    }
    .btn-secondary {
      color: #0d4872;
      border-color: #bae6fd;
      background: #eff9ff;
    }
    .btn-secondary:hover {
      background: #dff3ff;
      border-color: #7dd3fc;
    }
    .note {
      margin-top: 10px;
      font-size: 12px;
      color: #557693;
    }
    .panel {
      border: 1px solid #193f67;
      border-radius: 20px;
      background: linear-gradient(180deg, #0e2136, #0a1a2c);
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(7, 27, 46, 0.35);
      position: relative;
      z-index: 1;
    }
    .panel-head {
      height: 38px;
      border-bottom: 1px solid rgba(167, 203, 238, 0.28);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 12px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #a7c9ea;
      background: rgba(11, 30, 50, 0.65);
    }
    .lights { display: inline-flex; gap: 6px; }
    .lights span {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: #8fc0ec;
    }
    .panel-body {
      padding: 12px;
      display: grid;
      gap: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
      color: #d0e6fa;
    }
    .panel-body b { color: #ffffff; font-weight: 700; }
    .panel-body .ok { color: #86efac; }
    .kpis {
      padding: 0 12px 12px;
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .kpi {
      border: 1px solid rgba(156, 203, 246, 0.33);
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.04);
      padding: 9px;
    }
    .kpi strong {
      display: block;
      color: #fff;
      font-size: 17px;
      letter-spacing: -0.01em;
    }
    .kpi span {
      display: block;
      margin-top: 3px;
      color: #bed8ef;
      font-size: 12px;
    }
    .section {
      margin-top: 14px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--surface);
      padding: 20px;
      box-shadow: 0 14px 34px rgba(10, 35, 62, 0.1);
    }
    .section h2 {
      margin: 0;
      font-size: 25px;
      letter-spacing: -0.02em;
      color: #0b2f4c;
    }
    .section p {
      margin: 9px 0 0;
      font-size: 14px;
      line-height: 1.56;
      color: var(--ink-soft);
      max-width: 74ch;
    }
    .grid-3 {
      margin-top: 13px;
      display: grid;
      gap: 11px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .card {
      border: 1px solid #d1e9fb;
      border-radius: var(--radius-sm);
      padding: 13px;
      background: #f8fcff;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 24px rgba(11, 44, 78, 0.09);
    }
    .card h3 {
      margin: 0;
      font-size: 15px;
      color: #103c62;
      letter-spacing: -0.01em;
    }
    .card p {
      margin-top: 7px;
      font-size: 13px;
      color: #54708a;
      line-height: 1.52;
    }
    .steps {
      margin-top: 12px;
      display: grid;
      gap: 11px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    .step {
      border: 1px solid #d1e9fb;
      border-radius: var(--radius-sm);
      background: #f8fcff;
      padding: 12px;
    }
    .step small {
      display: inline-flex;
      min-width: 30px;
      min-height: 24px;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid #a3d8f6;
      color: #0c5d8f;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: #ebf8ff;
      font-size: 10px;
    }
    .step h3 {
      margin: 9px 0 0;
      font-size: 15px;
      color: #113e63;
      letter-spacing: -0.01em;
    }
    .step p {
      margin-top: 7px;
      font-size: 13px;
      color: #55728d;
      line-height: 1.52;
    }
    .pricing {
      margin-top: 12px;
      display: grid;
      gap: 11px;
      grid-template-columns: 1fr 1fr;
    }
    .price-card {
      border: 1px solid #d4e9fa;
      border-radius: 14px;
      background: #f9fdff;
      padding: 14px;
    }
    .price-card h3 {
      margin: 0;
      font-size: 18px;
      letter-spacing: -0.01em;
      color: #0f3a5f;
    }
    .price {
      margin-top: 8px;
      font-size: 13px;
      color: #4f6e89;
    }
    .price strong {
      font-size: 30px;
      letter-spacing: -0.02em;
      color: #082a45;
    }
    .price-list {
      margin: 10px 0 0;
      padding-left: 18px;
      color: #476a87;
      font-size: 13px;
      line-height: 1.6;
    }
    .price-list li { margin: 0; }
    .price-card.premium {
      border-color: #f6bf93;
      background: linear-gradient(160deg, rgba(249, 115, 22, 0.14), #fffaf5 72%);
    }
    .faq {
      margin-top: 12px;
      display: grid;
      gap: 10px;
    }
    .faq-item {
      border: 1px solid #d1e8fb;
      border-radius: var(--radius-sm);
      background: #f9fdff;
      padding: 12px;
    }
    .faq-item h3 {
      margin: 0;
      font-size: 15px;
      color: #123f66;
      letter-spacing: -0.01em;
    }
    .faq-item p {
      margin-top: 7px;
      font-size: 13px;
      color: #55708a;
      line-height: 1.5;
    }
    .final-cta {
      margin-top: 14px;
      border: 1px solid #f5c199;
      border-radius: 24px;
      background: linear-gradient(165deg, rgba(249, 115, 22, 0.16), rgba(255, 255, 255, 0.68));
      padding: 20px;
      display: flex;
      gap: 10px;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      box-shadow: 0 16px 36px rgba(244, 136, 62, 0.18);
    }
    .final-cta h2 {
      margin: 0;
      font-size: 24px;
      color: #7a2f04;
      letter-spacing: -0.02em;
    }
    .final-cta p {
      margin: 7px 0 0;
      color: #8e4918;
      font-size: 14px;
      line-height: 1.5;
      max-width: 60ch;
    }
    .footer {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      color: #5c7893;
      font-size: 12px;
    }
    .footer a {
      color: #1b5f93;
      text-decoration: none;
    }
    .footer a:hover { text-decoration: underline; }
    a:focus-visible, button:focus-visible {
      outline: 2px solid #0284c7;
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; }
    }
    @media (max-width: 1024px) {
      .hero { grid-template-columns: 1fr; }
      .grid-3 { grid-template-columns: 1fr; }
      .steps { grid-template-columns: 1fr 1fr; }
      .pricing { grid-template-columns: 1fr; }
      h1 { max-width: 16ch; }
    }
    @media (max-width: 640px) {
      .page { padding: 14px 12px 52px; }
      .topbar { border-radius: 13px; }
      .hero, .section, .final-cta { border-radius: 16px; padding: 16px; }
      .steps { grid-template-columns: 1fr; }
      .btn { width: 100%; }
      .nav .link-chip { display: none; }
      .nav .cta-chip { display: inline-flex; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="page">
    <header class="topbar">
      <a class="brand" href="/" aria-label="${SITE_NAME} home">
        <span class="brand-dot" aria-hidden="true"></span>
        <span>${SITE_NAME}</span>
      </a>
      <nav class="nav" aria-label="Primary">
        <a class="link-chip" href="#platform">${LANDING_HEADER_LINKS.platform}</a>
        <a class="link-chip" href="#workflow">${LANDING_HEADER_LINKS.workflow}</a>
        <a class="link-chip" href="#pricing">${LANDING_HEADER_LINKS.pricing}</a>
        <a class="link-chip" href="#faq">${LANDING_HEADER_LINKS.faq}</a>
        <a class="link-chip" href="/login">${LANDING_HEADER_LINKS.login}</a>
        <a class="cta-chip" href="/signup">${LANDING_HEADER_LINKS.signup}</a>
      </nav>
    </header>

    <main id="main">
      <section class="hero" aria-label="Hero">
        <div>
          <span class="eyebrow"><i aria-hidden="true"></i>${LANDING_HERO_CONTENT.workerEyebrow}</span>
          <h1>${LANDING_HERO_CONTENT.workerTitle}</h1>
          <p class="lead">${LANDING_HERO_CONTENT.workerLead}</p>
          <ul class="hero-list">
            ${LANDING_HERO_BULLETS.map((item) => `<li>${item}</li>`).join("")}
          </ul>
          <div class="cta-row">
            <a class="btn btn-primary" href="/signup">${LANDING_HERO_CONTENT.primaryCta}</a>
            <a class="btn btn-secondary" href="/login">${LANDING_HERO_CONTENT.secondaryCta}</a>
            <a class="btn btn-secondary" href="${DASHBOARD_HOME_PATH}">${LANDING_HEADER_LINKS.dashboard}</a>
          </div>
          <p class="note">${LANDING_HERO_CONTENT.note}</p>
        </div>
        <aside class="panel" aria-label="Platform status preview">
          <div class="panel-head">
            <span>${LANDING_OPS_SNAPSHOT.heading}</span>
            <span class="lights" aria-hidden="true"><span></span><span></span><span></span></span>
          </div>
          <div class="panel-body">
            ${LANDING_OPS_SNAPSHOT.logs.map((item, index) => `<div${index === LANDING_OPS_SNAPSHOT.logs.length - 1 ? ' class="ok"' : ""}>${escapeHtml(item)}</div>`).join("")}
          </div>
          <div class="kpis">
            ${LANDING_OPS_SNAPSHOT.metrics.map((item) => `<div class="kpi"><strong>${item.value}</strong><span>${item.label}</span></div>`).join("")}
          </div>
        </aside>
      </section>

      <section id="platform" class="section" aria-label="Platform value">
        <h2>${LANDING_CAPABILITIES_SECTION.workerHeading}</h2>
        <p>${LANDING_CAPABILITIES_SECTION.workerIntro}</p>
        <div class="grid-3">
          ${LANDING_CAPABILITIES.map((item) => `<article class="card"><h3>${item.title}</h3><p>${item.copy}</p></article>`).join("")}
        </div>
      </section>

      <section id="workflow" class="section" aria-label="Workflow">
        <h2>Operational workflow in four steps</h2>
        <p>A practical intelligence loop: ingest, triage, verify, and escalate. Designed for consistency across shifts.</p>
        <div class="steps">
          ${LANDING_WORKFLOW_STEPS.map((item) => `<article class="step"><small>${item.step}</small><h3>${item.title}</h3><p>${item.copy}</p></article>`).join("")}
        </div>
      </section>

      <section id="pricing" class="section" aria-label="Pricing">
        <h2>Simple pricing for high-signal intelligence teams</h2>
        <p>Use the free tier for baseline visibility, then upgrade for premium instant updates when latency starts impacting decisions.</p>
        <div class="pricing">
          <article class="price-card">
            <h3>${LANDING_PRICING_COPY.freePlanName}</h3>
            <p class="price"><strong>$0</strong> per month</p>
            <ul class="price-list">
              ${LANDING_PRICING_COPY.freeFeatures.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </article>
          <article class="price-card premium">
            <h3>${LANDING_PRICING_COPY.premiumPlanName}</h3>
            <p class="price"><strong>${LANDING_PRICING_COPY.backendPriceFigureMain}</strong> per month after trial</p>
            <ul class="price-list">
              ${LANDING_PRICING_COPY.premiumFeatures.map((item) => `<li>${item}</li>`).join("")}
            </ul>
          </article>
        </div>
      </section>

      <section id="faq" class="section" aria-label="FAQ">
        <h2>Frequently asked questions</h2>
        <div class="faq">
          ${LANDING_FAQ_ITEMS.map((item) => `<article class="faq-item"><h3>${item.question}</h3><p>${item.answer}</p></article>`).join("")}
        </div>
      </section>

      <section class="final-cta" aria-label="Final call to action">
        <div>
          <h2>${LANDING_FINAL_CTA.heading}</h2>
          <p>${LANDING_FINAL_CTA.copy}</p>
        </div>
        <div class="cta-row" style="margin-top:0;">
          <a class="btn btn-primary" href="/signup">${LANDING_FINAL_CTA.primaryLabel}</a>
          <a class="btn btn-secondary" href="/login">${LANDING_FINAL_CTA.secondaryLabel}</a>
        </div>
      </section>
    </main>

    <footer class="footer">
      <span>${LANDING_FOOTER.productLabel}</span>
      <span>
        <a href="/login">${LANDING_HEADER_LINKS.login}</a> •
        <a href="/signup">${LANDING_FOOTER.startTrialLabel}</a> •
        <a href="${DASHBOARD_HOME_PATH}">${LANDING_HEADER_LINKS.dashboard}</a>
      </span>
    </footer>
  </div>
</body>
</html>`;
      return withDefaultSecurityHeaders(new Response(landingHtml, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      }));
    }

    if (REMOVED_API_PATHS.has(path)) {
      return withDefaultSecurityHeaders(new Response(
        JSON.stringify({
          error: "Endpoint removed",
          reason: "Feature retired from the intel dashboard",
        }),
        {
          status: 410,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        },
      ));
    }

    // ----------------------------------------------------------------
    // Media proxy route — only allow Telegram CDN hosts for fallback URLs
    // ----------------------------------------------------------------
    if (path === "/media-proxy") {
      const target = normalizeExternalMediaUrl(url.searchParams.get("u") || "");
      if (!target) {
        return withDefaultSecurityHeaders(new Response("Not Found", { status: 404 }));
      }
      const validSignature = await verifyMediaProxySignature({
        env,
        targetUrl: target,
        expiresAtSecondsRaw: url.searchParams.get("exp"),
        signatureRaw: url.searchParams.get("sig"),
      });
      if (!validSignature) {
        return withDefaultSecurityHeaders(new Response("Forbidden", {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        }));
      }
      const rateLimited = await enforceMediaProxyRateLimit({ env, request });
      if (rateLimited) {
        return rateLimited;
      }
      const upstream = await fetch(target, {
        headers: { "User-Agent": MEDIA_PROXY_USER_AGENT },
        signal: AbortSignal.timeout(MEDIA_PROXY_FETCH_TIMEOUT_MS),
      });
      if (!upstream.ok || !upstream.body) {
        return withDefaultSecurityHeaders(new Response("Not Found", { status: 404 }));
      }
      const headers = new Headers();
      const upstreamType = upstream.headers.get("content-type");
      if (upstreamType) headers.set("content-type", upstreamType);
      headers.set(
        "Cache-Control",
        `public, max-age=${MEDIA_PROXY_URL_TTL_SECONDS}, s-maxage=${MEDIA_PROXY_URL_TTL_SECONDS}, stale-while-revalidate=300`,
      );
      headers.set("CDN-Cache-Control", `max-age=${MEDIA_PROXY_URL_TTL_SECONDS}`);
      return withDefaultSecurityHeaders(new Response(upstream.body, { status: 200, headers }));
    }

    // ----------------------------------------------------------------
    // Media route — serve R2 objects (public, heavily cached)
    // ----------------------------------------------------------------
    if (path.startsWith("/media/")) {
      const key = decodeAndValidateMediaKey(path.slice(7));
      if (!key) {
        return withDefaultSecurityHeaders(new Response("Not Found", { status: 404 }));
      }
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) {
        return withDefaultSecurityHeaders(new Response("Not Found", { status: 404 }));
      }
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("CDN-Cache-Control", "max-age=31536000");
      headers.set("etag", object.httpEtag);
      return withDefaultSecurityHeaders(new Response(object.body, { headers }));
    }

    // Cache bust — bypass auth, protected by secret param
    if (path === "/api/cache-bust") {
      const auth = await authorizePrivilegedRoute({ request, env, path, origin });
      if (!auth.ok) {
        return auth.response;
      }

      const id = env.INTEL_CACHE.idFromName("main");
      const stub = env.INTEL_CACHE.get(id);
      const doRes = await stub.fetch(new Request("https://do/api/cache-bust"));
      return new Response(doRes.body, {
        status: doRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (path === "/api/scraper/trigger") {
      const auth = await authorizePrivilegedRoute({ request, env, path, origin });
      if (!auth.ok) {
        return auth.response;
      }
      const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
      const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
      const scraperRes = await scraperStub.fetch(new Request("https://do/trigger"));
      return new Response(scraperRes.body, {
        status: scraperRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const requiresSession = path.startsWith("/api/");
    const authSecret = env.AUTH_SECRET?.trim() ?? "";
    if (requiresSession && !authSecret) {
      return misconfiguredApiResponse(origin);
    }

    const betterAuthSession = await getAuth().api.getSession({
      headers: request.headers,
    }) as BetterAuthSessionResult | null;
    let user = mapBetterAuthSession(betterAuthSession);
    let xProfileSyncDiagnostics: XProfileSyncDiagnostics | null = null;
    if (user) {
      const hydrated = await hydrateXProfileFromStoredAccount({
        env,
        user,
      });
      user = hydrated.user;
      xProfileSyncDiagnostics = hydrated.diagnostics;
      const observabilityPromise = trackXProfileSyncObservability({
        env,
        diagnostics: xProfileSyncDiagnostics,
        user,
        path,
      });
      if (ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(observabilityPromise);
      } else {
        void observabilityPromise;
      }
    }

    // /api/auth/me — probe endpoint for SPA auth gate
    if (path === "/api/auth/me") {
      const requestCookies = parseCookies(request.headers.get("Cookie"));
      const legacyCookieNames = [
        SESSION_COOKIE,
        COMPAT_SESSION_COOKIE,
        X_ACCESS_COOKIE,
        X_ACCESS_REF_COOKIE,
        X_OAUTH1_REQ_COOKIE,
        X_OIDC_RETRY_COOKIE,
        STATE_COOKIE,
        PKCE_COOKIE,
      ] as const;
      const hasLegacyAuthCookies = legacyCookieNames.some((cookieName) =>
        typeof requestCookies[cookieName] === "string" && requestCookies[cookieName]!.trim().length > 0
      );
      const authMeHeaders = new Headers({
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
        ...corsHeaders(origin),
      });
      if (hasLegacyAuthCookies) {
        for (const cookieName of legacyCookieNames) {
          authMeHeaders.append("Set-Cookie", clearCookie(cookieName));
        }
      }
      if (!user) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            status: 401,
            headers: authMeHeaders,
          },
        );
      }
      const entitlement = await fetchFeedEntitlement({
        env,
        userId: resolveUserId(user),
        userLogin: user.login,
      });
      const role = (entitlement.role ?? entitlement.tier ?? "").toLowerCase();
      const clientXProfileDiagnostics = buildClientXProfileDiagnostics(
        xProfileSyncDiagnostics,
        role === "owner",
      );
      const caps = resolveFeedTierCaps(env, entitlement);
      let effectiveAvatarUrl = user.avatar_url || buildPublicXAvatarFallback(user);
      if (!effectiveAvatarUrl && xProfileSyncDiagnostics?.required) {
        effectiveAvatarUrl = buildUnavatarXAvatarFallback(user.login);
      }
      return new Response(
        JSON.stringify({
          authenticated: true,
          user: {
            login: user.login,
            name: user.name,
            avatar_url: effectiveAvatarUrl,
            id: user.id,
            provider: user.provider ?? null,
          },
          entitlement: {
            tier: entitlement.tier,
            role: entitlement.role ?? entitlement.tier,
            entitled: entitlement.entitled,
            delayMinutes: entitlement.delayMinutes,
            limits: {
              intelMaxItems: caps.intelMaxItems,
              briefingsMaxItems: caps.briefingsMaxItems,
              airSeaMaxItems: caps.airSeaMaxItems,
              telegramTotalMessagesMax: caps.telegramTotalMessagesMax,
              telegramChannelMessagesMax: caps.telegramChannelMessagesMax,
            },
          },
          ...(clientXProfileDiagnostics ? { x_profile_sync: clientXProfileDiagnostics } : {}),
        }),
        {
          status: 200,
          headers: authMeHeaders,
        },
      );
    }

    if (path === "/api/auth/debug") {
      const authDebugHeaders = new Headers({
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store, no-cache, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
        ...corsHeaders(origin),
      });
      if (!user) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            status: 401,
            headers: authDebugHeaders,
          },
        );
      }

      const userId = resolveUserId(user);
      const entitlement = await fetchFeedEntitlement({
        env,
        userId,
        userLogin: user.login,
      });
      if ((entitlement.role ?? "").toLowerCase() !== "owner") {
        return new Response(
          JSON.stringify({ error: "Not Found" }),
          {
            status: 404,
            headers: authDebugHeaders,
          },
        );
      }

      let accountRow: XAccountTokenRow | null = null;
      let accountLoadError: string | null = null;
      try {
        accountRow = await loadLatestXAccountTokenRow(env, userId);
      } catch (error) {
        accountLoadError = String(error);
      }

      const accessTokenInfo = parseStoredOAuthToken(accountRow?.accessToken ?? null);
      const refreshTokenInfo = parseStoredOAuthToken(accountRow?.refreshToken ?? null);
      const idTokenInfo = parseStoredOAuthToken(accountRow?.idToken ?? null);

      let xApiProbe: { status: number | null; detail?: string | null } | null = null;
      if (accessTokenInfo.rawToken) {
        try {
          const probeRes = await fetch("https://api.x.com/2/users/me?user.fields=id,profile_image_url,name,username", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessTokenInfo.rawToken}`,
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(4_000),
          });
          const probeBody = await probeRes.text().catch(() => "");
          xApiProbe = {
            status: probeRes.status,
            detail: probeBody.slice(0, 260) || null,
          };
        } catch (error) {
          xApiProbe = {
            status: null,
            detail: String(error),
          };
        }
      }

      const requestCookies = parseCookies(request.headers.get("Cookie"));
      let effectiveAvatarUrl = user.avatar_url || buildPublicXAvatarFallback(user);
      if (!effectiveAvatarUrl && xProfileSyncDiagnostics?.required) {
        effectiveAvatarUrl = buildUnavatarXAvatarFallback(user.login);
      }
      const xProfileAlertState = await loadXProfileAlertState(env);
      const debugXProfileDiagnostics = buildClientXProfileDiagnostics(xProfileSyncDiagnostics, true);
      return new Response(
        JSON.stringify(
          {
            authenticated: true,
            timestamp: new Date().toISOString(),
            user: {
              id: user.id,
              login: user.login,
              name: user.name,
              avatar_url: effectiveAvatarUrl,
              provider: user.provider ?? null,
            },
            entitlement: {
              role: entitlement.role ?? null,
              tier: entitlement.tier,
              entitled: entitlement.entitled,
              delayMinutes: entitlement.delayMinutes,
            },
            x_profile_sync: debugXProfileDiagnostics,
            x_profile_alert_state: xProfileAlertState,
            account: accountRow
              ? {
                  id: accountRow.id,
                  providerId: accountRow.providerId,
                  accountId: accountRow.accountId,
                  scope: accountRow.scope,
                  updatedAtMs: accountRow.updatedAtMs,
                  accessToken: {
                    present: Boolean(accessTokenInfo.rawToken),
                    wrapped: accessTokenInfo.wrapped,
                    decodedFromBase64: accessTokenInfo.decodedFromBase64,
                    marker: accessTokenInfo.marker,
                    issuedAtMs: accessTokenInfo.issuedAtMs,
                    preview: tokenPreview(accessTokenInfo.rawToken),
                  },
                  refreshToken: {
                    present: Boolean(refreshTokenInfo.rawToken),
                    wrapped: refreshTokenInfo.wrapped,
                    decodedFromBase64: refreshTokenInfo.decodedFromBase64,
                    marker: refreshTokenInfo.marker,
                    issuedAtMs: refreshTokenInfo.issuedAtMs,
                    preview: tokenPreview(refreshTokenInfo.rawToken),
                  },
                  idToken: {
                    present: Boolean(idTokenInfo.rawToken),
                    wrapped: idTokenInfo.wrapped,
                    decodedFromBase64: idTokenInfo.decodedFromBase64,
                    marker: idTokenInfo.marker,
                    issuedAtMs: idTokenInfo.issuedAtMs,
                    preview: tokenPreview(idTokenInfo.rawToken),
                  },
                }
              : null,
            xApiProbe,
            cookies: {
              hasSessionCookie: Boolean(requestCookies[SESSION_COOKIE]),
              hasCompatSessionCookie: Boolean(requestCookies[COMPAT_SESSION_COOKIE]),
              hasXAccessCookie: Boolean(requestCookies[X_ACCESS_COOKIE]),
              hasXAccessRefCookie: Boolean(requestCookies[X_ACCESS_REF_COOKIE]),
              hasLegacyOauthState: Boolean(requestCookies[STATE_COOKIE]) || Boolean(requestCookies[PKCE_COOKIE]),
            },
            accountLoadError,
          },
          null,
          2,
        ),
        {
          status: 200,
          headers: authDebugHeaders,
        },
      );
    }

    if (requiresSession && !user) {
      return unauthorizedApiResponse(origin);
    }

    const isMutatingMethod =
      request.method === "POST" ||
      request.method === "PUT" ||
      request.method === "PATCH" ||
      request.method === "DELETE";
    const hasCookieHeader = Boolean(request.headers.get("Cookie"));
    if (
      isMutatingMethod &&
      hasCookieHeader &&
      path.startsWith("/api/") &&
      !isTrustedRequestOrigin({ request })
    ) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        {
          status: 403,
          headers: privateApiHeaders(origin),
        },
      );
    }

    const sessionUser = user as VerifiedSession;

    if (path === "/api/billing/status") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/billing/status",
        allowMethods: ["GET", "POST"],
      });
    }

    if (path === "/api/billing/start-trial") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/billing/start-trial",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/billing/checkout") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/billing/checkout",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/billing/portal") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/billing/portal",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/billing/activity") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/billing/activity",
        allowMethods: ["GET", "POST"],
      });
    }

    if (path === "/api/admin/crm/overview") {
      if (request.method !== "GET") {
        const headers = privateApiHeaders(origin);
        headers.set("Allow", "GET");
        return new Response(
          JSON.stringify({ error: "Method Not Allowed" }),
          {
            status: 405,
            headers,
          },
        );
      }

      const userId = resolveUserId(sessionUser);
      const entitlement = await fetchFeedEntitlement({
        env,
        userId,
        userLogin: sessionUser.login,
      });
      if ((entitlement.role ?? "").toLowerCase() !== "owner") {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: privateApiHeaders(origin),
          },
        );
      }

      let directory: Awaited<ReturnType<typeof loadCrmDirectorySnapshot>>;
      try {
        directory = await loadCrmDirectorySnapshot(env);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: "Unable to load CRM directory snapshot.",
            detail: error instanceof Error ? error.message : "unknown_error",
          }),
          {
            status: 500,
            headers: privateApiHeaders(origin),
          },
        );
      }

      const backendSummary = await fetchOwnerCrmBackendSummary({
        env,
        user: sessionUser,
      });
      if (!backendSummary.ok) {
        return new Response(
          JSON.stringify({
            error: backendSummary.error,
          }),
          {
            status: backendSummary.status,
            headers: privateApiHeaders(origin),
          },
        );
      }

      const billing = isRecord(backendSummary.payload.billing)
        ? backendSummary.payload.billing
        : {};
      const trackedUsers = Math.max(
        0,
        Math.floor(normalizeNumber((billing as Record<string, unknown>).trackedUsers) ?? 0),
      );
      const qualitySummary = summarizeCrmDataQuality({
        users: directory.users,
        totalUsers: directory.totalUsers,
        trackedUsers,
      });

      return new Response(
        JSON.stringify({
          ok: true,
          result: {
            generatedAtMs: Date.now(),
            directory: {
              ...directory,
              untrackedUsers: qualitySummary.untrackedUsers,
              orphanTrackedUsers: qualitySummary.orphanTrackedUsers,
            },
            dataQuality: qualitySummary,
            ...backendSummary.payload,
          },
        }),
        {
          status: 200,
          headers: privateApiHeaders(origin),
        },
      );
    }

    if (path === "/api/admin/crm/customer") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/admin/crm/customer",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/admin/crm/cancel-subscription") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/admin/crm/cancel-subscription",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/admin/crm/refund") {
      return proxySessionBillingRoute({
        request,
        env,
        origin,
        user: sessionUser,
        backendPath: "/api/intel-dashboard/admin/crm/refund",
        allowMethods: ["POST"],
      });
    }

    if (path === "/api/telegram/dedupe-feedback") {
      const userId = user ? resolveUserId(user) : "";
      const entitlement = user
        ? await fetchFeedEntitlement({
          env,
          userId,
          userLogin: user.login,
        })
        : defaultFeedEntitlement();
      if ((entitlement.role ?? "").toLowerCase() !== "owner") {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
              "CDN-Cache-Control": "no-store",
              "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
              ...corsHeaders(origin),
            },
          },
        );
      }

      if (request.method !== "GET" && request.method !== "POST") {
        return new Response(
          JSON.stringify({ error: "Method Not Allowed" }),
          {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              "Allow": "GET, POST",
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
              "CDN-Cache-Control": "no-store",
              "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
              ...corsHeaders(origin),
            },
          },
        );
      }

      let body: string | undefined;
      if (request.method === "POST") {
        body = await request.text();
      }
      const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
      const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
      const doRes = await scraperStub.fetch(
        new Request("https://do/admin/dedupe-feedback", {
          method: request.method,
          headers: {
            "Content-Type": "application/json",
          },
          ...(body === undefined ? {} : { body }),
        }),
      );
      const response = new Response(doRes.body, {
        status: doRes.status,
        headers: doRes.headers,
      });
      response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      response.headers.set("CDN-Cache-Control", "no-store");
      response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Origin", "Cookie", "Authorization"]));
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        response.headers.set(k, v);
      }
      return response;
    }

    // ----------------------------------------------------------------
    // Existing API routes (now auth-protected)
    // ----------------------------------------------------------------

    if (path === "/api/status") {
      const cacheId = env.INTEL_CACHE.idFromName("main");
      const cacheStub = env.INTEL_CACHE.get(cacheId);
      const cacheRes = await cacheStub.fetch(
        new Request("https://do/api/health"),
      );
      const cacheStatus = await cacheRes.json();

      const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
      const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
      const scraperRes = await scraperStub.fetch(
        new Request("https://do/health"),
      );
      const scraperStatus = await scraperRes.json();

      return new Response(
        JSON.stringify(
          { intelCache: cacheStatus, telegramScraper: scraperStatus },
          null,
          2,
        ),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
            ...corsHeaders(origin),
          },
        },
      );
    }


    if (path === "/api/telegram") {
      let kvData: string | null = null;
      let cacheSource = "kv-worker-scraper";
      try {
        const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
        const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
        const doRes = await scraperStub.fetch(new Request("https://do/state"));
        if (doRes.ok) {
          kvData = await doRes.text();
          cacheSource = "do-worker-scraper";
        }
      } catch {
        // Fallback to KV when DO state fetch is unavailable.
      }
      if (!kvData) {
        kvData = await env.TELEGRAM_STATE.get("latest-telegram-intel");
      }
      if (kvData) {
        try {
          const state = JSON.parse(kvData) as { timestamp?: unknown } & Record<string, unknown>;
          if (isRecord(state)) {
            await rewriteTelegramMediaUrlsForResponse({
              env,
              state,
            });
          }
          let entitlement = defaultFeedEntitlement();
          if (user) {
            const userId = resolveUserId(user);
            entitlement = await fetchFeedEntitlement({
              env,
              userId,
              userLogin: user.login,
            });
          }
          const effectiveDelayMinutes = entitlement.entitled
            ? 0
            : Math.max(DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES, entitlement.delayMinutes);
          const caps = resolveFeedTierCaps(env, entitlement);
          const gatedState = applyDelayAndCapsToApiPayload({
            path,
            payload: state,
            delayMinutes: effectiveDelayMinutes,
            caps,
          });
          const responseState = isRecord(gatedState.payload) ? gatedState.payload : state;
          const ts = typeof state.timestamp === "string" ? Date.parse(state.timestamp) : Number.NaN;
          const stateAgeSeconds = Number.isFinite(ts)
            ? Math.max(0, Math.round((Date.now() - ts) / 1000))
            : null;
          const payload = JSON.stringify(responseState);
          const headers = new Headers({
            "Content-Type": "application/json",
            "X-Cache-Source": cacheSource,
            "X-Cache-Age": stateAgeSeconds === null ? "unknown" : String(stateAgeSeconds),
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
            ...corsHeaders(origin),
          });
          headers.set("X-News-Tier", entitlement.tier);
          headers.set("X-News-Role", entitlement.role ?? entitlement.tier);
          headers.set("X-News-Delay-Minutes", String(effectiveDelayMinutes));
          headers.set("X-News-Capped", gatedState.capped ? "1" : "0");
          if (gatedState.totalBefore !== null) {
            headers.set("X-News-Total-Before-Gate", String(gatedState.totalBefore));
          }
          if (gatedState.totalVisible !== null) {
            headers.set("X-News-Total-Visible", String(gatedState.totalVisible));
          }
          return new Response(payload, { headers });
        } catch {
          // Ignore invalid KV payload and return a controlled 503 below.
        }
      }

      return new Response(
        JSON.stringify({ error: "Telegram state unavailable" }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
            ...corsHeaders(origin),
          },
        },
      );
    }

    if (path === "/api/telegram/stream") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected websocket", {
          status: 426,
          headers: privateApiHeaders(origin),
        });
      }
      const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
      const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
      return scraperStub.fetch(new Request("https://do/stream", {
        headers: request.headers,
      }));
    }

    if (
      path === "/api/intel" ||
      path === "/api/briefings" ||
      path === "/api/whales" ||
      path === "/api/air-sea"
    ) {
      const id = env.INTEL_CACHE.idFromName("main");
      const doRequest = () => new Request(`https://do${path}${url.search}`, {
        method: request.method,
        headers: request.headers,
      });

      let doRes: Response = new Response(null, { status: 503 });
      for (let attempt = 0; attempt < 2; attempt++) {
        const stub = env.INTEL_CACHE.get(id);
        doRes = await stub.fetch(doRequest());
        if (doRes.status !== 503 || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }

      const responseHeaders = new Headers(doRes.headers);
      let responseBody: BodyInit | null = doRes.body;
      const isDelayScopedPath =
        path === "/api/intel" || path === "/api/briefings" || path === "/api/air-sea";
      if (isDelayScopedPath) {
        let entitlement = defaultFeedEntitlement();
        if (user) {
          const userId = resolveUserId(user);
          entitlement = await fetchFeedEntitlement({
            env,
            userId,
            userLogin: user.login,
          });
        }
        const effectiveDelayMinutes = entitlement.entitled
          ? 0
          : Math.max(DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES, entitlement.delayMinutes);
        responseHeaders.set("X-News-Tier", entitlement.tier);
        responseHeaders.set("X-News-Role", entitlement.role ?? entitlement.tier);
        responseHeaders.set("X-News-Delay-Minutes", String(effectiveDelayMinutes));
        if (doRes.ok) {
          const rawBody = await doRes.text();
          try {
            const payload = JSON.parse(rawBody) as unknown;
            const gated = applyDelayAndCapsToApiPayload({
              path,
              payload,
              delayMinutes: effectiveDelayMinutes,
              caps: resolveFeedTierCaps(env, entitlement),
            });
            responseBody = JSON.stringify(gated.payload);
            responseHeaders.set("Content-Type", "application/json");
            responseHeaders.set("X-News-Capped", gated.capped ? "1" : "0");
            if (gated.totalBefore !== null) {
              responseHeaders.set("X-News-Total-Before-Gate", String(gated.totalBefore));
            }
            if (gated.totalVisible !== null) {
              responseHeaders.set("X-News-Total-Visible", String(gated.totalVisible));
            }
          } catch {
            responseBody = rawBody;
          }
        }
      }

      const response = new Response(responseBody, {
        status: doRes.status,
        headers: responseHeaders,
      });

      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        response.headers.set(k, v);
      }
      response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      response.headers.set("CDN-Cache-Control", "no-store");
      response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Origin", "Cookie", "Authorization"]));

      return response;
    }

    if (path.startsWith("/api/intel-dashboard/")) {
      let backendUrl: URL;
      try {
        backendUrl = new URL(resolveBackendEndpointUrl(env, path));
        backendUrl.search = url.search;
      } catch (error) {
        return withDefaultSecurityHeaders(new Response(
          JSON.stringify({
            error: "Backend binding unavailable",
            detail: error instanceof Error ? error.message : "unknown_error",
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
              "CDN-Cache-Control": "no-store",
              "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
              ...corsHeaders(origin),
            },
          },
        ));
      }

      const useServiceBinding = usesBackendServiceBinding(env);

      const backendHeaders = new Headers(request.headers);
      if (useServiceBinding) {
        backendHeaders.delete("Host");
      } else {
        const backendOrigin = new URL(backendUrl.origin);
        backendHeaders.set("Host", backendOrigin.hostname);
      }
      const canRetry = request.method === "GET" || request.method === "HEAD";
      const maxAttempts = canRetry ? 2 : 1;
      let backendRes: Response | null = null;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const proxyRequestInit: RequestInit = {
            method: request.method,
            headers: backendHeaders,
            redirect: "manual",
            signal: AbortSignal.timeout(30_000),
          };
          if (request.method !== "GET" && request.method !== "HEAD") {
            proxyRequestInit.body = request.body;
          }

          const backendRequest = new Request(backendUrl.toString(), proxyRequestInit);
          backendRes = useServiceBinding
            ? await env.INTEL_BACKEND.fetch(backendRequest)
            : await fetch(backendRequest);
          if (!canRetry || backendRes.status < 500 || attempt === maxAttempts - 1) {
            break;
          }
        } catch (err) {
          lastErr = err;
          if (attempt === maxAttempts - 1) {
            return new Response(
              JSON.stringify({
                error: "Backend unavailable",
                detail: err instanceof Error ? err.message : "unknown_error",
              }),
              {
                status: 502,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "private, no-store, no-cache, must-revalidate",
                  "CDN-Cache-Control": "no-store",
                  "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
                  ...corsHeaders(origin),
                },
              },
            );
          }
        }
      }

      if (!backendRes) {
        return new Response(
          JSON.stringify({
            error: "Backend unavailable",
            detail: lastErr instanceof Error ? lastErr.message : "unknown_error",
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "private, no-store, no-cache, must-revalidate",
              "CDN-Cache-Control": "no-store",
              "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
              ...corsHeaders(origin),
            },
          },
        );
      }
      const response = new Response(backendRes.body, {
        status: backendRes.status,
        headers: backendRes.headers,
      });
      for (const [k, v] of Object.entries(corsHeaders(origin))) {
        response.headers.set(k, v);
      }
      response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      response.headers.set("CDN-Cache-Control", "no-store");
      response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Origin", "Cookie", "Authorization"]));
      return response;
    }

    if (path.startsWith("/api/")) {
      return new Response(
        JSON.stringify({ error: "Not Found" }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store, no-cache, must-revalidate",
            "CDN-Cache-Control": "no-store",
            "Vary": mergeVary(null, ["Origin", "Cookie", "Authorization"]),
            ...corsHeaders(origin),
          },
        },
      );
    }

    // Serve frontend bundle from Worker static assets.
    const assetRes = await env.ASSETS.fetch(request);
    if (assetRes.status !== 404) {
      const response = new Response(assetRes.body, {
        status: assetRes.status,
        headers: assetRes.headers,
      });
      const contentType = response.headers.get("Content-Type") || "";
      if (contentType.includes("text/html")) {
        response.headers.set("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=3600");
        response.headers.set("CDN-Cache-Control", "max-age=60");
        response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Accept-Encoding"]));
      }
      return withDefaultSecurityHeaders(response);
    }

    if (isDashboardAppRoute(path)) {
      const shellBundle = await loadDashboardShellBundle(env, url);
      if (shellBundle) {
        return renderDashboardAppShellWithMetadata(shellBundle, path);
      }
      return withDefaultSecurityHeaders(new Response("Dashboard app shell unavailable", { status: 503 }));
    }

    return withDefaultSecurityHeaders(new Response("Not Found", { status: 404 }));
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const cacheId = env.INTEL_CACHE.idFromName("main");
    const cacheStub = env.INTEL_CACHE.get(cacheId);
    ctx.waitUntil(
      cacheStub.fetch(new Request("https://do/api/health")),
    );

    const scraperId = env.TELEGRAM_SCRAPER.idFromName("main");
    const scraperStub = env.TELEGRAM_SCRAPER.get(scraperId);
    ctx.waitUntil(
      scraperStub.fetch(new Request("https://do/health")),
    );
  },
};
