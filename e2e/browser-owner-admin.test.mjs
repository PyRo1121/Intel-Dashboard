import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  openDashboardPage,
  openBillingDashboard,
  openCrmDashboard,
  openOwnerCrmPanelByKeyboard,
  openCrmSelectedUserPanel,
  assertOwnerBillingBypassNotices,
  captureBrowserArtifacts,
  CRM_AI_WINDOWS,
  createBrowserContext,
  EDGE_BASE_URL,
  waitForBillingDashboard,
  waitForCrmAiSurface,
  waitForCrmDashboard,
  waitForMissingBillingState,
} from "./browser-test-helpers.mjs";

test("owner-admin billing actions surface owner bypass notices", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const notice = await openBillingDashboard(page);
      await assertOwnerBillingBypassNotices(page, notice);

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
      const search = await openCrmDashboard(page);
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

      const selectedPanel = await openCrmSelectedUserPanel(
        matchingRow.getByRole("button", { name: /Manage /i }),
        page,
      );
      assert.match((await selectedPanel.textContent()) || "", /PyRo1121/i);

      const refundAmount = page.locator('input[placeholder="Amount USD \\(blank=full\\)"]').first();
      await refundAmount.fill("0");
      await page.getByRole("button", { name: "Refund Latest" }).click();
      await page.getByTestId("crm-ops-error").waitFor({ state: "visible", timeout: 10_000 });
      assert.match((await page.getByTestId("crm-ops-error").textContent()) || "", /Refund amount must be a positive number\./i);

      for (const window of CRM_AI_WINDOWS) {
        const toggle = page.getByTestId(`crm-ai-window-${window}`);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-pressed"), "true");
        await page.getByTestId("crm-ai-refresh").click();
        const { configuredCount, unavailableCount } = await waitForCrmAiSurface(page);
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
      const crmSearch = await openCrmDashboard(page);
      await openOwnerCrmPanelByKeyboard(page, crmSearch);

      await openDashboardPage(page, "/osint");

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
