type Env = {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  AUTH_SECRET?: string;
  BASE_URL?: string;
  LANDING_PATH?: string;
  POST_LOGIN_PATH?: string;
  BACKEND_URL?: string;
  BACKEND_USER_INFO_PATH?: string;
  INTEL_API_TOKEN?: string;
  USER_ID_SIGNING_SECRET?: string;
  SESSION_TTL_SECONDS?: string;
  X_AUTH_SCOPE?: string;
  X_OAUTH_CLIENT_TYPE?: string;
};

type SessionUser = {
  userId: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  provider: "x" | "github";
  issuedAtMs: number;
};

type CookieOptions = {
  path?: string;
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
};

const STATE_COOKIE = "__Host-intel-x-state";
const PKCE_COOKIE = "__Host-intel-x-pkce";
const GITHUB_STATE_COOKIE = "__Host-intel-gh-state";
const GITHUB_PKCE_COOKIE = "__Host-intel-gh-pkce";
const SESSION_COOKIE = "__Host-intel-session";
const LEGACY_SESSION_COOKIE = "pyrobot_session";

const DEFAULT_SCOPE = "tweet.read users.read offline.access";
const DEFAULT_GITHUB_SCOPE = "read:user user:email";
const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_LANDING_PATH = "/";
const DEFAULT_POST_LOGIN_PATH = "/osint";
const DEFAULT_BACKEND_USER_INFO_PATH = "/api/intel-dashboard/user-info";

function trimString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBaseUrl(env: Env): string {
  const raw = trimString(env.BASE_URL) ?? "https://intel.pyro1121.com";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function normalizeSessionTtlSeconds(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }
  return Math.max(300, Math.min(30 * 24 * 60 * 60, Math.floor(parsed)));
}

function buildXCallbackUrl(env: Env): string {
  return `${normalizeBaseUrl(env)}/auth/x/callback`;
}

function buildGitHubCallbackUrl(env: Env): string {
  return `${normalizeBaseUrl(env)}/auth/callback`;
}

function buildLandingUrl(env: Env): string {
  const landingPath = trimString(env.LANDING_PATH) ?? DEFAULT_LANDING_PATH;
  const normalized = landingPath.startsWith("/") ? landingPath : `/${landingPath}`;
  return `${normalizeBaseUrl(env)}${normalized}`;
}

function buildPostLoginUrl(env: Env): string {
  const postLoginPath = trimString(env.POST_LOGIN_PATH) ?? DEFAULT_POST_LOGIN_PATH;
  const normalized = postLoginPath.startsWith("/") ? postLoginPath : `/${postLoginPath}`;
  return `${normalizeBaseUrl(env)}${normalized}`;
}

function parseCookies(request: Request): Record<string, string> {
  const raw = request.headers.get("cookie");
  if (!raw) {
    return {};
  }
  const output: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const index = part.indexOf("=");
    if (index < 1) {
      continue;
    }
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    output[key] = value;
  }
  return output;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${value}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }
  return parts.join("; ");
}

function appendSetCookie(headers: Headers, cookie: string): void {
  headers.append("set-cookie", cookie);
}

function responseJson(status: number, payload: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function utf8ToBase64Url(input: string): string {
  return base64UrlFromBytes(new TextEncoder().encode(input));
}

function base64UrlToUtf8(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return base64UrlFromBytes(new Uint8Array(hash));
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlFromBytes(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

function randomToken(bytes = 24): string {
  return base64UrlFromBytes(crypto.getRandomValues(new Uint8Array(bytes)));
}

function normalizeErrorBody(parsed: unknown): string {
  if (typeof parsed === "string" && parsed.length > 0) {
    return parsed;
  }
  if (parsed && typeof parsed === "object") {
    return JSON.stringify(parsed).slice(0, 320);
  }
  return "unknown error";
}

async function fetchXUserInfo(accessToken: string): Promise<{ user: SessionUser | null; error: string | null }> {
  const endpoints = [
    { url: "https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", kind: "v2" as const },
    { url: "https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username", kind: "v2" as const },
  ];

  let lastError: string | null = null;
  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            authorization: `Bearer ${accessToken}`,
            accept: "application/json",
            "user-agent": "SentinelStream-Auth",
          },
        });
        const parsed = (await response.json().catch(() => null)) as unknown;
        if (endpoint.kind === "v2" && response.ok && parsed && typeof parsed === "object") {
          const data = (parsed as Record<string, unknown>).data;
          if (data && typeof data === "object") {
            const username = trimString((data as Record<string, unknown>).username);
            if (username) {
              const name = trimString((data as Record<string, unknown>).name) ?? username;
              const avatarUrl = trimString((data as Record<string, unknown>).profile_image_url);
              return {
                user: {
                  userId: username,
                  username,
                  name,
                  avatarUrl,
                  provider: "x",
                  issuedAtMs: Date.now(),
                },
                error: null,
              };
            }
          }
        }

        lastError = `HTTP ${response.status} ${normalizeErrorBody(parsed)}`;
        if (response.status >= 500 && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          continue;
        }
      } catch (error) {
        lastError = String(error);
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
          continue;
        }
      }
      break;
    }
  }
  return { user: null, error: lastError };
}

function parseJwtSub(accessToken: string): string | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) {
    return null;
  }
  try {
    const payload = JSON.parse(base64UrlToUtf8(parts[1]!)) as Record<string, unknown>;
    const sub = trimString(payload.sub);
    return sub ?? null;
  } catch {
    return null;
  }
}

async function buildFallbackXSession(accessToken: string): Promise<SessionUser> {
  const sub = parseJwtSub(accessToken);
  if (sub) {
    const normalized = sub.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    return {
      userId: sub,
      username: `x_${normalized || "user"}`,
      name: "X User",
      avatarUrl: null,
      provider: "x",
      issuedAtMs: Date.now(),
    };
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken),
  );
  const hash = Array.from(new Uint8Array(digest).slice(0, 8))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return {
    userId: `x-fallback-${hash}`,
    username: `x_fallback_${hash}`,
    name: "X User",
    avatarUrl: null,
    provider: "x",
    issuedAtMs: Date.now(),
  };
}

async function fetchGitHubUserInfo(accessToken: string): Promise<{ user: SessionUser | null; error: string | null }> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/vnd.github+json",
        "user-agent": "SentinelStream-Auth",
      },
    });
    const parsed = (await response.json().catch(() => null)) as unknown;
    if (!response.ok || !parsed || typeof parsed !== "object") {
      return { user: null, error: `HTTP ${response.status} ${normalizeErrorBody(parsed)}` };
    }
    const data = parsed as Record<string, unknown>;
    const username = trimString(data.login);
    if (!username) {
      return { user: null, error: "GitHub response missing login" };
    }
    const idRaw = data.id;
    const userId = typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : username;
    return {
      user: {
        userId,
        username,
        name: trimString(data.name) ?? username,
        avatarUrl: trimString(data.avatar_url),
        provider: "github",
        issuedAtMs: Date.now(),
      },
      error: null,
    };
  } catch (error) {
    return { user: null, error: String(error) };
  }
}

async function signSession(secret: string, session: SessionUser): Promise<string> {
  const payload = utf8ToBase64Url(JSON.stringify(session));
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

async function signLegacySession(secret: string, session: SessionUser, ttlSeconds: number): Promise<string> {
  const payload = utf8ToBase64Url(
    JSON.stringify({
      login: session.username,
      name: session.name,
      avatar_url: session.avatarUrl ?? "",
      id: session.userId,
      exp: Date.now() + ttlSeconds * 1000,
    }),
  );
  const signature = await hmacSha256Base64Url(secret, payload);
  return `${payload}.${signature}`;
}

async function verifySession(secret: string, token: string): Promise<SessionUser | null> {
  const index = token.indexOf(".");
  if (index < 1) {
    return null;
  }
  const payload = token.slice(0, index);
  const signature = token.slice(index + 1);
  const expected = await hmacSha256Base64Url(secret, payload);
  if (!timingSafeEqual(signature, expected)) {
    return null;
  }
  try {
    const parsed = JSON.parse(base64UrlToUtf8(payload)) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    const userId = trimString(obj.userId);
    const username = trimString(obj.username);
    const name = trimString(obj.name);
    if (!userId || !username || !name) {
      return null;
    }
    const providerRaw = trimString(obj.provider);
    const provider = providerRaw === "github" ? "github" : "x";
    return {
      userId,
      username,
      name,
      avatarUrl: trimString(obj.avatarUrl),
      provider,
      issuedAtMs: Number(obj.issuedAtMs) || Date.now(),
    };
  } catch {
    return null;
  }
}

async function handleXLogin(env: Env): Promise<Response> {
  const clientId = trimString(env.X_CLIENT_ID);
  if (!clientId) {
    return responseJson(500, {
      ok: false,
      error: { message: "Missing X auth worker configuration." },
    });
  }

  const callback = buildXCallbackUrl(env);
  const scope = trimString(env.X_AUTH_SCOPE) ?? DEFAULT_SCOPE;
  const state = randomToken(18);
  const verifier = randomToken(36);
  const challenge = await sha256Base64Url(verifier);
  const url = new URL("https://x.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers({
    location: url.toString(),
    "cache-control": "no-store",
  });
  appendSetCookie(
    headers,
    serializeCookie(STATE_COOKIE, state, {
      path: "/",
      maxAge: 10 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(PKCE_COOKIE, verifier, {
      path: "/",
      maxAge: 10 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  return new Response(null, { status: 302, headers });
}

async function handleGitHubLogin(env: Env): Promise<Response> {
  const clientId = trimString(env.GITHUB_CLIENT_ID);
  if (!clientId) {
    return responseJson(500, {
      ok: false,
      error: { message: "Missing GitHub auth worker configuration." },
    });
  }

  const callback = buildGitHubCallbackUrl(env);
  const scope = DEFAULT_GITHUB_SCOPE;
  const state = randomToken(18);
  const verifier = randomToken(36);
  const challenge = await sha256Base64Url(verifier);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const headers = new Headers({
    location: url.toString(),
    "cache-control": "no-store",
  });
  appendSetCookie(
    headers,
    serializeCookie(GITHUB_STATE_COOKIE, state, {
      path: "/",
      maxAge: 10 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(GITHUB_PKCE_COOKIE, verifier, {
      path: "/",
      maxAge: 10 * 60,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  return new Response(null, { status: 302, headers });
}

async function handleGitHubCallback(request: Request, env: Env): Promise<Response> {
  const clientId = trimString(env.GITHUB_CLIENT_ID);
  const clientSecret = trimString(env.GITHUB_CLIENT_SECRET);
  const authSecret = trimString(env.AUTH_SECRET);
  if (!clientId || !authSecret) {
    return responseJson(500, {
      ok: false,
      error: { message: "Missing GitHub auth worker configuration." },
    });
  }

  const url = new URL(request.url);
  const state = trimString(url.searchParams.get("state"));
  const code = trimString(url.searchParams.get("code"));
  const cookies = parseCookies(request);
  const storedState = trimString(cookies[GITHUB_STATE_COOKIE]);
  const pkceVerifier = trimString(cookies[GITHUB_PKCE_COOKIE]);

  const headers = new Headers({
    "cache-control": "no-store",
  });
  appendSetCookie(
    headers,
    serializeCookie(GITHUB_STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(GITHUB_PKCE_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );

  if (!state || !code || !storedState || !pkceVerifier || !timingSafeEqual(state, storedState)) {
    return new Response("Invalid OAuth state - possible CSRF. Try again.", {
      status: 403,
      headers,
    });
  }

  const requestToken = async (useClientSecret: boolean): Promise<{ response: Response; data: unknown }> => {
    const tokenBody = new URLSearchParams();
    tokenBody.set("client_id", clientId);
    tokenBody.set("code", code);
    tokenBody.set("redirect_uri", buildGitHubCallbackUrl(env));
    tokenBody.set("code_verifier", pkceVerifier);
    if (useClientSecret && clientSecret) {
      tokenBody.set("client_secret", clientSecret);
    }

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "SentinelStream-Auth",
      },
      body: tokenBody.toString(),
    });
    const data = (await response.json().catch(() => null)) as unknown;
    return { response, data };
  };

  const firstAttempt = await requestToken(Boolean(clientSecret));
  let tokenResponse = firstAttempt.response;
  let tokenData = firstAttempt.data;
  let accessToken =
    tokenData && typeof tokenData === "object" ? trimString((tokenData as Record<string, unknown>).access_token) : null;

  if ((!tokenResponse.ok || !accessToken) && clientSecret && tokenData && typeof tokenData === "object") {
    const errorCode = trimString((tokenData as Record<string, unknown>).error);
    if (errorCode === "incorrect_client_credentials") {
      const retryAttempt = await requestToken(false);
      tokenResponse = retryAttempt.response;
      tokenData = retryAttempt.data;
      accessToken =
        tokenData && typeof tokenData === "object" ? trimString((tokenData as Record<string, unknown>).access_token) : null;
    }
  }

  if (!tokenResponse.ok || !accessToken) {
    return new Response(
      `GitHub token exchange failed. HTTP ${tokenResponse.status} ${normalizeErrorBody(tokenData)}`,
      {
        status: 502,
        headers,
      },
    );
  }

  const userResult = await fetchGitHubUserInfo(accessToken);
  if (!userResult.user) {
    return new Response(
      `Failed to retrieve GitHub user info. ${userResult.error ?? "unknown"}. Please retry in 30 seconds.`,
      {
        status: 502,
        headers,
      },
    );
  }

  const ttlSeconds = normalizeSessionTtlSeconds(env.SESSION_TTL_SECONDS);
  const sessionToken = await signSession(authSecret, userResult.user);
  const legacySessionToken = await signLegacySession(authSecret, userResult.user, ttlSeconds);
  appendSetCookie(
    headers,
    serializeCookie(SESSION_COOKIE, sessionToken, {
      path: "/",
      maxAge: ttlSeconds,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(LEGACY_SESSION_COOKIE, legacySessionToken, {
      path: "/",
      maxAge: ttlSeconds,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  headers.set("location", buildPostLoginUrl(env));

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function handleXCallback(request: Request, env: Env): Promise<Response> {
  const clientId = trimString(env.X_CLIENT_ID);
  const clientSecret = trimString(env.X_CLIENT_SECRET);
  const authSecret = trimString(env.AUTH_SECRET);
  if (!clientId || !authSecret) {
    return responseJson(500, {
      ok: false,
      error: { message: "Missing X auth worker configuration." },
    });
  }

  const url = new URL(request.url);
  const state = trimString(url.searchParams.get("state"));
  const code = trimString(url.searchParams.get("code"));
  const oauthError = trimString(url.searchParams.get("error"));
  const oauthErrorDescription = trimString(url.searchParams.get("error_description"));
  const cookies = parseCookies(request);
  const storedState = trimString(cookies[STATE_COOKIE]);
  const pkceVerifier = trimString(cookies[PKCE_COOKIE]);

  const headers = new Headers({
    "cache-control": "no-store",
  });
  appendSetCookie(
    headers,
    serializeCookie(STATE_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(PKCE_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );

  if (!state || !code || !storedState || !pkceVerifier || !timingSafeEqual(state, storedState)) {
    return new Response("Invalid OAuth state - possible CSRF. Try again.", {
      status: 403,
      headers,
    });
  }

  if (oauthError) {
    return new Response(
      `X OAuth authorization denied. ${oauthErrorDescription ?? oauthError}`,
      {
        status: 403,
        headers,
      },
    );
  }

  const modeRaw = trimString(env.X_OAUTH_CLIENT_TYPE)?.toLowerCase();
  const mode = modeRaw === "public" || modeRaw === "confidential" ? modeRaw : clientSecret ? "confidential" : "public";
  if (mode === "confidential" && !clientSecret) {
    return responseJson(500, {
      ok: false,
      error: { message: "X OAuth is configured as confidential but X_CLIENT_SECRET is missing." },
    });
  }

  const tokenBody = new URLSearchParams();
  tokenBody.set("grant_type", "authorization_code");
  tokenBody.set("code", code);
  tokenBody.set("redirect_uri", buildXCallbackUrl(env));
  tokenBody.set("code_verifier", pkceVerifier);
  tokenBody.set("client_id", clientId);

  const tokenRequest = async (authorizationHeader: string | null): Promise<{ response: Response; data: unknown }> => {
    const response = await fetch("https://api.x.com/2/oauth2/token", {
      method: "POST",
      headers: {
        ...(authorizationHeader ? { Authorization: authorizationHeader } : {}),
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "SentinelStream-Auth",
      },
      body: tokenBody.toString(),
    });
    const data = (await response.json().catch(() => null)) as unknown;
    return { response, data };
  };

  const authorizationHeader = mode === "confidential" ? `Basic ${btoa(`${clientId}:${clientSecret}`)}` : null;
  const tokenAttempt = await tokenRequest(authorizationHeader);
  let tokenResponse = tokenAttempt.response;
  let tokenData = tokenAttempt.data;
  let accessToken =
    tokenData && typeof tokenData === "object" ? trimString((tokenData as Record<string, unknown>).access_token) : null;

  if ((!tokenResponse.ok || !accessToken) && mode === "confidential" && tokenData && typeof tokenData === "object") {
    const errorCode = trimString((tokenData as Record<string, unknown>).error);
    const errorDescription = trimString((tokenData as Record<string, unknown>).error_description)?.toLowerCase();
    const missingAuthHeader = errorDescription?.includes("missing valid authorization header") ?? false;
    if (errorCode === "unauthorized_client" && missingAuthHeader) {
      tokenBody.set("client_id", clientId);
      const retryAttempt = await tokenRequest(null);
      tokenResponse = retryAttempt.response;
      tokenData = retryAttempt.data;
      accessToken =
        tokenData && typeof tokenData === "object" ? trimString((tokenData as Record<string, unknown>).access_token) : null;
    }
  }

  if (!tokenResponse.ok || !accessToken) {
    return new Response(
      `X token exchange failed. HTTP ${tokenResponse.status} ${normalizeErrorBody(tokenData)}`,
      {
        status: 502,
        headers,
      },
    );
  }

  const userResult = await fetchXUserInfo(accessToken);
  const resolvedUser = userResult.user ?? (await buildFallbackXSession(accessToken));

  const ttlSeconds = normalizeSessionTtlSeconds(env.SESSION_TTL_SECONDS);
  const sessionToken = await signSession(authSecret, resolvedUser);
  const legacySessionToken = await signLegacySession(authSecret, resolvedUser, ttlSeconds);
  appendSetCookie(
    headers,
    serializeCookie(SESSION_COOKIE, sessionToken, {
      path: "/",
      maxAge: ttlSeconds,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(LEGACY_SESSION_COOKIE, legacySessionToken, {
      path: "/",
      maxAge: ttlSeconds,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  headers.set("location", buildPostLoginUrl(env));

  return new Response(null, {
    status: 302,
    headers,
  });
}

async function handleAuthMe(request: Request, env: Env): Promise<Response> {
  const secret = trimString(env.AUTH_SECRET);
  if (!secret) {
    return responseJson(500, {
      ok: false,
      error: { message: "Missing AUTH_SECRET." },
    });
  }

  const sessionToken = trimString(parseCookies(request)[SESSION_COOKIE]);
  if (!sessionToken) {
    return responseJson(401, {
      ok: false,
      error: { message: "Not authenticated." },
    });
  }

  const session = await verifySession(secret, sessionToken);
  if (!session) {
    return responseJson(401, {
      ok: false,
      error: { message: "Invalid session." },
    });
  }

  const backendUrl = trimString(env.BACKEND_URL);
  const backendPath = trimString(env.BACKEND_USER_INFO_PATH) ?? DEFAULT_BACKEND_USER_INFO_PATH;
  const apiToken = trimString(env.INTEL_API_TOKEN);
  let userInfo: unknown = null;
  let userInfoError: string | null = null;

  if (backendUrl && apiToken) {
    try {
      const endpoint = `${backendUrl}${backendPath.startsWith("/") ? backendPath : `/${backendPath}`}`;
      const userIdSigningSecret = trimString(env.USER_ID_SIGNING_SECRET);
      const userSignature = userIdSigningSecret
        ? await hmacSha256Base64Url(userIdSigningSecret, session.userId)
        : null;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userId: session.userId,
          ...(userSignature ? { userSignature } : {}),
        }),
      });
      const parsed = (await response.json().catch(() => null)) as unknown;
      if (response.ok && parsed && typeof parsed === "object") {
        userInfo = parsed;
      } else {
        userInfoError = `HTTP ${response.status}`;
      }
    } catch (error) {
      userInfoError = String(error);
    }
  }

  return responseJson(200, {
    ok: true,
    result: {
      session,
      userInfo,
      userInfoError,
    },
  });
}

function handleLogout(env: Env): Response {
  const headers = new Headers({
    location: buildLandingUrl(env),
    "cache-control": "no-store",
  });
  appendSetCookie(
    headers,
    serializeCookie(SESSION_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  appendSetCookie(
    headers,
    serializeCookie(LEGACY_SESSION_COOKIE, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    }),
  );
  return new Response(null, {
    status: 303,
    headers,
  });
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    const githubLoginPaths = new Set([
      "/auth/login",
      "/auth/signup",
      "/auth/github/login",
      "/oauth/login",
      "/oauth/signup",
      "/oauth/github/login",
    ]);
    const githubCallbackPaths = new Set([
      "/auth/callback",
      "/auth/github/callback",
      "/oauth/callback",
      "/oauth/github/callback",
    ]);
    const xLoginPaths = new Set([
      "/auth/x/login",
      "/auth/x/signup",
      "/oauth/x/login",
      "/oauth/x/signup",
    ]);
    const xCallbackPaths = new Set([
      "/auth/x/callback",
      "/oauth/x/callback",
    ]);

    if (request.method === "GET" && githubLoginPaths.has(url.pathname)) {
      return handleGitHubLogin(env);
    }
    if (request.method === "GET" && githubCallbackPaths.has(url.pathname)) {
      return handleGitHubCallback(request, env);
    }
    if (request.method === "GET" && xLoginPaths.has(url.pathname)) {
      return handleXLogin(env);
    }
    if (request.method === "GET" && xCallbackPaths.has(url.pathname)) {
      return handleXCallback(request, env);
    }
    if (request.method === "GET" && (url.pathname === "/auth/me" || url.pathname === "/oauth/me")) {
      return handleAuthMe(request, env);
    }
    if (
      (request.method === "POST" || request.method === "GET") &&
      (url.pathname === "/auth/logout" || url.pathname === "/oauth/logout")
    ) {
      return handleLogout(env);
    }

    return responseJson(404, {
      ok: false,
      error: { message: "Not Found." },
    });
  },
};

export default worker;
