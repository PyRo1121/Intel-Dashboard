import assert from "node:assert/strict";
import test from "node:test";
import { collectBrowserDiagnostics, isIgnorableConsoleError } from "./browser-test-helpers.mjs";

test("isIgnorableConsoleError only allows explicitly known noisy messages", () => {
  assert.equal(isIgnorableConsoleError("%c%d font-size:0;color:transparent NaN"), true);
  assert.equal(
    isIgnorableConsoleError("Note that 'script-src' was not explicitly set, so 'default-src' is used as a fallback."),
    true,
  );
  assert.equal(isIgnorableConsoleError("Failed to load resource: the server responded with a status of 401 ()"), false);
  assert.equal(isIgnorableConsoleError("Failed to load resource: the server responded with a status of 404 ()"), false);
  assert.equal(isIgnorableConsoleError("Failed to load resource: the server responded with a status of 500 ()"), false);
});

test("collectBrowserDiagnostics records only same-origin non-aborted failures and non-ignored console errors", async () => {
  const handlers = new Map();
  const page = {
    on(event, handler) {
      handlers.set(event, handler);
    },
  };

  const diagnostics = collectBrowserDiagnostics(page, "https://intel.pyro1121.com");

  handlers.get("pageerror")?.(new Error("uncaught boom"));
  handlers.get("console")?.({
    type: () => "error",
    text: () => "real console failure",
  });
  handlers.get("console")?.({
    type: () => "error",
    text: () => "%c%d font-size:0;color:transparent NaN",
  });
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

test("collectBrowserDiagnostics tolerates malformed request URLs", async () => {
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
