import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSafeAuthRedirectLocation } from "../src/auth-redirect.ts";

describe("normalizeSafeAuthRedirectLocation", () => {
  it("accepts trusted internal auth callback paths", () => {
    const result = normalizeSafeAuthRedirectLocation(
      "https://intel.pyro1121.com/auth/callback/twitter",
      "https://intel.pyro1121.com",
    );
    assert.equal(result, "https://intel.pyro1121.com/auth/callback/twitter");
  });

  it("accepts trusted oauth provider authorize URLs", () => {
    const xResult = normalizeSafeAuthRedirectLocation(
      "https://x.com/i/oauth2/authorize?client_id=abc",
      "https://intel.pyro1121.com",
    );
    assert.ok(xResult?.startsWith("https://x.com/i/oauth2/authorize"));

    const ghResult = normalizeSafeAuthRedirectLocation(
      "https://github.com/login/oauth/authorize?client_id=abc",
      "https://intel.pyro1121.com",
    );
    assert.ok(ghResult?.startsWith("https://github.com/login/oauth/authorize"));
  });

  it("rejects non-auth or untrusted redirects", () => {
    assert.equal(
      normalizeSafeAuthRedirectLocation(
        "https://intel.pyro1121.com/osint",
        "https://intel.pyro1121.com",
      ),
      null,
    );
    assert.equal(
      normalizeSafeAuthRedirectLocation(
        "https://evil.example.com/oauth2/authorize",
        "https://intel.pyro1121.com",
      ),
      null,
    );
    assert.equal(
      normalizeSafeAuthRedirectLocation(
        "javascript:alert(1)",
        "https://intel.pyro1121.com",
      ),
      null,
    );
  });
});

