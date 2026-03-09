import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { captureBrowserArtifacts, createBrowserContext, EDGE_BASE_URL, waitForCrmDashboard } from "./browser-test-helpers.mjs";

test("owner-admin billing actions surface owner bypass notices", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.goto(`${EDGE_BASE_URL}/billing`, {
        waitUntil: "domcontentloaded",
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

      const search = await waitForCrmDashboard(page);
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

      const crmSearch = await waitForCrmDashboard(page);
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
