import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  advanceMockClock,
  assertNoBrowserDiagnostics,
  assertRouteMetadata,
  openAndAssertPublicAuthEntry,
  createAirSeaFixture,
  createBriefingsFixture,
  createIntelFixture,
  EDGE_BASE_URL,
  captureBrowserArtifacts,
  createBrowserContext,
  createBrowserContextWithCookie,
  createPublicBrowserContext,
  installMockClock,
  parseTrailingCount,
  trim,
  waitForProtectedLoginOverlay,
  navigateByKeyboard,
  openDashboardPage,
  openBillingDashboard,
  openCrmDashboard,
  openOwnerCrmPanelByKeyboard,
  openCrmSelectedUserPanel,
  assertOwnerBillingBypassNotices,
  collectBrowserDiagnostics,
  CRM_AI_WINDOWS,
  MISSING_BILLING_STATE_PATTERN,
  waitForCrmAiSurface,
  waitForMissingBillingState,
} from "./browser-test-helpers.mjs";
import {
  AUTHENTICATED_BROWSER_NOERROR_ROUTES,
  AUTHENTICATED_BROWSER_ROUTES,
  BROWSER_METADATA_EXPECTATIONS,
  PUBLIC_AUTH_BROWSER_ROUTES,
  PUBLIC_BROWSER_ROUTES,
} from "./coverage-manifest.mjs";

const SIGNOUT_SESSION_COOKIE = trim(process.env.E2E_SIGNOUT_SESSION_COOKIE);

const SMOKE_IGNORED_CONSOLE_PATTERNS = [
  /Failed to load resource: the server responded with a status of 401 \(\)/i,
  /Failed to load resource: the server responded with a status of 404 \(\)/i,
];


test("browser-authenticated dashboard routes render primary headings without auth bounce", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const routes = AUTHENTICATED_BROWSER_ROUTES;

      for (const route of routes) {
        const response = await page.goto(`${EDGE_BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        assert.ok(response, `${route.path} should return a response`);
        assert.ok(response.status() < 400, `${route.path} should not return an HTTP error`);
        await page.waitForSelector("h1", { timeout: 30_000 });
        const bodyText = (await page.textContent("body")) || "";
        assert.ok(!/\/login\b/.test(page.url()), `${route.path} should not bounce to login`);
        assert.match(bodyText, new RegExp(route.heading, "i"), `${route.path} should render ${route.heading}`);
      }
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-dashboard-routes", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated sidebar renders owner identity and avatar", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      await page.locator('p').filter({ hasText: /^PyRo1121$/ }).first().waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('p').filter({ hasText: /^@PyRo1121$/ }).first().waitFor({ state: "visible", timeout: 30_000 });
      await page.locator('p').filter({ hasText: /^Owner$/ }).first().waitFor({ state: "visible", timeout: 30_000 });

      const avatar = page.locator('img[alt="PyRo1121"]').first();
      await avatar.waitFor({ state: "visible", timeout: 30_000 });
      const avatarSrc = await avatar.getAttribute("src");
      assert.ok(typeof avatarSrc === "string" && avatarSrc.length > 0, "sidebar avatar should expose a non-empty src");
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-sidebar-identity", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated billing actions surface owner bypass notices", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const notice = await openBillingDashboard(page);
      await assertOwnerBillingBypassNotices(page, notice);
      const activitySurface = page.getByTestId("billing-activity-surface");
      await activitySurface.waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-billing-actions", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated CRM controls filter, export, and enforce refund guardrails", async (t) => {
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
      assert.match(
        download.suggestedFilename(),
        /^intel-dashboard-crm-customers-\d+\.csv$/,
        "CRM export should use the expected filename pattern",
      );
      const downloadPath = await download.path();
      assert.ok(downloadPath, "CRM export should produce a downloadable file");
      const csv = await readFile(downloadPath, "utf8");
      assert.match(csv, /user_id,name,login,email,providers,plan_status/i, "CRM export should include the expected headers");
      assert.match(csv, /PyRo1121/i, "CRM export should include the owner record");

      const selectedPanel = await openCrmSelectedUserPanel(
        matchingRow.getByRole("button", { name: /Manage /i }),
        page,
      );
      assert.match((await selectedPanel.textContent()) || "", /PyRo1121/i, "CRM selected-user panel should render the owner record");
      await waitForMissingBillingState(page);
      assert.match(
        (await page.textContent("body")) || "",
        MISSING_BILLING_STATE_PATTERN,
        "CRM should surface a safe non-destructive missing-billing state for the selected owner account",
      );

      const refundAmount = page.locator('input[placeholder="Amount USD \\(blank=full\\)"]').first();
      await refundAmount.fill("0");
      await page.getByRole("button", { name: "Refund Latest" }).click();
      await page.getByTestId("crm-ops-error").waitFor({ state: "visible", timeout: 10_000 });
      assert.match((await page.getByTestId("crm-ops-error").textContent()) || "", /Refund amount must be a positive number\./i);

      for (const window of CRM_AI_WINDOWS) {
        const toggle = page.getByTestId(`crm-ai-window-${window}`);
        await toggle.click();
        assert.equal(await toggle.getAttribute("aria-pressed"), "true", `CRM AI window ${window} should become active`);
        await page.getByTestId("crm-ai-refresh").click();
        const { configuredCount, unavailableCount } = await waitForCrmAiSurface(page);
        assert.ok(
          configuredCount > 0 || unavailableCount > 0,
          `CRM should render either the configured AI telemetry surface or an explicit unavailable-state banner for ${window}`,
        );
      }
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-crm-controls", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated Telegram controls toggle feed windows and dedupe surfaces", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/telegram");

      await page.waitForSelector("text=Telegram Intel", { timeout: 30_000 });

      const last24h = page.locator("button").filter({ hasText: /^Last 24h$/ }).first();
      await last24h.waitFor({ state: "visible", timeout: 30_000 });
      await last24h.click();
      assert.equal(await last24h.getAttribute("aria-pressed"), "true", "Last 24h filter should toggle on");

      const mediaOnly = page.locator("button").filter({ hasText: /^Media only$/ }).first();
      await mediaOnly.click();
      assert.equal(await mediaOnly.getAttribute("aria-pressed"), "true", "Media-only filter should toggle on");

      await page.waitForSelector("text=Owner Dedupe Controls", { timeout: 30_000 });
      const dedupedMode = page.locator("button").filter({ hasText: /^Deduped$/ }).first();
      const rawMode = page.locator("button").filter({ hasText: /^Raw$/ }).first();
      assert.equal(await dedupedMode.getAttribute("aria-pressed"), "true", "Deduped mode should default on for owner review");

      await rawMode.click();
      assert.equal(await rawMode.getAttribute("aria-pressed"), "true", "Raw mode should toggle on");
      await page.waitForSelector("text=Owner Dedupe Controls", { state: "hidden", timeout: 10_000 });

      await dedupedMode.click();
      assert.equal(await dedupedMode.getAttribute("aria-pressed"), "true", "Deduped mode should toggle back on");
      await page.waitForSelector("text=Owner Dedupe Controls", { timeout: 30_000 });
      await page.locator("button").filter({ hasText: /^Refresh rules$/ }).first().click();
      await page.waitForTimeout(1_500);
      assert.match((await page.textContent("body")) || "", /Rules:\s*\d+/i, "Owner dedupe badge should stay visible after refreshing rules");
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-telegram-controls", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated Telegram latest age ticker updates live", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/telegram");

      const latestAgeStat = page.locator('p').filter({ hasText: /^Latest Msg Age$/ }).first();
      await latestAgeStat.waitFor({ state: "visible", timeout: 30_000 });
      const latestAgeValue = latestAgeStat.locator("..").locator("p").first();

      const initial = ((await latestAgeValue.textContent()) || "").trim();
      await page.waitForTimeout(2200);
      const later = ((await latestAgeValue.textContent()) || "").trim();

      assert.ok(initial.length > 0, "Telegram latest age should render a value");
      assert.ok(later.length > 0, "Telegram latest age should keep rendering after time passes");
      assert.notEqual(initial, later, "Telegram latest age ticker should update without a data refetch");
    } catch (error) {
      await captureBrowserArtifacts(page, "telegram-live-age-ticker", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated billing activity ages update with wall clock drift", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await installMockClock(page);
      await openDashboardPage(page, "/billing");

      const firstAge = page.locator('[data-e2e="billing-event-age"]').first();
      await firstAge.waitFor({ state: "visible", timeout: 30_000 });

      const before = ((await firstAge.textContent()) || "").trim();
      assert.ok(before.length > 0, "Billing activity should render a relative age label");

      await advanceMockClock(page, 65 * 60_000);
      await page.waitForTimeout(1200);

      const after = ((await firstAge.textContent()) || "").trim();
      assert.notEqual(after, before, "Billing activity age should advance when wall clock advances");
    } catch (error) {
      await captureBrowserArtifacts(page, "billing-activity-age-drift", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated overview feed ages update with wall clock drift", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const fixtureTimestamp = new Date(Date.now() - 5 * 60_000).toISOString();
      await installMockClock(page);
      await page.route("**/api/intel", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(createIntelFixture({ timestamp: fixtureTimestamp })),
        });
      });
      await openDashboardPage(page, "/overview");

      const freshnessPill = page.locator('span[title^="Freshness thresholds:"]').first();
      await freshnessPill.waitFor({ state: "visible", timeout: 30_000 });
      const firstAge = page.locator('[data-e2e="overview-intel-age"]').first();
      await firstAge.waitFor({ state: "visible", timeout: 30_000 });

      const pillBefore = ((await freshnessPill.textContent()) || "").trim();
      const ageBefore = ((await firstAge.textContent()) || "").trim();
      assert.match(pillBefore, /\([^)]+\)/, "Overview freshness pill should expose compact age detail");
      assert.ok(ageBefore.length > 0, "Overview recent intelligence should render a relative age label");

      await advanceMockClock(page, 65 * 60_000);
      await page.waitForTimeout(1200);

      const pillAfter = ((await freshnessPill.textContent()) || "").trim();
      const ageAfter = ((await firstAge.textContent()) || "").trim();
      assert.notEqual(pillAfter, pillBefore, "Overview freshness pill should advance when wall clock advances");
      assert.notEqual(ageAfter, ageBefore, "Overview recent intelligence age should advance when wall clock advances");
    } catch (error) {
      await captureBrowserArtifacts(page, "overview-age-drift", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated feed item ages update with wall clock drift", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const checks = [
      {
        path: "/osint",
        selector: 'main a.surface-card[href] span.font-mono-data',
        label: "OSINT",
      },
      {
        path: "/map",
        selector: '[data-e2e="map-item-age"]',
        label: "Threat Map",
        setup: async (page) => {
          const regionCard = page.locator('button[aria-label^="Inspect "]').first();
          await regionCard.waitFor({ state: "visible", timeout: 30_000 });
          await regionCard.click();
        },
      },
      {
        path: "/air-sea",
        selector: '[data-e2e="air-sea-item-age"]',
        label: "Air/Sea",
      },
    ];

    for (const check of checks) {
      const page = await context.newPage();
      try {
        const fixtureTimestamp = new Date(Date.now() - 5 * 60_000).toISOString();
        await installMockClock(page);
        if (check.path === "/osint" || check.path === "/map") {
          await page.route("**/api/intel", async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(createIntelFixture({ timestamp: fixtureTimestamp })),
            });
          });
        }
        if (check.path === "/air-sea") {
          await page.route("**/api/air-sea", async (route) => {
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(createAirSeaFixture(fixtureTimestamp)),
            });
          });
        }
        await openDashboardPage(page, check.path);

        if (typeof check.setup === "function") {
          await check.setup(page);
        }

        const firstAge = page.locator(check.selector).first();
        await firstAge.waitFor({ state: "visible", timeout: 30_000 });

        const before = ((await firstAge.textContent()) || "").trim();
        assert.ok(before.length > 0, `${check.label} should render a relative item age`);

        await advanceMockClock(page, 65 * 60_000);
        await page.waitForTimeout(1200);

        const after = ((await firstAge.textContent()) || "").trim();
        assert.notEqual(after, before, `${check.label} item age should advance when wall clock advances`);
      } catch (error) {
        await captureBrowserArtifacts(page, `item-age-drift-${check.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated Telegram freshness banner reacts to state transitions", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await installMockClock(page);
      await page.goto(`${EDGE_BASE_URL}/telegram`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      const freshnessPill = page.locator('[title^="Freshness thresholds:"]').first();
      await freshnessPill.waitFor({ state: "visible", timeout: 30_000 });

      const tryNotice = async (deltaMs) => {
        await advanceMockClock(page, deltaMs);
        await page.waitForTimeout(1500);
        const notice = page.locator("section[role='status']").filter({ hasText: /Telegram feed/i }).first();
        if (await notice.count()) {
          const visible = await notice.isVisible().catch(() => false);
          if (visible) return notice;
        }
        return null;
      };

      let notice = await tryNotice(6 * 60 * 60 * 1000);
      if (!notice) {
        notice = await tryNotice(-12 * 60 * 60 * 1000);
      }

      assert.ok(notice, "Telegram freshness banner should appear when wall clock crosses a freshness threshold");
      assert.match(
        ((await notice.textContent()) || "").trim(),
        /Telegram feed (moved to delayed|became stale|recovered to live)/i,
        "Telegram freshness banner should explain the state transition",
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "telegram-freshness-banner", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated non-Telegram freshness banners react to state transitions", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const checks = [
      { path: "/osint", subject: /OSINT feed/i },
      { path: "/map", subject: /Threat map feed/i },
      { path: "/air-sea", subject: /Air\/Sea feed/i },
    ];

    for (const check of checks) {
      const page = await context.newPage();
      try {
        await installMockClock(page);
        await page.goto(`${EDGE_BASE_URL}${check.path}`, {
          waitUntil: "networkidle",
          timeout: 45_000,
        });

        const freshnessPill = page.locator('[title^="Freshness thresholds:"]').first();
        await freshnessPill.waitFor({ state: "visible", timeout: 30_000 });

        const tryNotice = async (deltaMs) => {
          await advanceMockClock(page, deltaMs);
          await page.waitForTimeout(1500);
          const notice = page.locator("section[role='status']").filter({ hasText: check.subject }).first();
          if (await notice.count()) {
            const visible = await notice.isVisible().catch(() => false);
            if (visible) return notice;
          }
          return null;
        };

        let notice = await tryNotice(6 * 60 * 60 * 1000);
        if (!notice) {
          notice = await tryNotice(-12 * 60 * 60 * 1000);
        }

        assert.ok(notice, `${check.path} freshness banner should appear when wall clock crosses a freshness threshold`);
        assert.match(
          ((await notice.textContent()) || "").trim(),
          /(moved to delayed|became stale|recovered to live)/i,
          `${check.path} freshness banner should explain the state transition`,
        );
      } catch (error) {
        await captureBrowserArtifacts(page, `freshness-banner-${check.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated freshness pills advance with wall clock drift on active feeds", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const routes = ["/osint", "/map", "/air-sea", "/briefings"];

    for (const route of routes) {
      const page = await context.newPage();
      try {
        const fixtureTimestamp = new Date(Date.now() - 5 * 60_000).toISOString();
        await installMockClock(page);
        if (route === "/osint" || route === "/map") {
          await page.route("**/api/intel", async (routeRequest) => {
            await routeRequest.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(createIntelFixture({ timestamp: fixtureTimestamp })),
            });
          });
        }
        if (route === "/air-sea") {
          await page.route("**/api/air-sea", async (routeRequest) => {
            await routeRequest.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(createAirSeaFixture(fixtureTimestamp)),
            });
          });
        }
        if (route === "/briefings") {
          await page.route("**/api/briefings", async (routeRequest) => {
            await routeRequest.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(createBriefingsFixture(fixtureTimestamp)),
            });
          });
        }
        await openDashboardPage(page, route);

        const freshnessPill = page.locator('span[title^="Freshness thresholds:"]').first();
        await freshnessPill.waitFor({ state: "visible", timeout: 30_000 });

        const before = ((await freshnessPill.textContent()) || "").trim();
        assert.match(before, /\([^)]+\)/, `${route} freshness pill should expose compact age detail`);

        await advanceMockClock(page, 65 * 60_000);
        await page.waitForTimeout(1200);

        const after = ((await freshnessPill.textContent()) || "").trim();
        assert.notEqual(after, before, `${route} freshness pill should update after wall clock advances`);
      } catch (error) {
        await captureBrowserArtifacts(page, `freshness-drift-${route}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated live feeds stay healthy during refresh dwell", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const checks = [
      { path: "/osint", heading: /OSINT Feed/i },
      { path: "/telegram", heading: /Telegram Intel/i },
    ];

    for (const check of checks) {
      const page = await context.newPage();
      try {
        const { pageErrors, consoleErrors, requestFailures } = collectBrowserDiagnostics(page, EDGE_BASE_URL, {
          extraIgnoredConsolePatterns: SMOKE_IGNORED_CONSOLE_PATTERNS,
        });

        await openDashboardPage(page, check.path);
        assert.match((await page.textContent("body")) || "", check.heading, `${check.path} should render the expected heading`);

        const freshnessPill = page.locator('[title^="Freshness thresholds:"]').first();
        await freshnessPill.waitFor({ state: "visible", timeout: 30_000 });
        assert.ok(
          ((await freshnessPill.textContent()) || "").trim().length > 0,
          `${check.path} freshness pill should stay visible during dwell`,
        );

        await page.waitForTimeout(12_500);
        assert.deepEqual(pageErrors, [], `${check.path} should not emit uncaught page errors during refresh dwell`);
        assert.deepEqual(consoleErrors, [], `${check.path} should not emit console errors during refresh dwell`);
        assert.deepEqual(requestFailures, [], `${check.path} should not accumulate same-origin request failures during refresh dwell`);
      } catch (error) {
        await captureBrowserArtifacts(page, `refresh-dwell-${check.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated OSINT severity filters apply the live feed contract", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      await page.waitForSelector("text=OSINT Feed", { timeout: 30_000 });

      const criticalButton = page.locator("button").filter({ hasText: /^Critical(?:\s*\(\d+\))?$/i }).first();
      await criticalButton.waitFor({ state: "visible", timeout: 30_000 });
      const criticalCount = parseTrailingCount((await criticalButton.textContent()) || "");

      await criticalButton.click();
      assert.equal(await criticalButton.getAttribute("aria-pressed"), "true", "OSINT critical filter should expose pressed state");

      if ((criticalCount ?? 0) > 0) {
        await page.locator('main a.surface-card[href]').first().waitFor({ state: "visible", timeout: 30_000 });
        assert.doesNotMatch(
          (await page.textContent("body")) || "",
          /No events match this filter/i,
          "OSINT critical filter should not show the empty state when critical events exist",
        );
        assert.match(
          (await page.locator('main a.surface-card[href]').first().textContent()) || "",
          /critical/i,
          "OSINT critical filter should surface critical-severity cards",
        );
      } else {
        await page.waitForSelector("text=No events match this filter", { timeout: 30_000 });
      }

      const allButton = page.locator("button").filter({ hasText: /^All(?:\s*\(\d+\))?$/i }).first();
      await allButton.click();
      assert.equal(await allButton.getAttribute("aria-pressed"), "true", "OSINT all filter should expose pressed state when restored");
      await page.locator('main a.surface-card[href]').first().waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-osint-filters", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated Air/Sea filters honor no-match search and recovery", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/air-sea");

      await page.waitForSelector("text=Air / Sea Ops", { timeout: 30_000 });

      const search = page.locator('input[placeholder="Search reports, channels, tags..."]').first();
      await search.fill("__sentinelstream_e2e_no_match__");
      await page.waitForSelector("text=No air/sea intel reports match your filters", { timeout: 30_000 });

      await search.fill("");
      await page.waitForSelector("text=Air / Sea Intel Feed", { timeout: 30_000 });
      assert.doesNotMatch(
        (await page.textContent("body")) || "",
        /No air\/sea intel reports match your filters/i,
        "Air/Sea page should recover after clearing a no-match search",
      );

      const airButton = page.getByRole("button", { name: "Air domain filter" });
      await airButton.click();
      assert.equal(await airButton.getAttribute("aria-pressed"), "true", "Air/Sea air filter should expose pressed state");

      const highButton = page.getByRole("button", { name: "High severity filter" });
      await highButton.click();
      assert.equal(await highButton.getAttribute("aria-pressed"), "true", "Air/Sea high-severity filter should expose pressed state");
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-air-sea-filters", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated Threat Map region cards open and close detail state", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/map");

      await page.waitForSelector("text=Global Threat Overview", { timeout: 30_000 });

      const regionCard = page.locator('button[aria-label^="Inspect "]').first();
      await regionCard.waitFor({ state: "visible", timeout: 30_000 });

      const regionLabel = (((await regionCard.getAttribute("aria-label")) || "").match(/^Inspect (.+) region$/)?.[1] || "").trim();
      assert.ok(regionLabel.length > 0, "Threat Map region card should expose an inspect label");

      await regionCard.click();
      assert.equal(await regionCard.getAttribute("aria-pressed"), "true", "Threat Map region card should become selected after click");
      await page.waitForSelector(`text=${regionLabel}`, { timeout: 30_000 });
      await page.waitForSelector('button[aria-label="Close region detail"]', { timeout: 30_000 });

      const detailPanelText = (await page.textContent("body")) || "";
      assert.match(detailPanelText, new RegExp(regionLabel, "i"), "Threat Map detail panel should bind to the selected region");

      await page.getByRole("button", { name: "Close region detail" }).click();
      assert.equal(await regionCard.getAttribute("aria-pressed"), "false", "Threat Map region card should reset after closing detail");
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-threat-map-region-flow", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated dashboard controls support keyboard activation", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const osintCritical = page.locator("button").filter({ hasText: /^Critical(?:\s*\(\d+\))?$/i }).first();
      await osintCritical.focus();
      await page.keyboard.press("Enter");
      assert.equal(await osintCritical.getAttribute("aria-pressed"), "true", "OSINT critical filter should respond to keyboard activation");

      await page.goto(`${EDGE_BASE_URL}/air-sea`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      const airFilter = page.getByRole("button", { name: "Air domain filter" });
      await airFilter.focus();
      await page.keyboard.press("Enter");
      assert.equal(await airFilter.getAttribute("aria-pressed"), "true", "Air domain filter should respond to keyboard activation");

      const highSeverity = page.getByRole("button", { name: "High severity filter" });
      await highSeverity.focus();
      await page.keyboard.press(" ");
      assert.equal(await highSeverity.getAttribute("aria-pressed"), "true", "Air/Sea high-severity filter should respond to keyboard activation");

      await page.goto(`${EDGE_BASE_URL}/map`, {
        waitUntil: "networkidle",
        timeout: 45_000,
      });

      const regionCard = page.locator('button[aria-label^="Inspect "]').first();
      await regionCard.focus();
      await page.keyboard.press("Enter");
      assert.equal(await regionCard.getAttribute("aria-pressed"), "true", "Threat Map region card should respond to keyboard activation");

      const closeRegionDetail = page.getByRole("button", { name: "Close region detail" });
      await closeRegionDetail.focus();
      await page.keyboard.press("Enter");
      assert.equal(await regionCard.getAttribute("aria-pressed"), "false", "Threat Map region detail should close via keyboard activation");
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-dashboard-keyboard-controls", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated CRM and sidebar support keyboard-only navigation", async (t) => {
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
      await navigateByKeyboard(overviewLink, page, /\/overview$/);

      const telegramLink = page.getByRole("link", { name: "Telegram" }).first();
      await navigateByKeyboard(telegramLink, page, /\/telegram$/);
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-crm-sidebar-keyboard", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser desktop sidebar collapse and expand controls toggle nav state", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const desktopSidebar = page.locator("#desktop-navigation");
      const collapseSidebar = desktopSidebar.getByRole("button", { name: "Collapse sidebar" });
      await collapseSidebar.click();

      const expandSidebar = desktopSidebar.getByRole("button", { name: "Expand sidebar" });
      await expandSidebar.waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await expandSidebar.getAttribute("aria-expanded"), "false", "desktop expand control should report collapsed state");

      const collapsedOverviewLink = desktopSidebar.getByRole("link", { name: "Overview" });
      await collapsedOverviewLink.hover();
      await desktopSidebar.locator('[aria-hidden="true"]').filter({ hasText: /^Overview$/ }).first().waitFor({ state: "visible", timeout: 30_000 });

      await expandSidebar.click();
      await collapseSidebar.waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await collapseSidebar.getAttribute("aria-expanded"), "true", "desktop collapse control should report expanded state");
      await desktopSidebar.getByText("Intel Operations").waitFor({ state: "visible", timeout: 30_000 });
    } catch (error) {
      await captureBrowserArtifacts(page, "desktop-sidebar-collapse-expand", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser desktop collapsed nav persists across reload and keeps link routing intact", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const desktopSidebar = page.locator("#desktop-navigation");
      await desktopSidebar.getByRole("button", { name: "Collapse sidebar" }).click();

      const collapsedBillingLink = desktopSidebar.getByRole("link", { name: "Billing" });
      await collapsedBillingLink.hover();
      await desktopSidebar.locator('[aria-hidden="true"]').filter({ hasText: /^Billing$/ }).first().waitFor({ state: "visible", timeout: 30_000 });
      await collapsedBillingLink.click();
      await page.waitForURL(/\/billing$/, { timeout: 30_000 });
      await desktopSidebar.getByRole("button", { name: "Expand sidebar" }).waitFor({ state: "visible", timeout: 30_000 });

      await page.reload({ waitUntil: "networkidle", timeout: 45_000 });
      await desktopSidebar.getByRole("button", { name: "Expand sidebar" }).waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(
        await desktopSidebar.getByRole("button", { name: "Expand sidebar" }).getAttribute("aria-expanded"),
        "false",
        "collapsed desktop state should persist across reload",
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "desktop-sidebar-persisted-collapse", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser mobile drawer opens, navigates, and closes cleanly", async (t) => {
  const runtime = await createBrowserContext(t, {
    viewport: { width: 390, height: 844 },
  });
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const openNavigation = page.getByRole("button", { name: "Open navigation" });
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "false", "mobile drawer should start closed");
      await openNavigation.click();
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "true", "mobile drawer toggle should report open state");

      const mobileSidebar = page.locator("#mobile-navigation");
      await mobileSidebar.getByRole("button", { name: "Close navigation" }).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByText("Intel Operations").waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByText(/^PyRo1121$/).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByText(/^@PyRo1121$/).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByRole("button", { name: "Sign out" }).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByRole("link", { name: "Telegram" }).click();
      await page.waitForURL(/\/telegram$/, { timeout: 30_000 });
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "false", "mobile drawer should close after route navigation");

      await openNavigation.click();
      const overlay = page.getByRole("button", { name: "Close navigation overlay" });
      await overlay.waitFor({ state: "visible", timeout: 30_000 });
      const overlayBox = await overlay.boundingBox();
      assert.ok(overlayBox, "mobile navigation overlay should expose a click target");
      await overlay.click({
        position: {
          x: Math.max(overlayBox.width - 20, 1),
          y: Math.min(40, Math.max(overlayBox.height - 20, 1)),
        },
      });
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "false", "mobile drawer should close when the overlay is activated");
    } catch (error) {
      await captureBrowserArtifacts(page, "mobile-drawer-navigation", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser mobile drawer stays expanded even when desktop collapse preference is set", async (t) => {
  const runtime = await createBrowserContext(t, {
    viewport: { width: 390, height: 844 },
  });
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem("sidebar-collapsed", "true");
      });

      await openDashboardPage(page, "/osint");

      const openNavigation = page.getByRole("button", { name: "Open navigation" });
      await openNavigation.click();

      const mobileSidebar = page.locator("#mobile-navigation");
      await mobileSidebar.getByText("Intel Operations").waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByText(/^PyRo1121$/).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByText(/^@PyRo1121$/).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByRole("link", { name: "Billing" }).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByRole("button", { name: "Sign out" }).waitFor({ state: "visible", timeout: 30_000 });
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "true", "mobile drawer should remain open while expanded content is visible");
    } catch (error) {
      await captureBrowserArtifacts(page, "mobile-drawer-ignores-desktop-collapse", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated app pages stay free of uncaught, console, and same-origin request errors", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const { pageErrors, consoleErrors, requestFailures } = collectBrowserDiagnostics(page, EDGE_BASE_URL, {
        extraIgnoredConsolePatterns: SMOKE_IGNORED_CONSOLE_PATTERNS,
      });

      for (const route of AUTHENTICATED_BROWSER_NOERROR_ROUTES) {
        await page.goto(`${EDGE_BASE_URL}${route}`, {
          waitUntil: "networkidle",
          timeout: 45_000,
        });
        await page.waitForTimeout(1_000);
      }

      assertNoBrowserDiagnostics(
        { pageErrors, consoleErrors, requestFailures },
        {
          pageErrors: "authenticated dashboard pages should not throw uncaught page errors",
          consoleErrors: "authenticated dashboard pages should not emit console.error messages",
          requestFailures: "authenticated dashboard pages should not have same-origin request failures",
        },
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-dashboard-diagnostics", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser public auth pages render current Intel Dashboard access UI", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const routes = PUBLIC_AUTH_BROWSER_ROUTES;

      for (const route of routes) {
        const response = await page.goto(`${EDGE_BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        assert.ok(response, `${route.path} should return a response`);
        assert.equal(response.status(), 200, `${route.path} should render successfully`);
        const bodyText = (await page.textContent("body")) || "";
        assert.match(bodyText, new RegExp(route.heading, "i"), `${route.path} should render the current heading`);
        for (const label of route.labels) {
          assert.match(bodyText, new RegExp(label, "i"), `${route.path} should render ${label}`);
        }
        assert.match(
          bodyText,
          /Waiting for security check|Complete the security check before continuing/i,
          `${route.path} should explain the turnstile gate`,
        );
        assert.doesNotMatch(bodyText, /PyRoBOT|PyRo1121Bot/i, `${route.path} should not render legacy branding`);
        const buttons = await page.getByRole("button").all();
        assert.ok(buttons.length >= 2, `${route.path} should render gated auth buttons`);
        for (const button of buttons.slice(0, 2)) {
          assert.equal(await button.isDisabled(), true, `${route.path} auth CTA should stay disabled until turnstile completes`);
        }
      }
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-pages", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser auth pages preserve safe next routes in rendered auth actions", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openAndAssertPublicAuthEntry(page, { mode: "login", nextPath: "/crm" });
      await openAndAssertPublicAuthEntry(page, { mode: "signup", nextPath: "/briefings" });
    } catch (error) {
      await captureBrowserArtifacts(page, "auth-page-next-routing", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser protected routes surface session-unavailable recovery and recover into login state", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      let authChecks = 0;
      await page.route("**/api/auth/me", async (route) => {
        authChecks += 1;
        if (authChecks === 1) {
          await route.abort("failed");
          return;
        }
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ authenticated: false }),
        });
      });

      await openPublicPage(page, "/osint");

      await page.waitForSelector("text=Session Check Unavailable", { timeout: 30_000 });
      await page.waitForSelector("text=Retry Session Check", { timeout: 30_000 });
      assert.match(
        (await page.textContent("body")) || "",
        /could not verify your session right now/i,
        "protected route should show the recovery shell when auth/session check fails",
      );
      assert.equal(
        await page.getByRole("link", { name: "Open Login" }).getAttribute("href"),
        "/login?next=%2Fosint",
        "session-unavailable recovery should preserve the requested route in the login link",
      );

      await page.getByRole("button", { name: "Retry Session Check" }).click();
      await waitForProtectedLoginOverlay(page, { nextPath: "/osint" });
      assert.doesNotMatch(
        (await page.textContent("body")) || "",
        /Session Check Unavailable/i,
        "retry should replace the recovery shell once the auth endpoint responds normally",
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "session-unavailable-recovery", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser protected login overlay preserves the current route in auth actions", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await page.route("**/api/auth/me", async (route) => {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ authenticated: false }),
        });
      });

      await openPublicPage(page, "/billing");

      await waitForProtectedLoginOverlay(page, { nextPath: "/billing" });
    } catch (error) {
      await captureBrowserArtifacts(page, "protected-login-overlay-next", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser public landing and 404 surfaces render expected production content", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const landingResponse = await openPublicPage(page, "/");
      assert.ok(landingResponse, "landing page should return a response");
      assert.equal(landingResponse.status(), 200, "landing page should render successfully");
      const landingText = (await page.textContent("body")) || "";
      assert.match(landingText, /Intel Dashboard/i, "landing should render Intel Dashboard branding");
      assert.match(landingText, /Start 7-Day Trial/i, "landing should render trial CTA");
      assert.doesNotMatch(landingText, /PyRoBOT|PyRo1121Bot/i, "landing should not render legacy branding");

      const notFoundResponse = await openPublicPage(page, "/this-page-should-not-exist-xyz");
      assert.ok(notFoundResponse, "404 page should return a response");
      assert.equal(notFoundResponse.status(), 404, "missing page should return 404");
      const notFoundText = (await page.textContent("body")) || "";
      assert.match(notFoundText, /Not Found/i, "missing page should render not found copy");

      const shadowedLandingResponse = await openPublicPage(page, "/landing");
      assert.ok(shadowedLandingResponse, "shadowed landing route should return a response");
      assert.equal(shadowedLandingResponse.status(), 404, "shadowed landing route should remain unavailable in production");
      const shadowedLandingText = (await page.textContent("body")) || "";
      assert.match(shadowedLandingText, /Not Found/i, "shadowed landing route should render not found copy");
    } catch (error) {
      await captureBrowserArtifacts(page, "public-landing-and-404", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser public landing CTAs navigate to the intended auth surfaces", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();

    await openPublicPage(page, "/");
    await page.getByRole("link", { name: "Login" }).first().click();
    await page.waitForURL(`${EDGE_BASE_URL}/login`, { timeout: 30_000 });
    assert.match((await page.textContent("body")) || "", /Sign in to Intel Dashboard/i);

    await openPublicPage(page, "/");
    await page.getByRole("link", { name: /Start 7-Day Trial|Start Trial with OAuth/i }).first().click();
    await page.waitForURL(`${EDGE_BASE_URL}/signup`, { timeout: 30_000 });
    assert.match((await page.textContent("body")) || "", /Create your Intel Dashboard account/i);

    await openPublicPage(page, "/");
    await page.getByRole("link", { name: /Open Live Dashboard|Open Dashboard/i }).first().click();
    await page.waitForURL(`${EDGE_BASE_URL}/overview`, { timeout: 30_000 });
    await waitForProtectedLoginOverlay(page, { nextPath: "/overview" });
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser route metadata stays aligned with production titles and canonical links", async (t) => {
  const publicRuntime = await createPublicBrowserContext(t);
  if (!publicRuntime) return;
  const authRuntime = await createBrowserContext(t);
  if (!authRuntime) {
    await publicRuntime.context.close();
    await publicRuntime.browser.close();
    return;
  }

  const publicPaths = new Set(PUBLIC_BROWSER_ROUTES);
  const publicAuthPaths = new Set(PUBLIC_AUTH_BROWSER_ROUTES.map((entry) => entry.path));

  try {
    for (const expectation of BROWSER_METADATA_EXPECTATIONS) {
      const runtime = publicPaths.has(expectation.path) || publicAuthPaths.has(expectation.path)
        ? publicRuntime
        : authRuntime;
      const page = await runtime.context.newPage();
      try {
        const response = await page.goto(`${EDGE_BASE_URL}${expectation.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        assert.ok(response, `${expectation.path} should return a response`);
        assert.ok(response.status() < 500, `${expectation.path} should not return a server error`);
        await assertRouteMetadata(page, expectation, { titleWaitMs: 750 });
      } catch (error) {
        await captureBrowserArtifacts(page, `route-metadata-${expectation.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await publicRuntime.context.close();
    await publicRuntime.browser.close();
    await authRuntime.context.close();
    await authRuntime.browser.close();
  }
});

test("browser authenticated sidebar navigation opens the expected routes", async (t) => {
  const runtime = await createBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    await page.goto(`${EDGE_BASE_URL}/osint`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    await page.getByRole("link", { name: "Intel Dashboard home" }).click();
    await page.waitForURL(/\/overview$/, { timeout: 30_000 });
    assert.match((await page.textContent("body")) || "", /Intel Dashboard Overview/i);
    await page.goto(`${EDGE_BASE_URL}/osint`, {
      waitUntil: "networkidle",
      timeout: 45_000,
    });

    const checks = [
      { label: "Overview", heading: "Intel Dashboard Overview", path: "/overview" },
      { label: "Threat Map", heading: "Threat Map", path: "/map" },
      { label: "Air/Sea Ops", heading: "Air / Sea Ops", path: "/air-sea" },
      { label: "Briefings", heading: "Briefings", path: "/briefings" },
      { label: "Telegram", heading: "Telegram Intel", path: "/telegram" },
      { label: "Billing", heading: "Billing & Access", path: "/billing" },
      { label: "CRM", heading: "Revenue Command Center", path: "/crm" },
    ];

    for (const check of checks) {
      await page.getByRole("link", { name: check.label }).first().click();
      await page.waitForURL(new RegExp(`${check.path}$`), { timeout: 30_000 });
      assert.match((await page.textContent("body")) || "", new RegExp(check.heading, "i"), `${check.label} should render ${check.heading}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser mobile sidebar brand link returns to overview", async (t) => {
  const runtime = await createBrowserContext(t, {
    viewport: { width: 390, height: 844 },
  });
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const openNavigation = page.getByRole("button", { name: "Open navigation" }).first();
      await openNavigation.waitFor({ state: "visible", timeout: 30_000 });
      await openNavigation.click();

      const mobileSidebar = page.locator("#mobile-navigation");
      await mobileSidebar.getByRole("link", { name: "Intel Dashboard home" }).waitFor({ state: "visible", timeout: 30_000 });
      await mobileSidebar.getByRole("link", { name: "Intel Dashboard home" }).click();
      await page.waitForURL(/\/overview$/, { timeout: 30_000 });
      assert.match((await page.textContent("body")) || "", /Intel Dashboard Overview/i);
      assert.equal(await openNavigation.getAttribute("aria-expanded"), "false", "mobile drawer should close after brand navigation");
    } catch (error) {
      await captureBrowserArtifacts(page, "mobile-sidebar-brand-home", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser public auth start routes enforce the security gate before provider redirect", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const expectations = [
        { path: "/auth/login", finalPath: "/login" },
        { path: "/auth/signup", finalPath: "/signup" },
        { path: "/auth/x/login", finalPath: "/login" },
        { path: "/auth/x/signup", finalPath: "/signup" },
      ];

      for (const route of expectations) {
        const response = await openPublicPage(page, route.path);
        assert.ok(response, `${route.path} should return a response`);
        const finalUrl = new URL(page.url());
        assert.equal(finalUrl.pathname, route.finalPath, `${route.path} should land on the matching auth page`);
        assert.equal(finalUrl.searchParams.get("error"), "security_check_required", `${route.path} should require turnstile verification before provider redirect`);
      }
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-start-routes", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser public pages stay free of uncaught, console, and same-origin request errors", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const { pageErrors, consoleErrors, requestFailures } = collectBrowserDiagnostics(page, EDGE_BASE_URL, {
        extraIgnoredConsolePatterns: SMOKE_IGNORED_CONSOLE_PATTERNS,
      });

      for (const route of PUBLIC_BROWSER_ROUTES) {
        await openPublicPage(page, route);
        await page.waitForTimeout(1_000);
      }

      assertNoBrowserDiagnostics(
        { pageErrors, consoleErrors, requestFailures },
        {
          pageErrors: "public pages should not throw uncaught page errors",
          consoleErrors: "public pages should not emit console.error messages",
          requestFailures: "public pages should not have same-origin request failures",
        },
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "public-page-diagnostics", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("browser-authenticated sign out clears access and forces re-auth on protected routes", async (t) => {
  if (!SIGNOUT_SESSION_COOKIE) {
    t.skip("E2E_SIGNOUT_SESSION_COOKIE is required for destructive sign-out browser e2e");
    return;
  }
  if (SIGNOUT_SESSION_COOKIE === SESSION_COOKIE) {
    t.skip("E2E_SIGNOUT_SESSION_COOKIE must differ from E2E_SESSION_COOKIE for destructive sign-out browser e2e");
    return;
  }
  const runtime = await createBrowserContextWithCookie(
    t,
    SIGNOUT_SESSION_COOKIE,
    "E2E_SIGNOUT_SESSION_COOKIE is required for destructive sign-out browser e2e",
  );
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openDashboardPage(page, "/osint");

      const signOut = page.getByRole("button", { name: "Sign out" }).first();
      await signOut.waitFor({ state: "visible", timeout: 30_000 });
      await signOut.click();

      await page.waitForURL((url) => {
        const pathname = new URL(url).pathname;
        return pathname === "/" || pathname === "/login";
      }, { timeout: 30_000 });

      const afterLogoutBody = (await page.textContent("body")) || "";
      assert.match(
        afterLogoutBody,
        /Start 7-Day Trial|Sign in to Intel Dashboard|Create your Intel Dashboard account/i,
        "sign out should land on a public access surface",
      );

      await openDashboardPage(page, "/osint");

      const protectedBody = (await page.textContent("body")) || "";
      assert.match(
        protectedBody,
        /Sign in to access the intelligence dashboard|Continue with X|Continue with GitHub/i,
        "protected routes should require re-auth after sign out",
      );
    } catch (error) {
      await captureBrowserArtifacts(page, "authenticated-sign-out-flow", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
