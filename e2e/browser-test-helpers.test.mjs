import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCloudflareAccessHeaders,
  collectBrowserDiagnostics,
  isIgnorableConsoleError,
  parseCookieHeader,
  sanitizeArtifactName,
  trim,
} from "./browser-test-helpers.mjs";

test("buildCloudflareAccessHeaders returns undefined unless both values are present", () => {
  assert.equal(buildCloudflareAccessHeaders("", "secret"), undefined);
  assert.equal(buildCloudflareAccessHeaders("client", ""), undefined);
  assert.deepEqual(buildCloudflareAccessHeaders("client", "secret"), {
    "CF-Access-Client-Id": "client",
    "CF-Access-Client-Secret": "secret",
  });
});

test("parseCookieHeader parses valid cookie headers and rejects malformed values", () => {
  assert.deepEqual(parseCookieHeader("session=abc123"), {
    name: "session",
    value: "abc123",
  });
  assert.equal(parseCookieHeader("invalid"), null);
  assert.equal(parseCookieHeader("=missing-name"), null);
});

test("browser helper utilities sanitize artifact names and trim strings consistently", () => {
  assert.equal(trim("  Intel Dashboard  "), "Intel Dashboard");
  assert.equal(sanitizeArtifactName("CRM AI Surface / 15m"), "crm-ai-surface-15m");
});

test("isIgnorableConsoleError only allows explicitly known noisy messages", () => {
  assert.equal(isIgnorableConsoleError("%c%d font-size:0;color:transparent NaN"), true);
  assert.equal(
    isIgnorableConsoleError("Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback."),
    true,
  );
  assert.equal(
    isIgnorableConsoleError(
      "Access to font at 'https://fonts.gstatic.com/foo.woff2' from origin 'https://intel.pyro1121.com' has been blocked by CORS policy: Request header field cf-access-client-id is not allowed by Access-Control-Allow-Headers in preflight response.",
    ),
    true,
  );
  assert.equal(isIgnorableConsoleError("Failed to load resource: net::ERR_FAILED"), true);
  assert.equal(isIgnorableConsoleError("Failed to load resource: the server responded with a status of 401 ()"), false);
});

test("collectBrowserDiagnostics records same-origin failures and ignores known noise", () => {
  const handlers = new Map();
  const page = {
    on(event, handler) {
      handlers.set(event, handler);
    },
  };

  const diagnostics = collectBrowserDiagnostics(page, "https://intel.pyro1121.com");

  handlers.get("pageerror")?.(new Error("uncaught boom"));
  handlers.get("console")?.({ type: () => "error", text: () => "real console failure" });
  handlers.get("console")?.({ type: () => "error", text: () => "%c%d font-size:0;color:transparent NaN" });
  handlers.get("requestfailed")?.({
    method: () => "GET",
    url: () => "https://intel.pyro1121.com/api/auth/me",
    failure: () => ({ errorText: "ERR_FAILED" }),
  });
  handlers.get("requestfailed")?.({
    method: () => "GET",
    url: () => "https://intel.pyro1121.com/api/auth/me",
    failure: () => ({ errorText: "ERR_ABORTED" }),
  });
  handlers.get("requestfailed")?.({
    method: () => "GET",
    url: () => "https://example.com/off-origin",
    failure: () => ({ errorText: "ERR_FAILED" }),
  });

  assert.deepEqual(diagnostics.pageErrors, ["uncaught boom"]);
  assert.deepEqual(diagnostics.consoleErrors, ["real console failure"]);
  assert.deepEqual(diagnostics.requestFailures, ["GET https://intel.pyro1121.com/api/auth/me ERR_FAILED"]);
});

test("collectBrowserDiagnostics tolerates malformed request URLs", () => {
  const handlers = new Map();
  const page = {
    on(event, handler) {
      handlers.set(event, handler);
    },
  };

  const diagnostics = collectBrowserDiagnostics(page, "https://intel.pyro1121.com");
  handlers.get("requestfailed")?.({
    method: () => "GET",
    url: () => "::not-a-url::",
    failure: () => ({ errorText: "ERR_FAILED" }),
  });

  assert.deepEqual(diagnostics.requestFailures, []);
});
