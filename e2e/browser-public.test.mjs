import assert from "node:assert/strict";
import test from "node:test";
import { BROWSER_METADATA_EXPECTATIONS } from "./coverage-manifest.mjs";
import {
  captureBrowserArtifacts,
  collectBrowserDiagnostics,
  createPublicBrowserContext,
  EDGE_BASE_URL,
  openPublicPage,
} from "./browser-test-helpers.mjs";

test("public auth entry pages render the current Intel Dashboard access contract", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      await openPublicPage(page, `/login?next=${encodeURIComponent("/crm")}`);
      await page.waitForSelector('[data-testid="auth-access-login"]', { timeout: 30_000 });
      const loginBody = (await page.textContent('[data-testid="auth-access-login"]')) || "";
      assert.match(loginBody, /Continue with X/i);
      assert.match(loginBody, /Continue with GitHub/i);
      assert.equal(await page.getAttribute('[data-testid="auth-access-login-x"]', "href"), "/auth/x/login?next=%2Fcrm");
      assert.equal(await page.getAttribute('[data-testid="auth-access-login-github"]', "href"), "/auth/login?next=%2Fcrm");
      assert.equal(await page.getAttribute('[data-testid="auth-access-login-switch"]', "href"), "/signup?next=%2Fcrm");

      await openPublicPage(page, `/signup?next=${encodeURIComponent("/briefings")}`);
      await page.waitForSelector('[data-testid="auth-access-signup"]', { timeout: 30_000 });
      const signupBody = (await page.textContent('[data-testid="auth-access-signup"]')) || "";
      assert.match(signupBody, /Create Account with X/i);
      assert.match(signupBody, /Create Account with GitHub/i);
      assert.equal(await page.getAttribute('[data-testid="auth-access-signup-x"]', "href"), "/auth/x/signup?next=%2Fbriefings");
      assert.equal(await page.getAttribute('[data-testid="auth-access-signup-github"]', "href"), "/auth/signup?next=%2Fbriefings");
      assert.equal(await page.getAttribute('[data-testid="auth-access-signup-switch"]', "href"), "/login?next=%2Fbriefings");
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-contract", error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }

    const publicAuthMetadata = BROWSER_METADATA_EXPECTATIONS.filter(
      (entry) => entry.path === "/login" || entry.path === "/signup",
    );

    for (const expectation of publicAuthMetadata) {
      const page = await context.newPage();
      try {
        const response = await openPublicPage(page, expectation.path);
        assert.ok(response);
        assert.equal(response.status(), 200);
        await page.waitForTimeout(500);
        assert.equal(await page.title(), expectation.title);
      } catch (error) {
        await captureBrowserArtifacts(page, `public-auth-meta-${expectation.path}`, error);
        throw error;
      } finally {
        await page.close().catch(() => {});
      }
    }

    const notFoundPage = await context.newPage();
    try {
      const response = await openPublicPage(notFoundPage, "/this-page-should-not-exist-xyz");
      assert.ok(response);
      assert.equal(response.status(), 404);
      assert.match((await notFoundPage.textContent("body")) || "", /404|not found/i);
    } catch (error) {
      await captureBrowserArtifacts(notFoundPage, "public-404-contract", error);
      throw error;
    } finally {
      await notFoundPage.close().catch(() => {});
    }
  } finally {
    await context.close();
    await browser.close();
  }
});

test("public auth entry pages stay free of same-origin browser failures", async (t) => {
  const runtime = await createPublicBrowserContext(t);
  if (!runtime) return;
  const { browser, context } = runtime;

  try {
    const page = await context.newPage();
    try {
      const { pageErrors, consoleErrors, requestFailures } = collectBrowserDiagnostics(page, EDGE_BASE_URL);
      for (const route of ["/login", "/signup"]) {
        await openPublicPage(page, route);
        await page.waitForTimeout(500);
      }
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(consoleErrors, []);
      assert.deepEqual(requestFailures, []);
    } catch (error) {
      await captureBrowserArtifacts(page, "public-auth-diagnostics", error);
      throw error;
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    await context.close();
    await browser.close();
  }
});
