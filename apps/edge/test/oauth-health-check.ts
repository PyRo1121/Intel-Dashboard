import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

const BASE_URL = normalizeBaseUrl(process.env.OAUTH_HEALTH_BASE_URL ?? SITE_ORIGIN);

type RedirectCheck = {
  path: string;
  expectedHost: string;
  expectedPath: string;
  requiredParams: string[];
  requiredCookieAlternatives: string[][];
  expectedStatus?: number;
  allowedGatePaths?: string[];
};

type HtmlPageCheck = {
  path: string;
  requiredText: string[];
};

function normalizeBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("OAUTH_HEALTH_BASE_URL cannot be empty");
  }
  return normalized;
}

function requireCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function getSetCookieValues(headers: Headers): string[] {
  const maybeGetSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof maybeGetSetCookie === "function") {
    return maybeGetSetCookie.call(headers);
  }
  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

function cookiesContain(setCookies: string[], cookieName: string): boolean {
  return setCookies.some((cookie) => cookie.startsWith(`${cookieName}=`));
}

function isCloudflareChallengeResponse(response: Response, body: string): boolean {
  return (
    response.status === 403 &&
    (response.headers.get("cf-mitigated") || "").toLowerCase() === "challenge" &&
    /just a moment/i.test(body)
  );
}

async function checkRedirect(config: RedirectCheck): Promise<string> {
  const firstResponse = await fetch(`${BASE_URL}${config.path}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "user-agent": "Intel Dashboard-OAuth-Health/1.0",
    },
  });

  if (firstResponse.status === 403) {
    const challengeBody = await firstResponse.text();
    if (isCloudflareChallengeResponse(firstResponse, challengeBody)) {
      return `${config.path} -> Cloudflare challenge`;
    }
  }

  const expectedStatus = config.expectedStatus ?? 302;
  requireCondition(firstResponse.status === expectedStatus, `${config.path} expected ${expectedStatus}, got ${firstResponse.status}`);

  const locationHeader = firstResponse.headers.get("location");
  requireCondition(Boolean(locationHeader), `${config.path} missing location header`);

  let location = new URL(locationHeader!, BASE_URL);
  const allowedGatePaths = config.allowedGatePaths ?? [];
  if (location.host === new URL(BASE_URL).host && allowedGatePaths.includes(location.pathname)) {
    return `${config.path} -> security gate ${location.pathname}`;
  }

  let response = firstResponse;
  const allSetCookies = [...getSetCookieValues(firstResponse.headers)];

  const base = new URL(BASE_URL);
  const isInternalOAuthHop = location.host === base.host && location.pathname.startsWith("/oauth/");
  if (isInternalOAuthHop) {
    response = await fetch(location.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "Intel Dashboard-OAuth-Health/1.0",
      },
    });
    if (response.status === 403) {
      const challengeBody = await response.text();
      if (isCloudflareChallengeResponse(response, challengeBody)) {
        return `${config.path} -> Cloudflare challenge`;
      }
    }
    requireCondition(response.status === expectedStatus, `${config.path} second hop expected ${expectedStatus}, got ${response.status}`);
    const secondLocationHeader = response.headers.get("location");
    requireCondition(Boolean(secondLocationHeader), `${config.path} second hop missing location header`);
    location = new URL(secondLocationHeader!, BASE_URL);
    if (location.host === base.host && allowedGatePaths.includes(location.pathname)) {
      return `${config.path} -> security gate ${location.pathname}`;
    }
    allSetCookies.push(...getSetCookieValues(response.headers));
  }

  requireCondition(location.host === config.expectedHost, `${config.path} expected host ${config.expectedHost}, got ${location.host}`);
  requireCondition(location.pathname === config.expectedPath, `${config.path} expected path ${config.expectedPath}, got ${location.pathname}`);

  for (const key of config.requiredParams) {
    const value = location.searchParams.get(key);
    requireCondition(Boolean(value), `${config.path} missing query parameter: ${key}`);
  }

  for (const alternatives of config.requiredCookieAlternatives) {
    requireCondition(
      alternatives.some((cookie) => cookiesContain(allSetCookies, cookie)),
      `${config.path} missing required set-cookie alternatives: ${alternatives.join(" or ")}`,
    );
  }

  return `${config.path} -> ${location.origin}${location.pathname}`;
}

async function checkCallback(path: string): Promise<string> {
  const firstResponse = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "user-agent": "Intel Dashboard-OAuth-Health/1.0",
    },
  });

  requireCondition(firstResponse.status === 302, `${path} expected 302, got ${firstResponse.status}`);
  const locationHeader = firstResponse.headers.get("location");
  requireCondition(Boolean(locationHeader), `${path} missing location header`);
  const location = new URL(locationHeader!, BASE_URL);
  const base = new URL(BASE_URL);
  requireCondition(location.host === base.host, `${path} redirected to unexpected host: ${location.host}`);
  requireCondition(location.pathname === "/auth/error", `${path} expected /auth/error redirect, got ${location.pathname}`);
  return `${path} -> 302 -> /auth/error`;
}

async function checkHtmlPage(config: HtmlPageCheck): Promise<string> {
  const response = await fetch(`${BASE_URL}${config.path}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "user-agent": "Intel Dashboard-OAuth-Health/1.0",
    },
  });
  if (response.status === 403) {
    const challengeBody = await response.text();
    if (isCloudflareChallengeResponse(response, challengeBody)) {
      return `${config.path} -> Cloudflare challenge`;
    }
  }
  requireCondition(response.status === 200, `${config.path} expected 200, got ${response.status}`);
  const body = await response.text();
  for (const snippet of config.requiredText) {
    requireCondition(body.includes(snippet), `${config.path} missing text snippet: ${snippet}`);
  }
  return `${config.path} -> 200`;
}

async function main(): Promise<void> {
  const results: string[] = [];

  results.push(
    await checkRedirect({
      path: "/auth/login",
      expectedHost: "github.com",
      expectedPath: "/login/oauth/authorize",
      requiredParams: ["client_id", "redirect_uri", "scope", "state"],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-gh-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/login"],
    }),
  );

  results.push(
    await checkRedirect({
      path: "/auth/signup",
      expectedHost: "github.com",
      expectedPath: "/login/oauth/authorize",
      requiredParams: ["client_id", "redirect_uri", "scope", "state"],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-gh-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/signup"],
    }),
  );

  results.push(
    await checkRedirect({
      path: "/oauth/signup",
      expectedHost: "github.com",
      expectedPath: "/login/oauth/authorize",
      requiredParams: ["client_id", "redirect_uri", "scope", "state"],
      requiredCookieAlternatives: [["__Secure-better-auth.state", "__Host-intel-gh-state", "pyrobot_oauth_state"]],
      allowedGatePaths: ["/signup"],
    }),
  );

  results.push(
    await checkRedirect({
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
  );

  results.push(await checkCallback("/auth/callback/github"));
  results.push(await checkCallback("/auth/callback/twitter"));
  results.push(await checkCallback("/auth/x/callback"));
  results.push(await checkHtmlPage({ path: "/login", requiredText: ["Sign in to Intel Dashboard"] }));
  results.push(await checkHtmlPage({ path: "/signup", requiredText: ["Create your Intel Dashboard account"] }));

  process.stdout.write(`OAuth health check passed for ${BASE_URL}\n`);
  for (const line of results) {
    process.stdout.write(`- ${line}\n`);
  }
}

void main().catch((error) => {
  process.stderr.write(`OAuth health check failed: ${String(error)}\n`);
  process.exitCode = 1;
});
