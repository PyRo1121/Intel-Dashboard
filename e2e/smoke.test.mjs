import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { FREE_FEED_DELAY_MINUTES } from "../packages/shared/access-offers.ts";
import { SITE_ORIGIN } from "../packages/shared/site-config.ts";
import { WORKER_SHADOWED_ROUTE_EXPECTATIONS } from "./coverage-manifest.mjs";

const REQUEST_TIMEOUT_MS = 20_000;
const RETRIES = 2;
const STRICT = process.env.E2E_STRICT === "1";
const REQUIRE_AUTH = process.env.E2E_REQUIRE_AUTH === "1";
const DEFAULT_EDGE_BASE_URL = SITE_ORIGIN;

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(rawValue, fallback) {
  const raw = trim(rawValue) || fallback;
  return raw.replace(/\/+$/, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, init = {}) {
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

function withBackendAccessHeaders(url, init = {}) {
  if (!BACKEND_BASE_URL || !String(url).startsWith(BACKEND_BASE_URL)) {
    return init;
  }

  if (!BACKEND_ACCESS_CLIENT_ID || !BACKEND_ACCESS_CLIENT_SECRET) {
    return init;
  }

  const headers = new Headers(init.headers || {});
  headers.set("CF-Access-Client-Id", BACKEND_ACCESS_CLIENT_ID);
  headers.set("CF-Access-Client-Secret", BACKEND_ACCESS_CLIENT_SECRET);
  return {
    ...init,
    headers,
  };
}

async function readJson(response) {
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function requireOrSkip(t, value, message) {
  if (trim(value)) return trim(value);
  if (REQUIRE_AUTH) {
    assert.fail(message);
  }
  if (STRICT) t.diagnostic(message);
  t.skip(message);
  return "";
}

function optionalOrSkip(t, value, message) {
  if (trim(value)) return trim(value);
  t.skip(message);
  return "";
}

function getSetCookieValues(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw
    .split(/,(?=[^;,=\s]+=[^;,]+)/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function cookiesContain(setCookies, cookieName) {
  return setCookies.some((cookie) => cookie.startsWith(`${cookieName}=`));
}

function isCloudflareChallengeResponse(response, body = "") {
  return (
    response.status === 403 &&
    (response.headers.get("cf-mitigated") || "").toLowerCase() === "challenge" &&
    /just a moment/i.test(body)
  );
}

async function expectOAuthRedirect({
  path,
  expectedHost,
  expectedPath,
  requiredParams,
  requiredCookieAlternatives,
  allowedGatePaths = [],
}) {
  const firstResponse = await fetchWithRetry(`${EDGE_BASE_URL}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "user-agent": "SentinelStream-E2E/1.0",
    },
  });
  if (firstResponse.status === 403) {
    const body = await firstResponse.text();
    if (isCloudflareChallengeResponse(firstResponse, body)) {
      return { challenged: true };
    }
    assert.fail(`${path} returned unexpected 403`);
  }
  assert.equal(firstResponse.status, 302, `${path} should return redirect`);

  const locationHeader = firstResponse.headers.get("location");
  assert.ok(locationHeader, `${path} should include location header`);

  let location = new URL(locationHeader, EDGE_BASE_URL);
  let response = firstResponse;
  const allSetCookies = [...getSetCookieValues(firstResponse.headers)];

  const base = new URL(EDGE_BASE_URL);
  const isInternalOAuthHop = location.host === base.host && location.pathname.startsWith("/oauth/");
  if (isInternalOAuthHop) {
    response = await fetchWithRetry(location.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "SentinelStream-E2E/1.0",
      },
    });
    if (response.status === 403) {
      const body = await response.text();
      if (isCloudflareChallengeResponse(response, body)) {
        return { challenged: true };
      }
      assert.fail(`${path} internal OAuth hop returned unexpected 403`);
    }
    assert.equal(response.status, 302, `${path} internal OAuth hop should redirect`);
    const secondLocationHeader = response.headers.get("location");
    assert.ok(secondLocationHeader, `${path} internal OAuth hop should include location header`);
    location = new URL(secondLocationHeader, EDGE_BASE_URL);
    allSetCookies.push(...getSetCookieValues(response.headers));
  }

  if (
    location.host === base.host &&
    allowedGatePaths.includes(location.pathname) &&
    location.searchParams.get("error") === "security_check_required"
  ) {
    return { challenged: false, gated: true };
  }

  assert.equal(location.host, expectedHost, `${path} should redirect to ${expectedHost}`);
  assert.equal(location.pathname, expectedPath, `${path} should redirect to ${expectedPath}`);

  for (const key of requiredParams) {
    assert.ok(location.searchParams.get(key), `${path} should include ${key}`);
  }

  for (const alternatives of requiredCookieAlternatives) {
    assert.ok(
      alternatives.some((cookie) => cookiesContain(allSetCookies, cookie)),
      `${path} should set one of: ${alternatives.join(", ")}`,
    );
  }

  return { challenged: false, gated: false };
}

function assertSecurityHeaders(response, label) {
  const xcto = response.headers.get("x-content-type-options");
  const xfo = response.headers.get("x-frame-options");
  const referrer = response.headers.get("referrer-policy");
  const hsts = response.headers.get("strict-transport-security");
  const permissions = response.headers.get("permissions-policy");
  const csp = response.headers.get("content-security-policy");

  assert.equal(xcto, "nosniff", `${label} should set x-content-type-options=nosniff`);
  assert.equal(xfo, "DENY", `${label} should set x-frame-options=DENY`);
  assert.equal(
    referrer,
    "strict-origin-when-cross-origin",
    `${label} should set strict referrer policy`,
  );
  assert.match(
    hsts || "",
    /max-age=/i,
    `${label} should set strict-transport-security`,
  );
  assert.match(
    permissions || "",
    /geolocation=\(\)/i,
    `${label} should set restrictive permissions-policy`,
  );
  assert.match(
    csp || "",
    /default-src 'self'/i,
    `${label} should set content-security-policy`,
  );
}

const EDGE_BASE_URL = normalizeBaseUrl(
  process.env.E2E_EDGE_BASE_URL,
  SITE_ORIGIN,
);
const BACKEND_BASE_URL = trim(process.env.E2E_BACKEND_BASE_URL);
const BACKEND_ACCESS_CLIENT_ID = trim(process.env.E2E_CF_ACCESS_CLIENT_ID);
const BACKEND_ACCESS_CLIENT_SECRET = trim(process.env.E2E_CF_ACCESS_CLIENT_SECRET);
const BACKEND_TOKEN_FILE = trim(process.env.E2E_BACKEND_TOKEN_FILE) || "/tmp/e2e_backend_token.txt";
const BACKEND_TOKEN = (() => {
  const explicit = trim(process.env.E2E_BACKEND_TOKEN);
  if (explicit) return explicit;
  try {
    if (existsSync(BACKEND_TOKEN_FILE)) {
      return trim(readFileSync(BACKEND_TOKEN_FILE, "utf8"));
    }
  } catch {
    // ignore file read errors and fallback to skip behavior
  }
  return "";
})();
const AI_JOBS_TOKEN = (() => {
  const explicit = trim(process.env.E2E_AI_JOBS_TOKEN);
  if (explicit) return explicit;
  return "";
})();
const SESSION_COOKIE_FILE = trim(process.env.E2E_SESSION_COOKIE_FILE) || "/tmp/e2e_session_cookie.txt";
const SESSION_COOKIE = (() => {
  const explicit = trim(process.env.E2E_SESSION_COOKIE);
  if (explicit) return explicit;
  try {
    if (existsSync(SESSION_COOKIE_FILE)) {
      return trim(readFileSync(SESSION_COOKIE_FILE, "utf8"));
    }
  } catch {
    // ignore file read errors and fallback to skip behavior
  }
  return "";
})();
const USER_ID = trim(process.env.E2E_USER_ID) || "PyRo1121";
const NON_OWNER_USER_ID = trim(process.env.E2E_NON_OWNER_USER_ID) || "e2e-non-owner";
let sessionCookieValidationPromise = null;

function requireBackendBaseUrl(t) {
  return requireOrSkip(
    t,
    BACKEND_BASE_URL,
    "E2E_BACKEND_BASE_URL is required for direct backend e2e because workers.dev is disabled for this worker",
  );
}

async function requireValidSessionCookie(t, message) {
  const cookie = optionalOrSkip(t, SESSION_COOKIE, message);
  if (!cookie) return "";

  if (!sessionCookieValidationPromise) {
    sessionCookieValidationPromise = (async () => {
      const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/me`, {
        headers: {
          Cookie: cookie,
        },
      });
      if (response.status !== 200) {
        return {
          ok: false,
          status: response.status,
        };
      }
      const payload = await readJson(response);
      return {
        ok: payload?.authenticated === true,
        status: response.status,
      };
    })();
  }

  const validation = await sessionCookieValidationPromise;
  if (!validation.ok) {
    const detail = `E2E_SESSION_COOKIE is present but invalid or expired (auth/me returned ${validation.status}). Refresh it with npm run e2e:save-secrets after logging in again.`;
    if (REQUIRE_AUTH || STRICT) {
      assert.fail(detail);
    }
    t.skip(detail);
    return "";
  }

  return cookie;
}

test("edge public routes are reachable", async () => {
  const [landing, robots, sitemap] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/`),
    fetchWithRetry(`${EDGE_BASE_URL}/robots.txt`),
    fetchWithRetry(`${EDGE_BASE_URL}/sitemap.xml`),
  ]);

  assert.equal(landing.status, 200, "landing route should be reachable");
  assert.equal(robots.status, 200, "robots.txt should be reachable");
  assert.equal(sitemap.status, 200, "sitemap.xml should be reachable");

  const robotsBody = await robots.text();
  assert.match(robotsBody, /Sitemap:/i, "robots.txt should advertise sitemap");
});

test("worker-shadowed production routes match declared expectations", async () => {
  for (const [file, expectation] of Object.entries(WORKER_SHADOWED_ROUTE_EXPECTATIONS)) {
    const response = await fetchWithRetry(`${EDGE_BASE_URL}${expectation.productionPath}`);
    assert.equal(
      response.status,
      expectation.expectedStatus ?? 200,
      `${file} production path ${expectation.productionPath} should match declared status`,
    );
  }
});

test("edge landing page keeps SentinelStream SEO and structured data surface", async () => {
  const landing = await fetchWithRetry(`${EDGE_BASE_URL}/`);
  assert.equal(landing.status, 200, "landing should be reachable");
  const landingBody = await landing.text();
  assert.match(landingBody, /SentinelStream/i, "landing should use SentinelStream branding");
  assert.match(landingBody, /Real-Time Geopolitical Intelligence Platform/i, "landing should expose the current positioning");
  assert.match(landingBody, /Start 7-Day Trial/i, "landing should expose the trial CTA");
  assert.match(landingBody, /application\/ld\+json/i, "landing should embed structured data");
  assert.match(landingBody, /FAQPage/i, "landing structured data should include FAQ schema");
  assert.match(landingBody, /SoftwareApplication/i, "landing structured data should include software application schema");
  assert.doesNotMatch(landingBody, /PyRoBOT|PyRo1121Bot/i, "landing should not expose legacy branding");
});

test("edge public auth pages render SentinelStream surfaces without legacy branding", async (t) => {
  const [login, signup] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/login`),
    fetchWithRetry(`${EDGE_BASE_URL}/signup`),
  ]);

  const [loginBody, signupBody] = await Promise.all([
    login.text(),
    signup.text(),
  ]);

  if (
    isCloudflareChallengeResponse(login, loginBody) ||
    isCloudflareChallengeResponse(signup, signupBody)
  ) {
    t.skip("Cloudflare Bot Fight challenged /login or /signup for the synthetic client");
    return;
  }

  assert.equal(login.status, 200, "login page should be reachable");
  assert.equal(signup.status, 200, "signup page should be reachable");

  assert.match(loginBody, /Sign in to SentinelStream/i, "login should render current heading");
  assert.match(loginBody, /Continue with X/i, "login should render X OAuth CTA");
  assert.match(loginBody, /Continue with GitHub/i, "login should render GitHub OAuth CTA");
  assert.doesNotMatch(loginBody, /PyRoBOT|PyRo1121Bot/i, "login should not expose legacy branding");

  assert.match(signupBody, /Create your SentinelStream access/i, "signup should render current heading");
  assert.match(signupBody, /Create Account with X/i, "signup should render X signup CTA");
  assert.match(signupBody, /Create Account with GitHub/i, "signup should render GitHub signup CTA");
  assert.doesNotMatch(signupBody, /PyRoBOT|PyRo1121Bot/i, "signup should not expose legacy branding");
});

test("edge auth pages preserve safe next routes in oauth actions and mode switch links", async () => {
  const [login, signup] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/login?next=${encodeURIComponent("/crm")}`),
    fetchWithRetry(`${EDGE_BASE_URL}/signup?next=${encodeURIComponent("/briefings")}`),
  ]);

  assert.equal(login.status, 200, "login page with next should be reachable");
  assert.equal(signup.status, 200, "signup page with next should be reachable");

  const [loginBody, signupBody] = await Promise.all([login.text(), signup.text()]);
  assert.match(loginBody, /\/auth\/login\?next=%2Fcrm/i, "login page should preserve next on GitHub auth action");
  assert.match(loginBody, /\/auth\/x\/login\?next=%2Fcrm/i, "login page should preserve next on X auth action");
  assert.match(loginBody, /\/signup\?next=%2Fcrm/i, "login page should preserve next on mode switch");

  assert.match(signupBody, /\/auth\/signup\?next=%2Fbriefings/i, "signup page should preserve next on GitHub auth action");
  assert.match(signupBody, /\/auth\/x\/signup\?next=%2Fbriefings/i, "signup page should preserve next on X auth action");
  assert.match(signupBody, /\/login\?next=%2Fbriefings/i, "signup page should preserve next on mode switch");
});

test("edge robots and sitemap expose the intended crawl boundaries", async () => {
  const [robots, sitemap] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/robots.txt`),
    fetchWithRetry(`${EDGE_BASE_URL}/sitemap.xml`),
  ]);

  assert.equal(robots.status, 200, "robots.txt should be reachable");
  assert.equal(sitemap.status, 200, "sitemap.xml should be reachable");

  const [robotsBody, sitemapBody] = await Promise.all([robots.text(), sitemap.text()]);
  assert.match(robotsBody, /Disallow: \/api\//i, "robots should block API crawling");
  assert.match(robotsBody, /Disallow: \/auth\//i, "robots should block auth crawling");
  assert.match(robotsBody, /Disallow: \/login/i, "robots should block login crawling");
  assert.match(sitemapBody, /<loc>https:\/\/intel\.pyro1121\.com\/osint<\/loc>/i, "sitemap should include osint page");
  assert.match(sitemapBody, /<loc>https:\/\/intel\.pyro1121\.com\/telegram<\/loc>/i, "sitemap should include telegram page");
  assert.match(sitemapBody, /<loc>https:\/\/intel\.pyro1121\.com\/briefings<\/loc>/i, "sitemap should include briefings page");
});

test("edge active OAuth entrypoints redirect to providers or enforce the turnstile gate", async (t) => {
  const results = await Promise.all([
    expectOAuthRedirect({
      path: "/auth/login",
      expectedHost: "github.com",
      expectedPath: "/login/oauth/authorize",
      requiredParams: ["client_id", "redirect_uri", "scope", "state"],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-gh-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/login"],
    }),
    expectOAuthRedirect({
      path: "/auth/signup",
      expectedHost: "github.com",
      expectedPath: "/login/oauth/authorize",
      requiredParams: ["client_id", "redirect_uri", "scope", "state"],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-gh-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/signup"],
    }),
    expectOAuthRedirect({
      path: "/auth/x/login",
      expectedHost: "x.com",
      expectedPath: "/i/oauth2/authorize",
      requiredParams: [
        "response_type",
        "client_id",
        "redirect_uri",
        "scope",
        "state",
        "code_challenge",
        "code_challenge_method",
      ],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-x-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/login"],
    }),
    expectOAuthRedirect({
      path: "/auth/x/signup",
      expectedHost: "x.com",
      expectedPath: "/i/oauth2/authorize",
      requiredParams: [
        "response_type",
        "client_id",
        "redirect_uri",
        "scope",
        "state",
        "code_challenge",
        "code_challenge_method",
      ],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-x-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/signup"],
    }),
  ]);

  if (results.some((result) => result.challenged)) {
    t.skip("Cloudflare Bot Fight challenged one or more OAuth entrypoints for the synthetic client");
  }
});

test("edge auth start routes preserve safe next paths through the turnstile gate", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/auth/login?next=${encodeURIComponent("/crm")}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "user-agent": "SentinelStream-E2E/1.0",
    },
  });

  assert.equal(response.status, 302, "/auth/login with next should redirect");
  const location = new URL(response.headers.get("location") || "", EDGE_BASE_URL);
  assert.equal(location.pathname, "/login", "turnstile gate should redirect back to login");
  assert.equal(location.searchParams.get("error"), "security_check_required", "turnstile gate should require verification");
  assert.equal(location.searchParams.get("next"), "/crm", "turnstile gate should preserve the safe next path");
});

test("edge OAuth callback variants fail closed into auth error with missing state", async () => {
  const paths = [
    "/auth/callback",
    "/oauth/callback",
    "/auth/callback/github",
    "/auth/callback/twitter",
    "/auth/x/callback",
    "/oauth/x/callback",
  ];
  for (const path of paths) {
    const response = await fetchWithRetry(`${EDGE_BASE_URL}${path}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "SentinelStream-E2E/1.0",
      },
    });
    assert.equal(response.status, 302, `${path} should redirect without state`);
    const locationHeader = response.headers.get("location") || "";
    const location = new URL(locationHeader, EDGE_BASE_URL);
    assert.equal(location.pathname, "/auth/error", `${path} should land on auth error`);
    assert.equal(location.searchParams.get("state"), "state_not_found", `${path} should preserve missing-state error code`);
  }
});

test("edge auth error route renders dedicated auth failure copy instead of falling back to home", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/auth/error?error=unable_to_get_user_info`);
  assert.equal(response.status, 200, "/auth/error should be reachable");
  const body = await response.text();
  assert.match(body, /Authentication Error/i, "auth error route should render auth error heading");
  assert.match(body, /unable_to_get_user_info/i, "auth error route should expose the error code");
  assert.doesNotMatch(body, /Real-Time Geopolitical Intelligence Platform/i, "auth error route should not fall back to home SEO title");
});

test("edge auth error route keeps recovery controls and search-blocking metadata", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/auth/error?error=unable_to_create_user`);
  assert.equal(response.status, 200, "/auth/error should be reachable for create-user errors");
  const body = await response.text();
  assert.match(body, /Unable to create your account/i, "auth error should render the mapped create-user message");
  assert.match(body, /Retry Login/i, "auth error should offer login retry CTA");
  assert.match(body, /Create Account/i, "auth error should offer signup CTA");
  assert.match(body, /Back Home/i, "auth error should offer home CTA");
  assert.match(body, /noindex,nofollow/i, "auth error should be blocked from indexing");
});

test("edge auth error route returns hardened headers", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/auth/error?error=invalid_code`);
  assert.equal(response.status, 200, "/auth/error should be reachable for invalid code errors");
  assertSecurityHeaders(response, "edge /auth/error");
  assert.equal(response.headers.get("cache-control"), "no-store", "/auth/error should not be cached");
});

test("edge auth error route escapes reflected provider detail and falls back safely", async () => {
  const injectedDetail = `<script>alert("xss")</script>"'><img src=x onerror=alert(1)>`;
  const response = await fetchWithRetry(
    `${EDGE_BASE_URL}/auth/error?error=totally_unknown_error&error_description=${encodeURIComponent(injectedDetail)}`,
  );
  assert.equal(response.status, 200, "/auth/error should be reachable for unknown errors");

  const body = await response.text();
  assert.match(body, /Authentication could not be completed/i, "unknown auth errors should use safe default copy");
  assert.match(body, /totally_unknown_error/i, "unknown auth errors should still expose the normalized code");
  assert.match(body, /Provider Detail/i, "auth error should label reflected provider detail");
  assert.doesNotMatch(body, /<script>alert\("xss"\)<\/script>/i, "auth error must not render raw script tags");
  assert.doesNotMatch(body, /<img src=x onerror=alert\(1\)>/i, "auth error must not render raw HTML in provider detail");
  assert.match(body, /&lt;script&gt;alert\(&quot;xss&quot;\)&lt;\/script&gt;/i, "auth error should HTML-escape provider detail");
  assert.match(body, /&lt;img src=x onerror=alert\(1\)&gt;/i, "auth error should escape nested HTML");
  assert.doesNotMatch(body, /Real-Time Geopolitical Intelligence Platform/i, "auth error should not fall back to landing page for unknown errors");
});

test("edge build manifest assets resolve with expected MIME types", async () => {
  const manifestResponse = await fetchWithRetry(`${EDGE_BASE_URL}/_build/.vite/manifest.json`);
  assert.equal(manifestResponse.status, 200, "vite manifest should be reachable");
  const manifest = await readJson(manifestResponse);
  assert.equal(typeof manifest, "object", "manifest should decode as JSON object");

  const entries = Object.values(manifest || {});
  const jsEntry = entries.find((entry) => typeof entry?.file === "string" && entry.file.includes(".js"));
  assert.ok(jsEntry && typeof jsEntry.file === "string", "manifest should contain JS assets");
  const jsAssetResponse = await fetchWithRetry(`${EDGE_BASE_URL}/_build/${jsEntry.file}`);
  assert.equal(jsAssetResponse.status, 200, "referenced JS asset should be reachable");
  const jsContentType = (jsAssetResponse.headers.get("content-type") || "").toLowerCase();
  assert.match(jsContentType, /javascript|ecmascript/, "JS asset should return javascript MIME");

  const cssEntry = entries.find((entry) => Array.isArray(entry?.css) && entry.css.length > 0);
  if (cssEntry && Array.isArray(cssEntry.css) && typeof cssEntry.css[0] === "string") {
    const cssAssetResponse = await fetchWithRetry(`${EDGE_BASE_URL}/_build/${cssEntry.css[0]}`);
    assert.equal(cssAssetResponse.status, 200, "referenced CSS asset should be reachable");
    const cssContentType = (cssAssetResponse.headers.get("content-type") || "").toLowerCase();
    assert.match(cssContentType, /text\/css/, "CSS asset should return text/css MIME");
  }
});

test("edge retired pages redirect cleanly to home", async () => {
  for (const path of ["/polymarket", "/drops"]) {
    const response = await fetchWithRetry(`${EDGE_BASE_URL}${path}`, {
      redirect: "manual",
    });
    assert.equal(response.status, 302, `${path} should redirect instead of rendering stale UI`);
    assert.equal(response.headers.get("location"), `${EDGE_BASE_URL}/`, `${path} should redirect to home`);
    assertSecurityHeaders(response, `edge ${path}`);
  }
});

test("edge retired APIs return explicit 410 JSON responses", async () => {
  for (const path of ["/api/polymarket", "/api/drops", "/api/crypto"]) {
    const response = await fetchWithRetry(`${EDGE_BASE_URL}${path}`, {
      headers: {
        accept: "application/json",
      },
    });
    assert.equal(response.status, 410, `${path} should return gone`);
    assertSecurityHeaders(response, `edge ${path}`);
    const payload = await readJson(response);
    assert.equal(payload?.error, "Endpoint removed", `${path} should expose explicit retired-endpoint status`);
    assert.match(String(payload?.reason || ""), /retired/i, `${path} should explain that the feature is retired`);
  }
});

test("edge API enforces session auth", async () => {
  const [authMe, telegram] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/auth/me`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/telegram`),
  ]);

  assert.equal(authMe.status, 401, "/api/auth/me should require session");
  assert.equal(telegram.status, 401, "/api/telegram should require session");
});

test("edge news feed routes enforce session auth", async () => {
  const [intel, briefings, airSea] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/intel?limit=5`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/briefings?limit=5`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/air-sea?limit=5`),
  ]);

  assert.equal(intel.status, 401, "/api/intel should require session");
  assert.equal(briefings.status, 401, "/api/briefings should require session");
  assert.equal(airSea.status, 401, "/api/air-sea should require session");
});

test("edge auth debug enforces session auth", async () => {
  const debug = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/debug`);
  assert.equal(debug.status, 401, "/api/auth/debug should require session");
});

test("edge auth debug returns owner diagnostics when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated auth/debug e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/debug`, {
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200, "authenticated /api/auth/debug should succeed for owner");
  assertSecurityHeaders(response, "edge /api/auth/debug authenticated");
  const payload = await readJson(response);
  assert.equal(payload?.authenticated, true, "auth debug should mark authenticated=true");
  assert.equal(payload?.entitlement?.role, "owner", "auth debug should expose owner role");
  assert.equal(typeof payload?.user?.login, "string", "auth debug should include user login");
  assert.equal(typeof payload?.cookies?.hasSessionCookie, "boolean", "auth debug should include cookie diagnostics");
});

test("edge auth responses include defensive security headers", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/me`);
  assert.equal(response.status, 401, "unauthenticated auth/me should return 401");
  assertSecurityHeaders(response, "edge /api/auth/me");
});

test("edge auth me returns entitlement shape when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated auth/me entitlement e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/me`, {
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200, "authenticated /api/auth/me should succeed");
  const payload = await readJson(response);
  assert.equal(payload?.authenticated, true, "auth/me should return authenticated=true");
  assert.equal(typeof payload?.user?.login, "string", "auth/me should return user login");
  assert.equal(typeof payload?.entitlement?.tier, "string", "auth/me should include entitlement tier");
  assert.equal(typeof payload?.entitlement?.role, "string", "auth/me should include entitlement role");
  assert.equal(typeof payload?.entitlement?.entitled, "boolean", "auth/me should include entitled boolean");
  assert.equal(typeof payload?.entitlement?.limits, "object", "auth/me should include limits object");
});

test("edge auth probe clears legacy auth cookies when unauthenticated", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/me`, {
    headers: {
      Cookie: [
        "pyrobot_session=stale",
        "__Host-intel-session=stale",
        "pyrobot_x_access=stale",
        "pyrobot_x_access_ref=stale",
      ].join("; "),
    },
  });
  assert.equal(response.status, 401, "unauthenticated auth probe should return 401");
  const setCookies = getSetCookieValues(response.headers).join("\n");
  assert.match(setCookies, /pyrobot_session=deleted/i, "should clear pyrobot_session");
  assert.match(setCookies, /__Host-intel-session=deleted/i, "should clear __Host-intel-session");
  assert.match(setCookies, /pyrobot_x_access=deleted/i, "should clear pyrobot_x_access");
  assert.match(setCookies, /pyrobot_x_access_ref=deleted/i, "should clear pyrobot_x_access_ref");
});

test("legacy oauth login routes redirect to active auth flow", async () => {
  const [legacyGithub, legacyX] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/oauth/login`, { redirect: "manual" }),
    fetchWithRetry(`${EDGE_BASE_URL}/oauth/x/login`, { redirect: "manual" }),
  ]);
  assert.ok(
    legacyGithub.status === 302 || legacyGithub.status === 403,
    `legacy github login route should redirect or be WAF challenged (got ${legacyGithub.status})`,
  );
  assert.ok(
    legacyX.status === 302 || legacyX.status === 403,
    `legacy x login route should redirect or be WAF challenged (got ${legacyX.status})`,
  );

  if (legacyGithub.status === 302) {
    const githubLocation = legacyGithub.headers.get("location") || "";
    assert.match(
      githubLocation,
      /github\.com|authorize|\/login\?error=security_check_required|\/signup\?error=security_check_required/i,
      "legacy github route should point to auth provider or turnstile gate",
    );
  }
  if (legacyX.status === 302) {
    const xLocation = legacyX.headers.get("location") || "";
    assert.match(
      xLocation,
      /x\.com\/i\/oauth2\/authorize|\/login\?error=security_check_required|\/signup\?error=security_check_required/i,
      "legacy x route should point to X OAuth2 authorize or turnstile gate",
    );
  }
});

test("edge Stripe webhook requires signature header", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: "evt_test" }),
  });
  assert.equal(response.status, 400, "Stripe webhook without signature must be rejected");
});

test("edge privileged trigger routes fail closed without signed admin request", async () => {
  const [cacheBustGet, scraperTriggerGet, cacheBustPost, scraperTriggerPost] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/cache-bust`, {
      method: "GET",
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/scraper/trigger`, {
      method: "GET",
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/cache-bust`, {
      method: "POST",
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/scraper/trigger`, {
      method: "POST",
    }),
  ]);

  assert.equal(cacheBustGet.status, 405, "/api/cache-bust should reject GET");
  assert.equal(scraperTriggerGet.status, 405, "/api/scraper/trigger should reject GET");
  assert.equal(cacheBustPost.status, 403, "/api/cache-bust should reject unsigned POST");
  assert.equal(scraperTriggerPost.status, 403, "/api/scraper/trigger should reject unsigned POST");

  const [cacheBustGetBody, scraperTriggerGetBody, cacheBustPostBody, scraperTriggerPostBody] = await Promise.all([
    readJson(cacheBustGet),
    readJson(scraperTriggerGet),
    readJson(cacheBustPost),
    readJson(scraperTriggerPost),
  ]);

  assert.equal(cacheBustGetBody?.error, "Method Not Allowed", "/api/cache-bust GET should return explicit method error");
  assert.equal(scraperTriggerGetBody?.error, "Method Not Allowed", "/api/scraper/trigger GET should return explicit method error");
  assert.equal(cacheBustPostBody?.error, "Forbidden", "/api/cache-bust POST should return explicit forbidden error");
  assert.equal(scraperTriggerPostBody?.error, "Forbidden", "/api/scraper/trigger POST should return explicit forbidden error");
  assert.ok(cacheBustPostBody?.reason, "/api/cache-bust POST should explain the signature failure");
  assert.ok(scraperTriggerPostBody?.reason, "/api/scraper/trigger POST should explain the signature failure");
});

test("edge privileged and webhook failure paths keep defensive security headers", async () => {
  const [stripeGet, stripePostMissingSig, cacheBustGet, cacheBustPost] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/webhooks/stripe`, {
      method: "GET",
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "evt_test" }),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/cache-bust`, {
      method: "GET",
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/cache-bust`, {
      method: "POST",
    }),
  ]);

  assert.equal(stripeGet.status, 405, "stripe webhook should reject GET");
  assert.equal(stripePostMissingSig.status, 400, "stripe webhook should reject missing signature");
  assert.equal(cacheBustGet.status, 405, "cache bust should reject GET");
  assert.equal(cacheBustPost.status, 403, "cache bust should reject unsigned POST");

  assertSecurityHeaders(stripeGet, "edge /api/webhooks/stripe GET");
  assertSecurityHeaders(stripePostMissingSig, "edge /api/webhooks/stripe POST missing signature");
  assertSecurityHeaders(cacheBustGet, "edge /api/cache-bust GET");
  assertSecurityHeaders(cacheBustPost, "edge /api/cache-bust POST unsigned");
});

test("edge status and whale routes require session auth", async () => {
  const [statusRes, whalesRes] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/status`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/whales`),
  ]);

  assert.equal(statusRes.status, 401, "/api/status should require session");
  assert.equal(whalesRes.status, 401, "/api/whales should require session");
});

test("edge owner status, whales, and dedupe feedback routes return operator payloads when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated operator-route e2e",
  );
  if (!cookie) return;

  const [statusRes, whalesRes, feedbackRes] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/status`, {
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/whales`, {
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/telegram/dedupe-feedback`, {
      headers: { Cookie: cookie },
    }),
  ]);

  assert.equal(statusRes.status, 200, "/api/status should succeed for owner");
  assert.equal(whalesRes.status, 200, "/api/whales should succeed for owner");
  assert.equal(feedbackRes.status, 200, "/api/telegram/dedupe-feedback should succeed for owner");
  assertSecurityHeaders(statusRes, "edge /api/status authenticated");
  assertSecurityHeaders(whalesRes, "edge /api/whales authenticated");
  assertSecurityHeaders(feedbackRes, "edge /api/telegram/dedupe-feedback authenticated");

  const [statusPayload, whalesPayload, feedbackPayload] = await Promise.all([
    readJson(statusRes),
    readJson(whalesRes),
    readJson(feedbackRes),
  ]);

  assert.equal(statusPayload?.intelCache?.status, "ok", "/api/status should include intel cache health");
  assert.equal(statusPayload?.telegramScraper?.status, "ok", "/api/status should include scraper health");
  assert.ok(Array.isArray(whalesPayload), "/api/whales should return an array payload");
  assert.equal(feedbackPayload?.ok, true, "/api/telegram/dedupe-feedback should return ok=true");
  assert.equal(typeof feedbackPayload?.count, "number", "/api/telegram/dedupe-feedback should include count");
  assert.ok(Array.isArray(feedbackPayload?.rows), "/api/telegram/dedupe-feedback should include rows");
});

test("edge API preflight returns CORS and defensive security headers", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/intel`, {
    method: "OPTIONS",
    headers: {
      Origin: SITE_ORIGIN,
      "Access-Control-Request-Method": "GET",
    },
  });

  assert.equal(response.status, 200, "API preflight should return 200");
  assert.equal(response.headers.get("access-control-max-age"), "86400", "API preflight should advertise max age");
  assertSecurityHeaders(response, "edge /api/intel OPTIONS");
});

test("edge turnstile verify route fails safely on synthetic invalid payloads", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/auth/turnstile/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  assert.ok([200, 400].includes(response.status), `turnstile verify should either bypass or reject invalid payload (got ${response.status})`);
  assertSecurityHeaders(response, "edge /api/auth/turnstile/verify");
  assert.equal(response.headers.get("cache-control"), "private, no-store, no-cache, must-revalidate", "turnstile verify should disable caching");

  const payload = await readJson(response);
  if (response.status === 200) {
    assert.equal(payload?.ok, true, "turnstile bypass mode should report ok=true");
    assert.equal(payload?.bypassed, true, "turnstile bypass mode should signal bypass");
  } else {
    assert.equal(payload?.ok, false, "turnstile invalid payload should report ok=false");
    assert.equal(payload?.error, "invalid_payload", "turnstile invalid payload should use explicit error code");
  }
});

test("edge unknown API routes return explicit not found with defensive headers", async () => {
  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/does-not-exist`);

  assert.equal(response.status, 401, "unknown API route should still fail behind session auth");
  assertSecurityHeaders(response, "edge /api/does-not-exist");
  assert.equal(response.headers.get("cache-control"), "private, no-store, no-cache, must-revalidate", "unknown API auth failure should disable caching");
  const payload = await readJson(response);
  assert.equal(payload?.error, "Unauthorized", "unknown API route should not leak internal path details before auth");
});

test("edge billing endpoints require session auth", async () => {
  const [statusRes, checkoutRes, portalRes, activityRes, crmRes, crmCustomerRes, crmCancelRes, crmRefundRes] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/status`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/portal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/activity`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/overview`),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/customer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: "someone" }),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/cancel-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: "someone", atPeriodEnd: true }),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: "someone" }),
    }),
  ]);

  assert.equal(statusRes.status, 401, "/api/billing/status should require session");
  assert.equal(checkoutRes.status, 401, "/api/billing/checkout should require session");
  assert.equal(portalRes.status, 401, "/api/billing/portal should require session");
  assert.equal(activityRes.status, 401, "/api/billing/activity should require session");
  assert.equal(crmRes.status, 401, "/api/admin/crm/overview should require session");
  assert.equal(crmCustomerRes.status, 401, "/api/admin/crm/customer should require session");
  assert.equal(crmCancelRes.status, 401, "/api/admin/crm/cancel-subscription should require session");
  assert.equal(crmRefundRes.status, 401, "/api/admin/crm/refund should require session");
});

test("edge billing status returns entitlement payload when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated billing status e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/billing/status`, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200, "authenticated /api/billing/status should succeed");
  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "billing status payload should mark ok=true");
  assert.equal(typeof payload?.result?.userId, "string", "billing status should include userId");
  assert.equal(typeof payload?.result?.entitled, "boolean", "billing status should include entitlement");
});

test("edge billing start-trial returns the expected owner or trial state when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated billing start-trial e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/billing/start-trial`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 200, "authenticated /api/billing/start-trial should succeed");

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "billing start-trial payload should mark ok=true");
  assert.equal(typeof payload?.result?.userId, "string", "billing start-trial should include userId");
  assert.equal(typeof payload?.result?.trialEligible, "boolean", "billing start-trial should include trial eligibility");
  assert.equal(typeof payload?.result?.trialStarted, "boolean", "billing start-trial should include trialStarted flag");
  assert.equal(typeof payload?.result?.owner, "boolean", "billing start-trial should include owner flag");
});

test("edge authenticated mutating routes enforce method contracts", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated edge method-contract e2e",
  );
  if (!cookie) return;

  const [trialGet, checkoutGet, portalGet, crmOverviewPost, crmCustomerGet, crmCancelGet, crmRefundGet] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/start-trial`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/checkout`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/billing/portal`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/overview`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/customer`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/cancel-subscription`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/refund`, {
      method: "GET",
      headers: { Cookie: cookie },
    }),
  ]);

  const postOnlyResponses = [trialGet, checkoutGet, portalGet, crmCustomerGet, crmCancelGet, crmRefundGet];
  for (const response of postOnlyResponses) {
    assert.equal(response.status, 405, "POST-only authenticated route should reject GET");
    assert.equal(response.headers.get("allow"), "POST", "POST-only authenticated route should advertise Allow: POST");
    assertSecurityHeaders(response, "authenticated POST-only route");
  }

  assert.equal(crmOverviewPost.status, 405, "/api/admin/crm/overview should reject POST");
  assert.equal(crmOverviewPost.headers.get("allow"), "GET", "/api/admin/crm/overview should advertise Allow: GET");
  assertSecurityHeaders(crmOverviewPost, "edge /api/admin/crm/overview POST");
});

test("edge billing checkout returns redirect or owner bypass when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated billing checkout e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/billing/checkout`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 200, "authenticated /api/billing/checkout should succeed");

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "billing checkout payload should mark ok=true");
  const bypass = payload?.result?.bypassCheckout === true;
  if (bypass) {
    assert.equal(payload?.result?.owner, true, "checkout bypass should indicate owner");
  } else {
    assert.equal(typeof payload?.result?.checkoutUrl, "string", "checkout should return checkoutUrl");
    assert.match(payload?.result?.checkoutUrl || "", /^https:\/\/checkout\.stripe\.com\//, "checkoutUrl should point to Stripe");
  }
});

test("edge billing portal returns stripe portal URL or actionable conflict when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated billing portal e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/billing/portal`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  assert.ok([200, 409].includes(response.status), "/api/billing/portal should return success or conflict");
  const payload = await readJson(response);
  if (response.status === 409) {
    assert.equal(payload?.ok, false, "conflict response should be ok=false");
    assert.equal(typeof payload?.error, "string", "conflict should return error string");
    return;
  }

  assert.equal(payload?.ok, true, "billing portal payload should mark ok=true");
  const bypass = payload?.result?.bypassPortal === true;
  if (bypass) {
    assert.equal(payload?.result?.owner, true, "portal bypass should indicate owner");
  } else {
    assert.equal(typeof payload?.result?.portalUrl, "string", "portal should return portalUrl");
    assert.match(payload?.result?.portalUrl || "", /^https:\/\/billing\.stripe\.com\//, "portalUrl should point to Stripe billing portal");
  }
});

test("edge billing activity returns timeline payload when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated billing activity e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/billing/activity`, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200, "authenticated /api/billing/activity should succeed");
  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "billing activity payload should mark ok=true");
  assert.ok(Array.isArray(payload?.result?.events), "billing activity should return an events array");
});

test("edge owner CRM overview exposes command-center schema when authorized", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated CRM overview e2e",
  );
  if (!cookie) return;

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/overview`, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });

  assert.ok([200, 403].includes(response.status), "CRM overview should return owner data or forbidden");
  if (response.status === 403) {
    return;
  }

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "crm overview should mark ok=true");
  assert.equal(typeof payload?.result?.billing?.trackedUsers, "number", "crm should include trackedUsers");
  assert.equal(typeof payload?.result?.commandCenter?.funnel?.trialToPaidRate7dPct, "number", "crm should include funnel conversion");
  assert.equal(typeof payload?.result?.dataQuality?.providerCoveragePct, "number", "crm should include data quality coverage");
});

test("edge owner CRM mutation proxies return billing-account-not-found for unmapped owner target", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated owner CRM mutation e2e",
  );
  if (!cookie) return;

  const [customerResponse, cancelResponse, refundResponse] = await Promise.all([
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/customer`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: USER_ID }),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/cancel-subscription`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: USER_ID, atPeriodEnd: true }),
    }),
    fetchWithRetry(`${EDGE_BASE_URL}/api/admin/crm/refund`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ targetUserId: USER_ID }),
    }),
  ]);

  for (const [response, label] of [
    [customerResponse, "edge owner crm customer"],
    [cancelResponse, "edge owner crm cancel-subscription"],
    [refundResponse, "edge owner crm refund"],
  ]) {
    assert.equal(response.status, 404, `${label} should surface missing billing account`);
    assertSecurityHeaders(response, label);
    const payload = await readJson(response);
    assert.equal(payload?.ok, false, `${label} should return ok=false`);
    assert.equal(payload?.error, "Billing account not found for target user.", `${label} should preserve backend error`);
  }
});

test("backend user-info requires bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/user-info`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 401, "user-info without token must be unauthorized");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/user-info");
});

test("backend billing status rejects non-POST methods", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/status`, {
    method: "GET",
  });
  assert.equal(response.status, 405, "billing status should reject GET");
  assert.equal(response.headers.get("allow"), "POST", "billing status should advertise POST allow header");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/billing/status GET");
});

test("backend billing status requires bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 401, "billing status without token must be unauthorized");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/billing/status");
});

test("backend billing activity rejects unsupported methods", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/activity`, {
    method: "PUT",
  });
  assert.equal(response.status, 405, "billing activity should reject PUT");
  assert.equal(response.headers.get("allow"), "GET, POST", "billing activity should advertise GET, POST allow header");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/billing/activity PUT");
});

test("backend billing activity requires bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/activity?userId=${encodeURIComponent(USER_ID)}`, {
    method: "GET",
  });
  assert.equal(response.status, 401, "billing activity without token must be unauthorized");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/billing/activity GET");
});

test("backend admin CRM summary requires bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 401, "admin crm summary without token must be unauthorized");
});

test("backend admin CRM summary rejects non-POST methods", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "GET",
  });
  assert.equal(response.status, 405, "admin crm summary should reject GET");
  assert.equal(response.headers.get("allow"), "POST", "admin crm summary should advertise POST allow header");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/admin/crm/summary GET");
});

test("backend public feed routes are not exposed", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const [intel, briefings, airSea, landing] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel`),
    fetchWithRetry(`${backendBaseUrl}/api/briefings`),
    fetchWithRetry(`${backendBaseUrl}/api/air-sea`),
    fetchWithRetry(`${backendBaseUrl}/`),
  ]);
  assert.equal(intel.status, 404, "public backend /api/intel should be disabled");
  assert.equal(briefings.status, 404, "public backend /api/briefings should be disabled");
  assert.equal(airSea.status, 404, "public backend /api/air-sea should be disabled");
  assert.equal(landing.status, 200, "backend root should render landing page");
  assertSecurityHeaders(landing, "backend root landing");
  const landingBody = await landing.text();
  assert.match(landingBody, /SentinelStream/i, "backend root should render SentinelStream branding");
  assert.match(landingBody, /Real-Time OSINT Intelligence Stream/i, "backend root should render landing tagline");
});

test("backend sources catalog supports authenticated GET and POST filters", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend sources e2e",
  );
  if (!token) return;

  const [getResponse, postResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/sources?region=global&limit=5`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/sources`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ region: "global", limit: 5 }),
    }),
  ]);

  assert.equal(getResponse.status, 200, "authenticated backend sources GET should succeed");
  assert.equal(postResponse.status, 200, "authenticated backend sources POST should succeed");
  assertSecurityHeaders(getResponse, "backend /api/intel-dashboard/sources GET");
  assertSecurityHeaders(postResponse, "backend /api/intel-dashboard/sources POST");

  const [getPayload, postPayload] = await Promise.all([readJson(getResponse), readJson(postResponse)]);
  for (const payload of [getPayload, postPayload]) {
    assert.equal(payload?.ok, true, "sources payload should mark ok=true");
    assert.equal(typeof payload?.result?.returned, "number", "sources payload should include returned count");
    assert.equal(typeof payload?.result?.total, "number", "sources payload should include total count");
    assert.ok(Array.isArray(payload?.result?.items), "sources payload should include items array");
    assert.equal(typeof payload?.result?.items?.[0]?.id, "string", "sources items should include id");
    assert.equal(typeof payload?.result?.items?.[0]?.name, "string", "sources items should include name");
  }
});

test("backend sources catalog rejects unsupported methods and missing bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;

  const [putResponse, unauthGetResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/sources`, {
      method: "PUT",
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/sources?region=global&limit=5`, {
      method: "GET",
    }),
  ]);

  assert.equal(putResponse.status, 405, "backend sources should reject PUT");
  assert.equal(putResponse.headers.get("allow"), "GET, POST", "backend sources should advertise GET, POST allow header");
  assert.equal(unauthGetResponse.status, 401, "backend sources GET without token must be unauthorized");
  assertSecurityHeaders(putResponse, "backend /api/intel-dashboard/sources PUT");
  assertSecurityHeaders(unauthGetResponse, "backend /api/intel-dashboard/sources GET");
});

test("backend user-info with bearer token returns entitlement shape", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/user-info`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 200, "user-info with token should succeed");

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "backend payload should mark ok=true");
  assert.equal(typeof payload?.result?.tier, "string", "tier should be present");
  assert.equal(typeof payload?.result?.entitled, "boolean", "entitled should be boolean");
  assert.equal(typeof payload?.result?.delayMinutes, "number", "delayMinutes should be numeric");
});

test("backend billing status and activity return authenticated owner payloads with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend billing e2e",
  );
  if (!token) return;

  const [statusResponse, activityResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/activity`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  assert.equal(statusResponse.status, 200, "billing status with token should succeed");
  assert.equal(activityResponse.status, 200, "billing activity with token should succeed");
  assertSecurityHeaders(statusResponse, "backend /api/intel-dashboard/billing/status POST");
  assertSecurityHeaders(activityResponse, "backend /api/intel-dashboard/billing/activity POST");

  const [statusPayload, activityPayload] = await Promise.all([
    readJson(statusResponse),
    readJson(activityResponse),
  ]);

  assert.equal(statusPayload?.ok, true, "billing status payload should mark ok=true");
  assert.equal(typeof statusPayload?.result?.role, "string", "billing status should include role");
  assert.equal(typeof statusPayload?.result?.policy?.rateLimitPerMinute, "number", "billing status should include rate-limit policy");
  assert.equal(typeof statusPayload?.result?.rateLimit?.remaining, "number", "billing status should include rate-limit remaining");

  assert.equal(activityPayload?.ok, true, "billing activity payload should mark ok=true");
  assert.ok(Array.isArray(activityPayload?.result?.events), "billing activity should include events array");
  assert.equal(typeof activityPayload?.result?.total, "number", "billing activity should include total count");
});

test("backend billing owner actions return bypass semantics with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend billing action e2e",
  );
  if (!token) return;

  const [trialResponse, checkoutResponse, portalResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/start-trial`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/portal`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  assert.equal(trialResponse.status, 200, "backend billing start-trial should succeed for owner");
  assert.equal(checkoutResponse.status, 200, "backend billing checkout should succeed for owner");
  assert.equal(portalResponse.status, 200, "backend billing portal should succeed for owner");
  assertSecurityHeaders(trialResponse, "backend /api/intel-dashboard/billing/start-trial POST");
  assertSecurityHeaders(checkoutResponse, "backend /api/intel-dashboard/billing/checkout POST");
  assertSecurityHeaders(portalResponse, "backend /api/intel-dashboard/billing/portal POST");

  const [trialPayload, checkoutPayload, portalPayload] = await Promise.all([
    readJson(trialResponse),
    readJson(checkoutResponse),
    readJson(portalResponse),
  ]);

  assert.equal(trialPayload?.ok, true, "billing start-trial payload should mark ok=true");
  assert.equal(trialPayload?.result?.owner, true, "billing start-trial should identify owner");
  assert.equal(trialPayload?.result?.trialStarted, false, "owner start-trial should not create a trial");

  assert.equal(checkoutPayload?.ok, true, "billing checkout payload should mark ok=true");
  assert.equal(checkoutPayload?.result?.owner, true, "billing checkout should identify owner");
  assert.equal(checkoutPayload?.result?.bypassCheckout, true, "billing checkout should bypass owner");

  assert.equal(portalPayload?.ok, true, "billing portal payload should mark ok=true");
  assert.equal(portalPayload?.result?.owner, true, "billing portal should identify owner");
  assert.equal(portalPayload?.result?.bypassPortal, true, "billing portal should bypass owner");
});

test("backend ai jobs execute live text, media, and escalation lanes with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    AI_JOBS_TOKEN,
    "E2E_AI_JOBS_TOKEN is required for live backend ai-jobs e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/ai/jobs`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxConnections: 3,
      jobs: [
        {
          type: "dedupe",
          payload: {
            title: "Text-only duplicate check",
            url: "https://example.com/text-only",
            summary: "Standard text lane smoke check for production routing.",
          },
        },
        {
          type: "dedupe",
          preferEscalation: true,
          payload: {
            title: "Forced escalation check",
            url: "https://example.com/escalation",
            summary: "This request should use the dedicated escalation lane.",
          },
        },
        {
          type: "dedupe",
          payload: {
            title: "Media lane smoke check",
            summary: "Image-aware dedupe should route through the media model.",
            media: [
              {
                type: "image",
                url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png",
              },
            ],
          },
        },
      ],
    }),
  });

  assert.equal(response.status, 200, "backend ai jobs live request should succeed");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/ai/jobs POST");

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "ai jobs payload should mark ok=true");
  assert.equal(payload?.result?.model, "cerebras/gpt-oss-120b", "sync ai jobs should report Cerebras text model");
  assert.ok(Array.isArray(payload?.result?.jobs), "ai jobs should include jobs array");
  assert.equal(payload?.result?.jobs?.length, 3, "ai jobs should return three lane results");

  const [textJob, escalationJob, mediaJob] = payload.result.jobs;
  assert.equal(textJob?.ok, true, "text dedupe should succeed");
  assert.ok(
    textJob?.result?.lane === "text" || textJob?.result?.lane === "fallback_hash",
    `text dedupe should use text lane or explicit fallback (got ${textJob?.result?.lane})`,
  );
  if (textJob?.result?.lane === "text") {
    assert.equal(textJob?.result?.model, "cerebras/gpt-oss-120b", "text dedupe should use Cerebras default model");
  } else {
    assert.equal(textJob?.result?.aiGatewayUsed, false, "fallback should not present as AI success");
    assert.equal(typeof textJob?.result?.fallbackReason, "string", "fallback should surface a reason");
    if (textJob?.result?.gatewayStatus !== undefined) {
      assert.equal(typeof textJob?.result?.gatewayStatus, "number", "gateway status should be numeric when present");
    }
  }
  assert.equal(typeof textJob?.result?.dedupeKey, "string", "text dedupe should return hashed key");

  assert.equal(escalationJob?.ok, true, "escalation dedupe should succeed");
  assert.ok(
    escalationJob?.result?.lane === "escalation" || escalationJob?.result?.lane === "fallback_hash",
    `forced escalation should use escalation lane or explicit fallback (got ${escalationJob?.result?.lane})`,
  );
  if (escalationJob?.result?.lane === "escalation") {
    assert.equal(escalationJob?.result?.model, "cerebras/zai-glm-4.7", "forced escalation should use GLM route");
    assert.equal(escalationJob?.result?.escalationUsed, true, "forced escalation should flag escalation use");
  } else {
    assert.equal(typeof escalationJob?.result?.fallbackReason, "string", "escalation fallback should surface a reason");
    if (escalationJob?.result?.gatewayStatus !== undefined) {
      assert.equal(typeof escalationJob?.result?.gatewayStatus, "number", "gateway status should be numeric when present");
    }
  }

  assert.equal(mediaJob?.ok, true, "media dedupe should succeed");
  assert.ok(
    mediaJob?.result?.lane === "media" || mediaJob?.result?.lane === "fallback_hash",
    `media dedupe should use media lane or explicit fallback (got ${mediaJob?.result?.lane})`,
  );
  if (mediaJob?.result?.lane === "media") {
    assert.equal(
      mediaJob?.result?.model,
      "groq/meta-llama/llama-4-scout-17b-16e-instruct",
      "media dedupe should use Groq Scout",
    );
  } else {
    assert.equal(typeof mediaJob?.result?.fallbackReason, "string", "media fallback should surface a reason");
    if (mediaJob?.result?.gatewayStatus !== undefined) {
      assert.equal(typeof mediaJob?.result?.gatewayStatus, "number", "gateway status should be numeric when present");
    }
  }
  assert.equal(mediaJob?.result?.mediaUsed, true, "media dedupe should flag media usage");
  assert.equal(typeof mediaJob?.result?.mediaCount, "number", "media dedupe should report media count");
});

test("backend news returns tier-aware payloads with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend news e2e",
  );
  if (!token) return;

  const [ownerResponse, freeResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/news`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/news`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: NON_OWNER_USER_ID }),
    }),
  ]);

  assert.equal(ownerResponse.status, 200, "backend news owner request should succeed");
  assert.equal(freeResponse.status, 200, "backend news free-tier request should succeed");
  assertSecurityHeaders(ownerResponse, "backend /api/intel-dashboard/news owner");
  assertSecurityHeaders(freeResponse, "backend /api/intel-dashboard/news free");

  const [ownerPayload, freePayload] = await Promise.all([
    readJson(ownerResponse),
    readJson(freeResponse),
  ]);

  assert.equal(ownerPayload?.ok, true, "owner news payload should mark ok=true");
  assert.equal(ownerPayload?.result?.entitled, true, "owner news payload should be entitled");
  assert.equal(typeof ownerPayload?.result?.returned, "number", "owner news payload should include returned count");
  assert.ok(Array.isArray(ownerPayload?.result?.items), "owner news payload should include items");

  assert.equal(freePayload?.ok, true, "free news payload should mark ok=true");
  assert.equal(freePayload?.result?.entitled, false, "free news payload should not be entitled");
  assert.equal(typeof freePayload?.result?.delayMinutes, "number", "free news payload should include delay");
  assert.equal(typeof freePayload?.result?.policy?.maxNewsItems, "number", "free news payload should include policy cap");
  assert.ok(Array.isArray(freePayload?.result?.items), "free news payload should include items");
});

test("backend admin CRM summary forbids non-owner with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM non-owner auth e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: NON_OWNER_USER_ID }),
  });
  assert.equal(response.status, 403, "admin crm summary should forbid non-owner user");
});

test("backend admin CRM summary returns owner schema with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM summary e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.ok([200, 403].includes(response.status), "admin crm summary should return owner schema or forbidden");
  if (response.status === 403) {
    return;
  }

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "admin crm summary should mark ok=true");
  assert.equal(typeof payload?.result?.billing?.trackedUsers, "number", "admin crm should include trackedUsers");
  assert.equal(typeof payload?.result?.telemetry?.events24h, "number", "admin crm should include telemetry events");
  assert.equal(typeof payload?.result?.telemetry?.uniqueUsers7d, "number", "admin crm should include unique user rollups");
  assert.equal(typeof payload?.result?.commandCenter?.revenue?.arpuActiveUsd, "number", "admin crm should include revenue rollup");
  assert.equal(typeof payload?.result?.commandCenter?.funnel?.trialToPaidRate7dPct, "number", "admin crm should include funnel rollup");
  assert.equal(typeof payload?.result?.commandCenter?.risk?.churnRate30dPct, "number", "admin crm should include churn rollup");
});

test("backend admin CRM summary rejects invalid body with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM invalid-body e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 400, "admin crm summary should reject payloads without userId");
});

test("backend owner CRM operation routes reject missing targetUserId with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for owner CRM operation validation e2e",
  );
  if (!token) return;

  const [customerResponse, cancelResponse, refundResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/customer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/cancel-subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  for (const [response, label] of [
    [customerResponse, "customer"],
    [cancelResponse, "cancel-subscription"],
    [refundResponse, "refund"],
  ]) {
    assert.equal(response.status, 400, `${label} should reject missing targetUserId`);
    assertSecurityHeaders(response, `backend admin crm ${label}`);
    const payload = await readJson(response);
    assert.equal(payload?.ok, false, `${label} should return ok=false`);
    assert.equal(payload?.error, "Expected non-empty targetUserId.", `${label} should explain the missing targetUserId`);
  }
});

test("backend owner CRM operation routes return billing-account-not-found for unmapped owner target", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for owner CRM missing-account e2e",
  );
  if (!token) return;

  const [customerResponse, cancelResponse, refundResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/customer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/cancel-subscription`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID, atPeriodEnd: true }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID }),
    }),
  ]);

  for (const [response, label] of [
    [customerResponse, "backend owner crm customer missing-account"],
    [cancelResponse, "backend owner crm cancel-subscription missing-account"],
    [refundResponse, "backend owner crm refund missing-account"],
  ]) {
    assert.equal(response.status, 404, `${label} should return missing billing account`);
    assertSecurityHeaders(response, label);
    const payload = await readJson(response);
    assert.equal(payload?.ok, false, `${label} should return ok=false`);
    assert.equal(payload?.error, "Billing account not found for target user.", `${label} should explain the missing billing account`);
  }
});

test("backend owner CRM operation routes reject unsupported methods and missing bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;

  const [customerGet, cancelGet, refundGet, customerPost, cancelPost, refundPost] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/customer`, {
      method: "GET",
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/cancel-subscription`, {
      method: "GET",
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/refund`, {
      method: "GET",
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/customer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/cancel-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: USER_ID }),
    }),
  ]);

  for (const [response, label] of [
    [customerGet, "customer GET"],
    [cancelGet, "cancel-subscription GET"],
    [refundGet, "refund GET"],
  ]) {
    assert.equal(response.status, 405, `${label} should reject GET`);
    assert.equal(response.headers.get("allow"), "POST", `${label} should advertise Allow: POST`);
    assertSecurityHeaders(response, `backend admin crm ${label}`);
  }

  for (const [response, label] of [
    [customerPost, "customer POST"],
    [cancelPost, "cancel-subscription POST"],
    [refundPost, "refund POST"],
  ]) {
    assert.equal(response.status, 401, `${label} without token must be unauthorized`);
    assertSecurityHeaders(response, `backend admin crm ${label}`);
  }
});

test("backend protected admin and usage routes reject unsupported methods and missing bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;

  const requests = [
    {
      label: "ai.jobs PUT",
      method: "PUT",
      path: "/api/intel-dashboard/ai/jobs",
      expectedStatus: 405,
      expectedAllow: "GET, POST",
    },
    {
      label: "ai.jobs GET unauthorized",
      method: "GET",
      path: "/api/intel-dashboard/ai/jobs?batchId=test-batch",
      expectedStatus: 401,
    },
    {
      label: "ai.jobs POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/ai/jobs",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "news GET",
      method: "GET",
      path: "/api/intel-dashboard/news",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "news POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/news",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "news.publish GET",
      method: "GET",
      path: "/api/intel-dashboard/news/publish",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "news.publish POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/news/publish",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "billing.subscribe GET",
      method: "GET",
      path: "/api/intel-dashboard/billing/subscribe",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "billing.subscribe POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/billing/subscribe",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "outbound.publish GET",
      method: "GET",
      path: "/api/intel-dashboard/outbound/publish",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "outbound.publish POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/outbound/publish",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "usage-data-source GET",
      method: "GET",
      path: "/api/intel-dashboard/usage-data-source",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "usage-data-source POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/usage-data-source",
      expectedStatus: 401,
      body: "{}",
    },
    {
      label: "usage-data-source/seed GET",
      method: "GET",
      path: "/api/intel-dashboard/usage-data-source/seed",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "usage-data-source/seed POST unauthorized",
      method: "POST",
      path: "/api/intel-dashboard/usage-data-source/seed",
      expectedStatus: 401,
      body: "[]",
    },
    {
      label: "billing.webhook GET",
      method: "GET",
      path: "/api/intel-dashboard/billing/webhook",
      expectedStatus: 405,
      expectedAllow: "POST",
    },
    {
      label: "billing.webhook POST missing signature",
      method: "POST",
      path: "/api/intel-dashboard/billing/webhook",
      expectedStatus: 400,
      body: "{}",
    },
  ];

  for (const req of requests) {
    const response = await fetchWithRetry(`${backendBaseUrl}${req.path}`, {
      method: req.method,
      headers: req.body ? { "Content-Type": "application/json" } : undefined,
      body: req.body,
    });

    assert.equal(response.status, req.expectedStatus, `${req.label} should return expected status`);
    if (req.expectedAllow) {
      assert.equal(response.headers.get("allow"), req.expectedAllow, `${req.label} should advertise Allow header`);
    }
    assertSecurityHeaders(response, `backend ${req.label}`);
  }
});

test("backend admin CRM summary rejects malformed JSON with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM malformed-json e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{",
  });
  assert.equal(response.status, 400, "admin crm summary should reject malformed JSON bodies");
});

test("backend admin CRM summary enforces application/json content type", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM content-type e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 415, "admin crm summary should reject non-JSON content types");
});

test("backend feature-gates rejects non-POST methods", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/feature-gates`, {
    method: "GET",
  });
  assert.equal(response.status, 405, "feature-gates should reject GET");
  assert.equal(response.headers.get("allow"), "POST", "feature-gates should advertise POST allow header");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/feature-gates GET");
});

test("backend feature-gates requires bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/feature-gates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 401, "feature-gates without token must be unauthorized");
  assertSecurityHeaders(response, "backend /api/intel-dashboard/feature-gates");
});

test("backend admin CRM summary metrics remain finite when owner is authorized", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM finite-metrics e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.ok([200, 403].includes(response.status), "admin crm finite-metrics should return owner schema or forbidden");
  if (response.status === 403) {
    return;
  }

  const payload = await readJson(response);
  const values = [
    payload?.result?.billing?.mrrActiveUsd,
    payload?.result?.billing?.arrActiveUsd,
    payload?.result?.telemetry?.events24h,
    payload?.result?.telemetry?.events7d,
    payload?.result?.telemetry?.uniqueUsers24h,
    payload?.result?.telemetry?.uniqueUsers7d,
    payload?.result?.commandCenter?.revenue?.arpuActiveUsd,
    payload?.result?.commandCenter?.risk?.churnRate30dPct,
    payload?.result?.commandCenter?.funnel?.trialToPaidRate7dPct,
  ];
  for (const value of values) {
    assert.equal(typeof value, "number", "metric should be numeric");
    assert.equal(Number.isFinite(value), true, "metric should be finite");
  }
});

test("backend admin CRM summary maintains numeric consistency when owner is authorized", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for admin CRM numeric-consistency e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.ok([200, 403].includes(response.status), "admin crm numeric-consistency should return owner schema or forbidden");
  if (response.status === 403) {
    return;
  }

  const payload = await readJson(response);
  const mrr = Number(payload?.result?.billing?.mrrActiveUsd ?? 0);
  const arr = Number(payload?.result?.billing?.arrActiveUsd ?? 0);
  assert.equal(Number.isFinite(mrr), true, "mrr should be finite");
  assert.equal(Number.isFinite(arr), true, "arr should be finite");
  assert.equal(mrr >= 0, true, "mrr should be non-negative");
  assert.equal(arr >= 0, true, "arr should be non-negative");
  assert.equal(Math.abs(arr - mrr * 12) < 0.02, true, "arr should remain mrr*12 within rounding tolerance");

  const trackedUsers = Number(payload?.result?.billing?.trackedUsers ?? 0);
  const activeUsers = Number(payload?.result?.billing?.statuses?.active ?? 0);
  const trialingUsers = Number(payload?.result?.billing?.statuses?.trialing ?? 0);
  assert.equal(Number.isInteger(trackedUsers), true, "tracked users should be integer");
  assert.equal(Number.isInteger(activeUsers), true, "active users should be integer");
  assert.equal(Number.isInteger(trialingUsers), true, "trialing users should be integer");
  assert.equal(trackedUsers >= 0, true, "tracked users should be non-negative");
  assert.equal(activeUsers >= 0, true, "active users should be non-negative");
  assert.equal(trialingUsers >= 0, true, "trialing users should be non-negative");
  assert.equal(activeUsers + trialingUsers <= trackedUsers, true, "active + trialing should not exceed tracked users");
});

test("backend feature-gates confirms subscriber instant delay policy", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for authenticated backend feature-gates e2e",
  );
  if (!token) return;

  const response = await fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/feature-gates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId: USER_ID }),
  });
  assert.equal(response.status, 200, "feature-gates with token should succeed");

  const payload = await readJson(response);
  assert.equal(payload?.ok, true, "feature-gates payload should mark ok=true");
  assert.equal(payload?.result?.entitled, true, "owner/subscriber user should be entitled");
  assert.equal(
    payload?.result?.policy?.delayMinutes,
    0,
    "entitled users should have zero-minute delay",
  );
});

test("backend user-info and feature-gates stay entitlement-consistent", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireOrSkip(
    t,
    BACKEND_TOKEN,
    "E2E_BACKEND_TOKEN is required for entitlement consistency e2e",
  );
  if (!token) return;

  const [userInfoRes, featureRes] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/user-info`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/feature-gates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);
  assert.equal(userInfoRes.status, 200, "user-info should succeed");
  assert.equal(featureRes.status, 200, "feature-gates should succeed");

  const userInfo = await readJson(userInfoRes);
  const feature = await readJson(featureRes);
  const entitled = userInfo?.result?.entitled === true;
  const expectedDelay = entitled ? 0 : Math.max(FREE_FEED_DELAY_MINUTES, Number(userInfo?.result?.delayMinutes ?? FREE_FEED_DELAY_MINUTES));
  assert.equal(
    Number(feature?.result?.policy?.delayMinutes),
    expectedDelay,
    "feature-gates delay should align with user-info entitlement policy",
  );
});

test("edge telegram headers reflect subscriber delay when authenticated", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated edge telegram e2e",
  );
  if (!cookie) return;

  const expectedDelay = trim(process.env.E2E_EXPECT_DELAY_MINUTES) || "0";
  const expectedTier = trim(process.env.E2E_EXPECT_TIER);

  const response = await fetchWithRetry(`${EDGE_BASE_URL}/api/telegram`, {
    method: "GET",
    headers: {
      Cookie: cookie,
    },
  });
  assert.equal(response.status, 200, "authenticated /api/telegram should succeed");

  const delayHeader = response.headers.get("X-News-Delay-Minutes");
  assert.equal(delayHeader, expectedDelay, "delay header should match expected tier delay");
  const cacheSource = response.headers.get("X-Cache-Source");
  assert.match(
    cacheSource || "",
    /^(do-worker-scraper|kv-worker-scraper)$/i,
    "telegram cache source header should be present",
  );

  if (expectedTier) {
    const tierHeader = response.headers.get("X-News-Tier");
    assert.equal(tierHeader, expectedTier, "tier header should match expected tier");
  }
});

test("edge delay-scoped feed routes keep entitlement delay policy in sync", async (t) => {
  const cookie = await requireValidSessionCookie(
    t,
    "E2E_SESSION_COOKIE is required for authenticated delay-scope feed e2e",
  );
  if (!cookie) return;

  const expectedDelay = trim(process.env.E2E_EXPECT_DELAY_MINUTES) || "0";
  const expectedTier = trim(process.env.E2E_EXPECT_TIER);
  const routes = [
    { path: "/api/intel?limit=12", shape: "array" },
    { path: "/api/briefings?limit=12", shape: "array" },
    { path: "/api/air-sea?limit=12", shape: "air-sea" },
  ];

  for (const route of routes) {
    const response = await fetchWithRetry(`${EDGE_BASE_URL}${route.path}`, {
      method: "GET",
      headers: {
        Cookie: cookie,
      },
    });
    assert.equal(response.status, 200, `${route.path} should succeed for authenticated user`);
    assert.equal(
      response.headers.get("X-News-Delay-Minutes"),
      expectedDelay,
      `${route.path} delay header should match entitlement policy`,
    );
    assert.match(
      response.headers.get("X-News-Capped") || "",
      /^[01]$/,
      `${route.path} should include cap signal header`,
    );

    if (expectedTier) {
      assert.equal(
        response.headers.get("X-News-Tier"),
        expectedTier,
        `${route.path} tier header should match expected entitlement tier`,
      );
    }

    const beforeRaw = response.headers.get("X-News-Total-Before-Gate");
    const visibleRaw = response.headers.get("X-News-Total-Visible");
    if (beforeRaw !== null && visibleRaw !== null) {
      const before = Number(beforeRaw);
      const visible = Number(visibleRaw);
      assert.equal(Number.isFinite(before), true, `${route.path} before-gate count should be numeric`);
      assert.equal(Number.isFinite(visible), true, `${route.path} visible count should be numeric`);
      assert.equal(visible <= before, true, `${route.path} visible count should not exceed before-gate count`);
    }

    const payload = await readJson(response);
    if (route.shape === "array") {
      assert.ok(Array.isArray(payload), `${route.path} payload should be an array`);
    } else {
      assert.equal(typeof payload, "object", `${route.path} payload should be an object`);
      assert.ok(Array.isArray(payload?.intelFeed), `${route.path} should include intelFeed array`);
    }
  }
});
