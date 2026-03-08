import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildClientXProfileDiagnostics,
  sanitizeDiagnosticErrorForClient,
  type XProfileSyncDiagnostics,
} from "../src/auth-diagnostics.ts";

describe("sanitizeDiagnosticErrorForClient", () => {
  it("returns null for empty values", () => {
    assert.equal(sanitizeDiagnosticErrorForClient(null), null);
    assert.equal(sanitizeDiagnosticErrorForClient("   "), null);
  });

  it("normalizes whitespace and truncates long payloads", () => {
    const compact = sanitizeDiagnosticErrorForClient("line1\nline2\tline3");
    assert.equal(compact, "line1 line2 line3");

    const long = sanitizeDiagnosticErrorForClient("x".repeat(400), 30);
    assert.equal(long, `${"x".repeat(30)}...`);
  });
});

describe("buildClientXProfileDiagnostics", () => {
  const sample: XProfileSyncDiagnostics = {
    required: true,
    status: "transient_profile_failure",
    hasRefreshToken: true,
    refreshAttempted: true,
    refreshSucceeded: false,
    tokenScope: "users.read tweet.read offline.access",
    tokenUserIdHint: "123456",
    error: "HTTP 503 [https://api.x.com/2/users/me] {\"title\":\"Service Unavailable\"}",
  };

  it("redacts sensitive fields for non-owner responses", () => {
    const diagnostics = buildClientXProfileDiagnostics(sample, false);
    assert.ok(diagnostics);
    assert.equal(diagnostics?.status, "transient_profile_failure");
    assert.equal(diagnostics?.error, "transient_profile_failure");
    assert.equal("tokenScope" in (diagnostics as object), false);
    assert.equal("tokenUserIdHint" in (diagnostics as object), false);
  });

  it("keeps sensitive fields for owner/debug responses", () => {
    const diagnostics = buildClientXProfileDiagnostics(sample, true) as XProfileSyncDiagnostics;
    assert.equal(diagnostics.tokenScope, sample.tokenScope);
    assert.equal(diagnostics.tokenUserIdHint, sample.tokenUserIdHint);
    assert.ok(typeof diagnostics.error === "string" && diagnostics.error.length > 0);
  });
});
