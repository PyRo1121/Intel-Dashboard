import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_METADATA_EXPECTATIONS,
  PUBLIC_AUTH_BROWSER_ROUTES,
  PUBLIC_BROWSER_ROUTES,
} from "./coverage-manifest.mjs";
import {
  captureBrowserArtifacts,
  collectBrowserDiagnostics,
  createBrowserContext,
  createPublicBrowserContext,
  EDGE_BASE_URL,
  waitForProtectedLoginOverlay,
} from "./browser-test-helpers.mjs";

test("public auth pages render current Intel Dashboard access UI", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;
  try {
    const page = await context.newPage();
    try {
      for (const route of PUBLIC_AUTH_BROWSER_ROUTES) {
        const response = await page.goto(`${EDGE_BASE_URL}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });
        assert.ok(response);
        assert.equal(response.status(), 200);
        const bodyText = (await page.textContent("body")) || "";
        assert.match(bodyText, new RegExp(route.heading, "i"));
        for (const label of route.labels) {
          assert.match(bodyText, new RegExp(label, "i"));
        }
        assert.match(bodyText, /Waiting for security check|Complete the security check before continuing/i);
        assert.doesNotMatch(bodyText, /PyRoBOT|PyRo1121Bot/i);
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

test("public auth pages preserve safe next routes in rendered auth actions", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;
  try {
    const page = await context.newPage();
    try {
      await page.goto(`${EDGE_BASE_URL}/login?next=${encodeURIComponent("/crm")}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      assert.equal(await page.getByRole("button", { name: "Continue with X" }).getAttribute("data-auth-href"), "/auth/x/login?next=%2Fcrm");
      assert.equal(await page.getByRole("button", { name: "Continue with GitHub" }).getAttribute("data-auth-href"), "/auth/login?next=%2Fcrm");

      await page.goto(`${EDGE_BASE_URL}/signup?next=${encodeURIComponent("/briefings")}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      assert.equal(await page.getByRole("button", { name: "Create Account with X" }).getAttribute("data-auth-href"), "/auth/x/signup?next=%2Fbriefings");
      assert.equal(await page.getByRole("button", { name: "Create Account with GitHub" }).getAttribute("data-auth-href"), "/auth/signup?next=%2Fbriefings");
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-next-routing", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("public and protected route auth recovery surfaces stay correct", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;
  try {
    const page = await context.newPage();
    try {
      let authChecks = 0;
      await page.route("**/api/auth/me", async (route) => {
        authChecks += 1;
        if (authChecks === 1) return route.abort("failed");
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ authenticated: false }),
        });
      });

      await page.goto(`${EDGE_BASE_URL}/osint`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForSelector("text=Session Check Unavailable", { timeout: 30_000 });
      await page.getByRole("button", { name: "Retry Session Check" }).click();
      await waitForProtectedLoginOverlay(page, { nextPath: "/osint" });

      await page.goto(`${EDGE_BASE_URL}/billing`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await waitForProtectedLoginOverlay(page, { nextPath: "/billing" });
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-recovery", error);
      throw error;
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("public landing, CTAs, metadata, and diagnostics stay aligned", async (t) => {
  const publicRuntime = await createPublicBrowserContext(t);
  if (!publicRuntime) return;
  const authRuntime = await createBrowserContext(t);
  if (!authRuntime) {
    await publicRuntime.context.close();
    await publicRuntime.browser.close();
    return;
  }

  try {
    const page = await publicRuntime.context.newPage();
    try {
      const landingResponse = await page.goto(`${EDGE_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      assert.ok(landingResponse);
      assert.equal(landingResponse.status(), 200);
      const landingText = (await page.textContent("body")) || "";
      assert.match(landingText, /Intel Dashboard/i);
      assert.match(landingText, /Start 7-Day Trial/i);
      assert.doesNotMatch(landingText, /PyRoBOT|PyRo1121Bot/i);

      await page.getByRole("link", { name: "Login" }).first().click();
      await page.waitForURL(`${EDGE_BASE_URL}/login`, { timeout: 30_000 });

      await page.goto(`${EDGE_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("link", { name: /Start 7-Day Trial|Start Trial with OAuth/i }).first().click();
      await page.waitForURL(`${EDGE_BASE_URL}/signup`, { timeout: 30_000 });

      await page.goto(`${EDGE_BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.getByRole("link", { name: /Open Live Dashboard|Open Dashboard/i }).first().click();
      await page.waitForURL(`${EDGE_BASE_URL}/overview`, { timeout: 30_000 });
      await waitForProtectedLoginOverlay(page, { nextPath: "/overview" });
    } catch (error) {
      await captureBrowserArtifacts(page, "public-landing-ctas", error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }

    const publicPaths = new Set(PUBLIC_BROWSER_ROUTES);
    const publicAuthPaths = new Set(PUBLIC_AUTH_BROWSER_ROUTES.map((entry) => entry.path));
    for (const expectation of BROWSER_METADATA_EXPECTATIONS) {
      const runtime = publicPaths.has(expectation.path) || publicAuthPaths.has(expectation.path) ? publicRuntime : authRuntime;
      const page = await runtime.context.newPage();
      try {
        const response = await page.goto(`${EDGE_BASE_URL}${expectation.path}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        assert.ok(response);
        assert.ok(response.status() < 500);
        await page.waitForTimeout(750);
        assert.equal(await page.title(), expectation.title);
      } catch (error) {
        await captureBrowserArtifacts(page, `public-metadata-${expectation.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }

    const diagnosticsPage = await publicRuntime.context.newPage();
    try {
      const { pageErrors, consoleErrors, requestFailures } = collectBrowserDiagnostics(diagnosticsPage, EDGE_BASE_URL);
      for (const route of PUBLIC_BROWSER_ROUTES) {
        await diagnosticsPage.goto(`${EDGE_BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await diagnosticsPage.waitForTimeout(1_000);
      }
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(requestFailures, []);
    } catch (error) {
      await captureBrowserArtifacts(diagnosticsPage, "public-page-diagnostics", error);
      throw error;
    } finally {
      await diagnosticsPage.close().catch(() => {});
    }
  } finally {
    await publicRuntime.context.close();
    await publicRuntime.browser.close();
    await authRuntime.context.close();
    await authRuntime.browser.close();
  }
});
