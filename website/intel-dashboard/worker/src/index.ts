import { IntelCacheDO } from "./intel-cache-do";

export { IntelCacheDO };

export interface Env {
  INTEL_CACHE: DurableObjectNamespace;
  BACKEND_URL: string;
  CACHE_BUST_SECRET: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
  AUTH_SECRET: string;
}

// ============================================================================
// Constants
// ============================================================================

const ORIGIN = "https://intel.pyro1121.com";
const SESSION_COOKIE = "pyrobot_session";
const STATE_COOKIE = "pyrobot_oauth_state";
const PKCE_COOKIE = "pyrobot_pkce_verifier";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const REMOVED_API_PATHS = new Set(["/api/polymarket", "/api/drops", "/api/crypto"]);
const REMOVED_PAGE_PATHS = new Set(["/polymarket", "/drops"]);

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

function setStateCookie(value: string): string {
  return `${STATE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

// ============================================================================
// HMAC Session Token (sign + verify)
// ============================================================================

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

async function signSession(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const data = JSON.stringify(payload);
  const dataB64 = toBase64Url(new TextEncoder().encode(data));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataB64),
  );
  return `${dataB64}.${toBase64Url(sig)}`;
}

async function verifySession(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const dataB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  try {
    const key = await importHmacKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(sigB64),
      new TextEncoder().encode(dataB64),
    );
    if (!valid) return null;
    const json = JSON.parse(
      new TextDecoder().decode(fromBase64Url(dataB64)),
    );
    // Check expiry
    if (json.exp && Date.now() > json.exp) return null;
    return json;
  } catch {
    return null;
  }
}

// ============================================================================
// CORS
// ============================================================================

function corsHeaders(origin?: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin || ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
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

function isCacheBustAuthorized(request: Request, env: Env): boolean {
  const configuredSecret = env.CACHE_BUST_SECRET?.trim();
  if (!configuredSecret) return false;

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  const headerSecret = request.headers.get("x-admin-secret")?.trim();

  return querySecret === configuredSecret || headerSecret === configuredSecret;
}

// ============================================================================
// Auth Route Handlers
// ============================================================================

function handleLogin(env: Env): Response {
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: `${ORIGIN}/auth/callback`,
    scope: "read:user",
    state,
  });
  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://github.com/login/oauth/authorize?${params}`,
      "Set-Cookie": setStateCookie(state),
    },
  });
}

async function handleCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // Verify state to prevent CSRF
  const cookies = parseCookies(request.headers.get("Cookie"));
  if (!state || state !== cookies[STATE_COOKIE]) {
    return new Response("Invalid OAuth state — possible CSRF. Try again.", {
      status: 403,
    });
  }

  if (!code) {
    return new Response("Missing authorization code.", { status: 400 });
  }

  // Exchange code for access token
  const tokenRes = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${ORIGIN}/auth/callback`,
      }),
    },
  );

  const tokenData = (await tokenRes.json()) as Record<string, string>;
  if (tokenData.error || !tokenData.access_token) {
    return new Response(
      `OAuth error: ${tokenData.error_description || tokenData.error}`,
      { status: 403 },
    );
  }

  // Get user info from GitHub
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "PyRoBOT-Intel",
      Accept: "application/vnd.github+json",
    },
  });

  const user = (await userRes.json()) as Record<string, unknown>;
  if (!user.login) {
    return new Response("Failed to retrieve GitHub user info.", {
      status: 500,
    });
  }

  // Create signed session (30 day expiry)
  const session = {
    login: user.login,
    name: (user.name as string) || user.login,
    avatar_url: user.avatar_url,
    id: user.id,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };

  const token = await signSession(session, env.AUTH_SECRET);

  // Clear state cookie, set session cookie, redirect home
  return new Response(null, {
    status: 302,
    headers: new Headers([
      ["Location", "/"],
      ["Set-Cookie", setSessionCookie(token, SESSION_MAX_AGE)],
      ["Set-Cookie", setStateCookie("deleted; Max-Age=0")],
    ]),
  });
}

function handleLogout(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": setSessionCookie("deleted", 0),
    },
  });
}

// ============================================================================
// X (Twitter) OAuth 2.0 with PKCE
// ============================================================================

function setPkceCookie(value: string): string {
  return `${PKCE_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

function clearCookie(name: string): string {
  return `${name}=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

async function exchangeXToken(
  env: Env,
  code: string,
  verifier: string,
): Promise<Record<string, string>> {
  const tokenBody = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: `${ORIGIN}/auth/x/callback`,
    code_verifier: verifier,
    client_id: env.X_CLIENT_ID,
  });

  const confidentialAuth = btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`);
  const confidentialRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${confidentialAuth}`,
    },
    body: tokenBody,
  });
  const confidentialData =
    (await confidentialRes.json()) as Record<string, string>;
  if (confidentialData.access_token && !confidentialData.error) {
    return confidentialData;
  }

  const publicRes = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: tokenBody,
  });
  const publicData = (await publicRes.json()) as Record<string, string>;
  if (publicData.access_token && !publicData.error) {
    return publicData;
  }

  return publicData.error ? publicData : confidentialData;
}

async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = toBase64Url(array);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  const challenge = toBase64Url(digest);
  return { verifier, challenge };
}

async function handleXLogin(env: Env): Promise<Response> {
  const state = crypto.randomUUID();
  const { verifier, challenge } = await generatePkce();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.X_CLIENT_ID,
    redirect_uri: `${ORIGIN}/auth/x/callback`,
    scope: "tweet.read users.read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ["Location", `https://x.com/i/oauth2/authorize?${params}`],
      ["Set-Cookie", setStateCookie(state)],
      ["Set-Cookie", setPkceCookie(verifier)],
    ]),
  });
}

async function handleXCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  const cookies = parseCookies(request.headers.get("Cookie"));
  if (!state || state !== cookies[STATE_COOKIE]) {
    return new Response("Invalid OAuth state — possible CSRF. Try again.", {
      status: 403,
    });
  }

  const verifier = cookies[PKCE_COOKIE];
  if (!verifier) {
    return new Response("Missing PKCE verifier. Try again.", { status: 400 });
  }

  if (oauthError) {
    return new Response(
      `X OAuth authorization denied: ${oauthErrorDescription || oauthError}`,
      { status: 403 },
    );
  }

  if (!code) {
    return new Response("Missing authorization code.", { status: 400 });
  }

  const tokenData = await exchangeXToken(env, code, verifier);
  if (tokenData.error || !tokenData.access_token) {
    return new Response(
      `X OAuth error: ${tokenData.error_description || tokenData.error}`,
      { status: 403 },
    );
  }

  const userRes = await fetch(
    "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username",
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "PyRoBOT-Intel",
      },
    },
  );

  const userData = (await userRes.json()) as { data?: Record<string, string> };
  if (!userData.data?.username) {
    return new Response("Failed to retrieve X user info.", { status: 500 });
  }

  const xUser = userData.data;
  const session = {
    login: xUser.username,
    name: xUser.name || xUser.username,
    avatar_url: xUser.profile_image_url || "",
    id: xUser.id,
    provider: "x",
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };

  const token = await signSession(session, env.AUTH_SECRET);

  return new Response(null, {
    status: 302,
    headers: new Headers([
      ["Location", "/"],
      ["Set-Cookie", setSessionCookie(token, SESSION_MAX_AGE)],
      ["Set-Cookie", clearCookie(STATE_COOKIE)],
      ["Set-Cookie", clearCookie(PKCE_COOKIE)],
    ]),
  });
}

// ============================================================================
// Main Worker
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = request.headers.get("Origin");

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          ...corsHeaders(origin),
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ----------------------------------------------------------------
    // Auth routes (no session required)
    // ----------------------------------------------------------------
    if (path === "/auth/login") return handleLogin(env);
    if (path === "/auth/callback") return handleCallback(request, env);
    if (path === "/auth/x/login") return handleXLogin(env);
    if (path === "/auth/x/callback") return handleXCallback(request, env);
    if (path === "/auth/logout") return handleLogout();

    if (REMOVED_PAGE_PATHS.has(path)) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${ORIGIN}/`,
        },
      });
    }

    if (REMOVED_API_PATHS.has(path)) {
      return new Response(
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
      );
    }

    // ----------------------------------------------------------------
    // Session verification for all /api/* routes
    // ----------------------------------------------------------------
    const cookies = parseCookies(request.headers.get("Cookie"));
    const sessionToken = cookies[SESSION_COOKIE];
    const user = sessionToken
      ? await verifySession(sessionToken, env.AUTH_SECRET)
      : null;

    // /api/auth/me — probe endpoint for SPA auth gate
    if (path === "/api/auth/me") {
      if (!user) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            },
          },
        );
      }
      return new Response(
        JSON.stringify({
          authenticated: true,
          user: {
            login: user.login,
            name: user.name,
            avatar_url: user.avatar_url,
            id: user.id,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders(origin),
          },
        },
      );
    }

    // Cache bust — bypass auth, protected by secret param
    if (path === "/api/cache-bust") {
      if (!isCacheBustAuthorized(request, env)) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders(origin),
            },
          },
        );
      }

      const id = env.INTEL_CACHE.idFromName("main");
      const stub = env.INTEL_CACHE.get(id);
      const doRes = await stub.fetch(new Request("https://do/api/cache-bust"));
      return new Response(doRes.body, {
        status: doRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (path.startsWith("/api/") && !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", login_url: "/auth/login" }),
        {
          status: 401,
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

    // ----------------------------------------------------------------
    // Existing API routes (now auth-protected)
    // ----------------------------------------------------------------

    // /api/status — health dashboard for both DOs
    if (path === "/api/status") {
      const cacheId = env.INTEL_CACHE.idFromName("main");
      const cacheStub = env.INTEL_CACHE.get(cacheId);
      const cacheRes = await cacheStub.fetch(
        new Request("https://do/api/health"),
      );
      const cacheStatus = await cacheRes.json();

      return new Response(
        JSON.stringify(
          { intelCache: cacheStatus },
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

    if (
      path === "/api/intel" ||
      path === "/api/briefings" ||
      path === "/api/whales" ||
      path === "/api/telegram" ||
      path === "/api/air-sea" ||
      path === "/api/chat-history"
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

      const response = new Response(doRes.body, {
        status: doRes.status,
        headers: doRes.headers,
      });

      // Merge CORS headers
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

    const pagesUrl = new URL(request.url);
    pagesUrl.hostname = "pyrobot-intel.pages.dev";
    pagesUrl.protocol = "https:";
    const pagesHeaders = new Headers(request.headers);
    pagesHeaders.set("Host", "pyrobot-intel.pages.dev");
    const pagesRes = await fetch(pagesUrl.toString(), {
      method: request.method,
      headers: pagesHeaders,
    });
    const response = new Response(pagesRes.body, {
      status: pagesRes.status,
      headers: pagesRes.headers,
    });

    const contentType = response.headers.get("Content-Type") || "";
    const isHtml = contentType.includes("text/html");
    if (isHtml) {
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      response.headers.set("CDN-Cache-Control", "no-store");
      response.headers.set("Vary", mergeVary(response.headers.get("Vary"), ["Accept-Encoding"]));
    }

    return response;
  },

  // Cron trigger: ensure both DOs are alive and running
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    // Wake IntelCacheDO — ensures alarm is set
    const cacheId = env.INTEL_CACHE.idFromName("main");
    const cacheStub = env.INTEL_CACHE.get(cacheId);
    ctx.waitUntil(
      cacheStub.fetch(new Request("https://do/api/health")),
    );

  },
};
