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
export const CRM_AI_WINDOWS = ["15m", "1h", "24h", "7d", "30d"];
export const MISSING_BILLING_STATE_PATTERN = /Billing account not found for target user\.|Target user has no Stripe customer id yet\./i;
export const OWNER_BILLING_TRIAL_NOTICE_PATTERN = /Owner account detected. Trial activation is not required./i;
export const OWNER_BILLING_CHECKOUT_NOTICE_PATTERN = /Owner account detected. Checkout bypass is active./i;
export const OWNER_BILLING_PORTAL_NOTICE_PATTERN = /Owner account detected. Stripe portal is not required./i;

export function buildCloudflareAccessHeaders(clientId = ACCESS_CLIENT_ID, clientSecret = ACCESS_CLIENT_SECRET) {
  if (!trim(clientId) || !trim(clientSecret)) return undefined;
  return {
    "CF-Access-Client-Id": trim(clientId),
    "CF-Access-Client-Secret": trim(clientSecret),
  };
}

export function isIgnorableConsoleError(text) {
  return (
    /^%c%d font-size:0;color:transparent NaN$/.test(text) ||
    /Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback\./i.test(text) ||
    /Request header field cf-access-client-id is not allowed by Access-Control-Allow-Headers in preflight response\./i.test(text) ||
    /^Failed to load resource: net::ERR_FAILED$/i.test(text)
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

  const extraHTTPHeaders = buildCloudflareAccessHeaders();

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

  const context = await browser.newContext({
    acceptDownloads: true,
    extraHTTPHeaders: buildCloudflareAccessHeaders(),
    ...options,
  });
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

export async function assertPublicAuthEntrySurface(page, options) {
  const {
    mode,
    nextPath,
  } = options;

  const encodedNext = encodeURIComponent(nextPath);

  if (mode === "login") {
    await page.waitForSelector('[data-testid="auth-access-login"]', { timeout: 30_000 });
    const body = (await page.textContent('[data-testid="auth-access-login"]')) || "";
    assert.match(body, /Continue with X/i);
    assert.match(body, /Continue with GitHub/i);
    assert.equal(await page.getAttribute('[data-testid="auth-access-login-x"]', "href"), `/auth/x/login?next=${encodedNext}`);
    assert.equal(await page.getAttribute('[data-testid="auth-access-login-github"]', "href"), `/auth/login?next=${encodedNext}`);
    assert.equal(await page.getAttribute('[data-testid="auth-access-login-switch"]', "href"), `/signup?next=${encodedNext}`);
    return;
  }

  if (mode === "signup") {
    await page.waitForSelector('[data-testid="auth-access-signup"]', { timeout: 30_000 });
    const body = (await page.textContent('[data-testid="auth-access-signup"]')) || "";
    assert.match(body, /Create Account with X/i);
    assert.match(body, /Create Account with GitHub/i);
    assert.equal(await page.getAttribute('[data-testid="auth-access-signup-x"]', "href"), `/auth/x/signup?next=${encodedNext}`);
    assert.equal(await page.getAttribute('[data-testid="auth-access-signup-github"]', "href"), `/auth/signup?next=${encodedNext}`);
    assert.equal(await page.getAttribute('[data-testid="auth-access-signup-switch"]', "href"), `/login?next=${encodedNext}`);
    return;
  }

  throw new Error(`Unsupported auth entry mode: ${mode}`);
}

export async function openAndAssertPublicAuthEntry(page, options) {
  const {
    mode,
    nextPath,
  } = options;

  const route = mode === "login" ? "/login" : mode === "signup" ? "/signup" : null;
  if (!route) {
    throw new Error(`Unsupported auth entry mode: ${mode}`);
  }

  await openPublicPage(page, `${route}?next=${encodeURIComponent(nextPath)}`);
  await assertPublicAuthEntrySurface(page, { mode, nextPath });
}

export async function assertPageTitle(page, expectedTitle) {
  await page.waitForTimeout(500);
  assert.equal(await page.title(), expectedTitle);
}

export function assertResponseStatus(response, expectedStatus) {
  assert.ok(response);
  assert.equal(response.status(), expectedStatus);
}

export async function assertNotFoundPage(page) {
  assert.match((await page.textContent("body")) || "", /404|not found/i);
}

export async function waitForCrmDashboard(page) {
  await page.getByTestId("crm-customer-360").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("crm-summary-grid").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("crm-summary-mrr").waitFor({ state: "visible", timeout: 30_000 });

  const crmSearch = page.getByTestId("crm-user-search");
  await crmSearch.waitFor({ state: "visible", timeout: 30_000 });
  return crmSearch;
}

export async function openPage(page, path, options = {}) {
  const {
    waitUntil = "networkidle",
    timeout = 45_000,
  } = options;

  await page.goto(`${EDGE_BASE_URL}${path}`, {
    waitUntil,
    timeout,
  });
}

export async function openDashboardPage(page, path) {
  await openPage(page, path, {
    waitUntil: "networkidle",
    timeout: 45_000,
  });
}

export async function openPublicPage(page, path) {
  await openPage(page, path, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
}

export async function activateByKeyboard(control) {
  await control.focus();
  await control.press("Enter");
}

export async function navigateByKeyboard(control, page, urlMatcher) {
  await activateByKeyboard(control);
  await page.waitForURL(urlMatcher, { timeout: 30_000 });
}

export async function openCrmDashboard(page) {
  await openDashboardPage(page, "/crm");
  return waitForCrmDashboard(page);
}

export async function waitForBillingDashboard(page) {
  await page.getByTestId("billing-status-surface").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("billing-summary-grid").waitFor({ state: "visible", timeout: 30_000 });
  await page.getByTestId("billing-summary-plan").waitFor({ state: "visible", timeout: 30_000 });

  const billingNotice = page.getByTestId("billing-notice");
  await billingNotice.waitFor({ state: "attached", timeout: 30_000 });
  return billingNotice;
}

export async function openBillingDashboard(page) {
  await openDashboardPage(page, "/billing");
  return waitForBillingDashboard(page);
}

export async function assertOwnerBillingBypassNotices(page, billingNotice) {
  await page.getByTestId("billing-start-trial").click();
  await billingNotice.waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await billingNotice.textContent()) || "", OWNER_BILLING_TRIAL_NOTICE_PATTERN);

  await page.getByTestId("billing-open-checkout").click();
  await billingNotice.waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await billingNotice.textContent()) || "", OWNER_BILLING_CHECKOUT_NOTICE_PATTERN);

  await page.getByTestId("billing-manage-subscription").click();
  await billingNotice.waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await billingNotice.textContent()) || "", OWNER_BILLING_PORTAL_NOTICE_PATTERN);
}

export async function waitForCrmAiSurface(page) {
  await page.getByTestId("crm-ai-surface").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(() => {
    const configured = document.querySelector('[data-testid="crm-ai-surface-configured"]');
    const unavailable = document.querySelector('[data-testid="crm-ai-surface-unavailable"]');
    const loading = document.querySelector('[data-testid="crm-ai-surface-loading"]');
    return Boolean(configured || unavailable || !loading);
  }, { timeout: 30_000 });

  const configuredCount = await page.getByTestId("crm-ai-surface-configured").count();
  const unavailableCount = await page.getByTestId("crm-ai-surface-unavailable").count();
  return {
    configuredCount,
    unavailableCount,
  };
}

export async function waitForMissingBillingState(page) {
  await page.waitForFunction((patternSource) => {
    const text = document.body.textContent || "";
    return new RegExp(patternSource, "i").test(text);
  }, MISSING_BILLING_STATE_PATTERN.source, { timeout: 30_000 });
}

export async function openCrmSelectedUserPanel(trigger, page) {
  await trigger.click();
  const selectedPanel = page.getByTestId("crm-selected-user-panel");
  await selectedPanel.waitFor({ state: "visible", timeout: 30_000 });
  return selectedPanel;
}

export async function openOwnerCrmPanelByKeyboard(page, crmSearch) {
  await crmSearch.focus();
  await page.keyboard.type("PyRo1121");

  const ownerRow = page.locator("tbody tr").filter({ hasText: /olen@latham\.cloud/i }).first();
  await ownerRow.waitFor({ state: "visible", timeout: 30_000 });

  const manageOwner = ownerRow.getByRole("button", { name: "Manage PyRo1121" });
  await activateByKeyboard(manageOwner);

  const selectedPanel = page.getByTestId("crm-selected-user-panel");
  await selectedPanel.waitFor({ state: "visible", timeout: 30_000 });

  const refreshCustomer = page.getByTestId("crm-refresh-customer");
  await refreshCustomer.focus();
  await refreshCustomer.press("Enter");
  await waitForMissingBillingState(page);

  return selectedPanel;
}

export function collectBrowserDiagnostics(page, baseUrl, options = {}) {
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  const baseOrigin = new URL(baseUrl).origin;
  const extraIgnoredConsolePatterns = Array.isArray(options.extraIgnoredConsolePatterns)
    ? options.extraIgnoredConsolePatterns
    : [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      const ignoredByOverride = extraIgnoredConsolePatterns.some((pattern) => pattern.test(text));
      if (!ignoredByOverride && !isIgnorableConsoleError(text)) {
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

export function assertNoBrowserDiagnostics(diagnostics, messages = {}) {
  assert.deepEqual(diagnostics.pageErrors, [], messages.pageErrors);
  assert.deepEqual(diagnostics.consoleErrors, [], messages.consoleErrors);
  assert.deepEqual(diagnostics.requestFailures, [], messages.requestFailures);
}
