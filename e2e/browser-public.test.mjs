import assert from "node:assert/strict";
import test from "node:test";
import { BROWSER_METADATA_EXPECTATIONS } from "./coverage-manifest.mjs";
import {
  assertNoBrowserDiagnostics,
  assertNotFoundPage,
  assertRouteMetadata,
  assertResponseStatus,
  openAndAssertPublicAuthEntry,
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
      await openAndAssertPublicAuthEntry(page, { mode: "login", nextPath: "/crm" });
      await openAndAssertPublicAuthEntry(page, { mode: "signup", nextPath: "/briefings" });
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
        assertResponseStatus(response, 200);
        await assertRouteMetadata(page, expectation, { titleWaitMs: 500 });
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
      assertResponseStatus(response, 404);
      await assertNotFoundPage(notFoundPage);
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
      assertNoBrowserDiagnostics({ pageErrors, consoleErrors, requestFailures });
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
