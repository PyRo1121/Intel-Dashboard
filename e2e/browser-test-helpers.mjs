import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

export function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const EDGE_BASE_URL = (trim(process.env.E2E_EDGE_BASE_URL) || SITE_ORIGIN).replace(/\/+$/, "");
export const EDGE_HOSTNAME = new URL(EDGE_BASE_URL).hostname;
export const SESSION_COOKIE = trim(process.env.E2E_SESSION_COOKIE);
export const REQUIRE_AUTH = process.env.E2E_REQUIRE_AUTH === "1";
export const STRICT = process.env.E2E_STRICT === "1";
export const ACCESS_CLIENT_ID = trim(process.env.E2E_CF_ACCESS_CLIENT_ID);
export const ACCESS_CLIENT_SECRET = trim(process.env.E2E_CF_ACCESS_CLIENT_SECRET);
export const SKIP_SESSION_PREFLIGHT = process.env.E2E_SKIP_SESSION_PREFLIGHT === "1";
export const ARTIFACT_DIR = join(process.cwd(), "output", "e2e-browser");
export const sessionValidationCache = new Map();

export function isIgnorableConsoleError(text) {
  return (
    /^%c%d font-size:0;color:transparent NaN$/.test(text) ||
    /Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback\./i.test(text)
  );
}

export function parseCookieHeader(header) {
  const trimmed = trim(header);
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  return {
    name: trimmed.slice(0, eq),
    value: trimmed.slice(eq + 1),
  };
}

export function requireOrSkip(t, value, message) {
  if (trim(value)) return trim(value);
  if (REQUIRE_AUTH) assert.fail(message);
  if (STRICT) t.diagnostic(message);
  t.skip(message);
  return "";
}

export function sanitizeArtifactName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "browser-test";
}

export async function captureBrowserArtifacts(page, testName, error) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const slug = sanitizeArtifactName(testName);
  const screenshotPath = join(ARTIFACT_DIR, `${slug}.png`);
  const htmlPath = join(ARTIFACT_DIR, `${slug}.html`);
  const metaPath = join(ARTIFACT_DIR, `${slug}.txt`);

  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  const html = await page.content().catch(() => "");
  await writeFile(htmlPath, html, "utf8").catch(() => {});
  await writeFile(
    metaPath,
    [
      `url: ${page.url()}`,
      `error: ${error instanceof Error ? error.stack || error.message : String(error)}`,
    ].join("\n\n"),
    "utf8",
  ).catch(() => {});
}

export async function validateSessionCookie(t, cookieHeader, missingMessage) {
  const cookie = requireOrSkip(t, cookieHeader, missingMessage);
  if (!cookie) return "";

  if (SKIP_SESSION_PREFLIGHT) {
    return cookie;
  }

  if (!sessionValidationCache.has(cookie)) {
    sessionValidationCache.set(cookie, (async () => {
      const headers = { Cookie: cookie };
      if (ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET) {
        headers["CF-Access-Client-Id"] = ACCESS_CLIENT_ID;
        headers["CF-Access-Client-Secret"] = ACCESS_CLIENT_SECRET;
      }
      const response = await fetch(`${EDGE_BASE_URL}/api/auth/me`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status !== 200) {
        return { ok: false, status: response.status };
      }
      const payload = await response.json().catch(() => null);
      return { ok: payload?.authenticated === true, status: response.status };
    })());
  }

  const validation = await sessionValidationCache.get(cookie);
  if (!validation.ok) {
    const detail = `${missingMessage.replace("is required", "is present")} but invalid or expired (auth/me returned ${validation.status}). Refresh it with bun run e2e:save-secrets after logging in again.`;
    if (REQUIRE_AUTH || STRICT) assert.fail(detail);
    t.skip(detail);
    return "";
  }

  return cookie;
}

export async function createBrowserContextWithCookie(t, cookieHeaderValue, missingMessage, options = {}) {
  const cookieHeader = await validateSessionCookie(t, cookieHeaderValue, missingMessage);
  if (!cookieHeader) return null;
  const parsedCookie = parseCookieHeader(cookieHeader);
  assert.ok(parsedCookie, "auth e2e session cookie must be a name=value cookie header");

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    t.skip(`Chromium is unavailable for browser e2e: ${message}`);
    return null;
  }

  const extraHTTPHeaders =
    ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET
      ? {
          "CF-Access-Client-Id": ACCESS_CLIENT_ID,
          "CF-Access-Client-Secret": ACCESS_CLIENT_SECRET,
        }
      : undefined;

  const context = await browser.newContext({ acceptDownloads: true, extraHTTPHeaders, ...options });
  await context.addCookies([
    {
      name: parsedCookie.name,
      value: parsedCookie.value,
      domain: EDGE_HOSTNAME,
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return { browser, context };
}

export async function createBrowserContext(t, options = {}) {
  return createBrowserContextWithCookie(
    t,
    SESSION_COOKIE,
    "E2E_SESSION_COOKIE is required for browser-authenticated dashboard smoke e2e",
    options,
  );
}

export async function createPublicBrowserContext(t, options = {}) {
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    t.skip(`Chromium is unavailable for browser e2e: ${message}`);
    return null;
  }

  const context = await browser.newContext({ acceptDownloads: true, ...options });
  return { browser, context };
}

export async function waitForProtectedLoginOverlay(page, { nextPath } = {}) {
  const githubLink = page.getByRole("link", { name: "Continue with GitHub" }).first();
  const xLink = page.getByRole("link", { name: "Continue with X" }).first();

  await githubLink.waitFor({ state: "visible", timeout: 30_000 });
  await xLink.waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("text=Continue your intelligence workflow with secure OAuth authentication.").first().waitFor({
    state: "visible",
    timeout: 30_000,
  });

  if (nextPath) {
    assert.equal(await githubLink.getAttribute("href"), `/auth/login?next=${encodeURIComponent(nextPath)}`);
    assert.equal(await xLink.getAttribute("href"), `/auth/x/login?next=${encodeURIComponent(nextPath)}`);
  }
}

export function collectBrowserDiagnostics(page, baseUrl) {
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const baseOrigin = new URL(baseUrl).origin;

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!isIgnorableConsoleError(text)) {
        consoleErrors.push(text);
      }
    }
  });

  page.on("requestfailed", (request) => {
    try {
      const requestUrl = new URL(request.url());
      const errorText = request.failure()?.errorText || "request_failed";
      if (requestUrl.origin === baseOrigin) {
        if (/ERR_ABORTED/i.test(errorText)) return;
        requestFailures.push(`${request.method()} ${request.url()} ${errorText}`);
      }
    } catch {
      // ignore malformed request urls
    }
  });

  return { pageErrors, consoleErrors, requestFailures };
}
