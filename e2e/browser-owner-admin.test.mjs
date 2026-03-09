import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

const EDGE_BASE_URL = (trim(process.env.E2E_EDGE_BASE_URL) || SITE_ORIGIN).replace(/\/+$/, "");
const EDGE_HOSTNAME = new URL(EDGE_BASE_URL).hostname;
const SESSION_COOKIE = trim(process.env.E2E_SESSION_COOKIE);
const ACCESS_CLIENT_ID = trim(process.env.E2E_CF_ACCESS_CLIENT_ID);
const ACCESS_CLIENT_SECRET = trim(process.env.E2E_CF_ACCESS_CLIENT_SECRET);
const REQUIRE_AUTH = process.env.E2E_REQUIRE_AUTH === "1";
const STRICT = process.env.E2E_STRICT === "1";
const ARTIFACT_DIR = join(process.cwd(), "output", "e2e-browser");
const sessionValidationCache = new Map();

function parseCookieHeader(header) {
  const trimmed = trim(header);
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  return {
    name: trimmed.slice(0, eq),
    value: trimmed.slice(eq + 1),
  };
}

function requireOrSkip(t, value, message) {
  if (trim(value)) return trim(value);
  if (REQUIRE_AUTH) assert.fail(message);
  if (STRICT) t.diagnostic(message);
  t.skip(message);
  return "";
}

function sanitizeArtifactName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "browser-test";
}

async function captureBrowserArtifacts(page, testName, error) {
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

async function validateSessionCookie(t, cookieHeader, missingMessage) {
  const cookie = requireOrSkip(t, cookieHeader, missingMessage);
  if (!cookie) return "";

  if (!sessionValidationCache.has(cookie)) {
    sessionValidationCache.set(cookie, (async () => {
      const headers = {
        Cookie: cookie,
      };
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

async function createBrowserContext(t, options = {}) {
  const cookieHeader = await validateSessionCookie(
    t,
    SESSION_COOKIE,
    "E2E_SESSION_COOKIE is required for owner/admin browser e2e",
  );
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

test("owner-admin billing actions surface owner bypass notices", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.goto(`${EDGE_BASE_URL}/billing`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      await page.getByTestId("billing-status-surface").waitFor({ state: "visible", timeout: 30_000 });
      await page.getByTestId("billing-summary-grid").waitFor({ state: "visible", timeout: 30_000 });
      await page.getByTestId("billing-summary-plan").waitFor({ state: "visible", timeout: 30_000 });
      const notice = page.getByTestId("billing-notice");

      await page.getByTestId("billing-start-trial").click();
      await notice.waitFor({ state: "visible", timeout: 30_000 });
      assert.match((await notice.textContent()) || "", /Owner account detected. Trial activation is not required./i);

      await page.getByTestId("billing-open-checkout").click();
      await notice.waitFor({ state: "visible", timeout: 30_000 });
      assert.match((await notice.textContent()) || "", /Owner account detected. Checkout bypass is active./i);

      await page.getByTestId("billing-manage-subscription").click();
      await notice.waitFor({ state: "visible", timeout: 30_000 });
      assert.match((await notice.textContent()) || "", /Owner account detected. Stripe portal is not required./i);

      await page.getByTestId("billing-activity-surface").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      await captureBrowserArtifacts(page, "owner-admin-billing-actions", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("owner-admin CRM controls filter, export, and enforce refund guardrails", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.goto(`${EDGE_BASE_URL}/crm`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      await page.getByTestId("crm-customer-360").waitFor({ state: "visible", timeout: 30_000 });
      await page.getByTestId("crm-summary-grid").waitFor({ state: "visible", timeout: 30_000 });
      await page.getByTestId("crm-summary-mrr").waitFor({ state: "visible", timeout: 30_000 });

      const search = page.getByTestId("crm-user-search");
      await search.fill("PyRo1121");

      const matchingRow = page.locator("tbody tr").filter({ hasText: /PyRo1121/i }).first();
      await matchingRow.waitFor({ state: "visible", timeout: 30_000 });

      const statusText = ((await matchingRow.locator("td").nth(3).textContent()) || "none").trim().toLowerCase();
      const statusValue = ["active", "trialing", "canceled", "expired", "none"].includes(statusText) ? statusText : "none";
      await page.getByTestId("crm-status-filter").selectOption(statusValue);
      await matchingRow.waitFor({ state: "visible", timeout: 30_000 });

      const downloadPromise = page.waitForEvent("download");
      await page.getByTestId("crm-export-csv").click();
      const download = await downloadPromise;
      assert.match(download.suggestedFilename(), /^intel-dashboard-crm-customers-\d+\.csv$/);
      const downloadPath = await download.path();
      assert.ok(downloadPath);
      const csv = await readFile(downloadPath, "utf8");
      assert.match(csv, /PyRo1121/i);

      await matchingRow.getByRole("button", { name: /Manage /i }).click();
      await page.getByTestId("crm-selected-user-panel").waitFor({ state: "visible", timeout: 30_000 });
      assert.match((await page.getByTestId("crm-selected-user-panel").textContent()) || "", /PyRo1121/i);

      const refundAmount = page.locator('input[placeholder="Amount USD \\(blank=full\\)"]').first();
      await refundAmount.fill("0");
      await page.getByRole("button", { name: "Refund Latest" }).click();
      await page.getByTestId("crm-ops-error").waitFor({ state: "visible", timeout: 10_000 });
      assert.match((await page.getByTestId("crm-ops-error").textContent()) || "", /Refund amount must be a positive number\./i);

      for (const window of ["15m", "1h", "24h", "7d", "30d"]) {
        const toggle = page.getByTestId(`crm-ai-window-${window}`);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-pressed"), "true");
        await page.getByTestId("crm-ai-refresh").click();
        await page.getByTestId("crm-ai-surface").waitFor({ state: "visible", timeout: 30_000 });
        await page.waitForFunction(() => {
          const configured = document.querySelector('[data-testid="crm-ai-surface-configured"]');
          const unavailable = document.querySelector('[data-testid="crm-ai-surface-unavailable"]');
          const loading = document.querySelector('[data-testid="crm-ai-surface-loading"]');
          return Boolean(configured || unavailable || !loading);
        }, { timeout: 30_000 });
        const configuredCount = await page.getByTestId("crm-ai-surface-configured").count();
        const unavailableCount = await page.getByTestId("crm-ai-surface-unavailable").count();
        assert.ok(configuredCount > 0 || unavailableCount > 0);
      }
    } catch (error) {
      await captureBrowserArtifacts(page, "owner-admin-crm-controls", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("owner-admin CRM keyboard navigation stays intact", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.goto(`${EDGE_BASE_URL}/crm`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      const crmSearch = page.getByTestId("crm-user-search");
      await crmSearch.focus();
      await page.keyboard.type("PyRo1121");

      const ownerRow = page.locator("tbody tr").filter({ hasText: /olen@latham\.cloud/i }).first();
      await ownerRow.waitFor({ state: "visible", timeout: 30_000 });

      const manageOwner = ownerRow.getByRole("button", { name: "Manage PyRo1121" });
      await manageOwner.focus();
      await manageOwner.press("Enter");
      await page.getByTestId("crm-selected-user-panel").waitFor({ state: "visible", timeout: 30_000 });

      const refreshCustomer = page.getByTestId("crm-refresh-customer");
      await refreshCustomer.focus();
      await refreshCustomer.press("Enter");
      await page.waitForFunction(() => {
        const text = document.body.textContent || "";
        return /Target user has no Stripe customer id yet\.|Billing account not found for target user\./i.test(text);
      }, { timeout: 30_000 });

      await page.goto(`${EDGE_BASE_URL}/osint`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      const overviewLink = page.getByRole("link", { name: "Overview" }).first();
      await overviewLink.focus();
      await overviewLink.press("Enter");
      await page.waitForURL(/\/overview$/, { timeout: 30_000 });
    } catch (error) {
      await captureBrowserArtifacts(page, "owner-admin-crm-keyboard", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
