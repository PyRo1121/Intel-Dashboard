import test from "node:test";
import assert from "node:assert/strict";
import { getAuthCopy } from "@intel-dashboard/shared/auth-copy.ts";

test("getAuthCopy returns login copy", () => {
  assert.equal(getAuthCopy("login").title, "Sign in to Intel Dashboard");
  assert.equal(getAuthCopy("login").xLabel, "Continue with X");
});

test("getAuthCopy returns signup copy", () => {
  assert.equal(getAuthCopy("signup").title, "Create your Intel Dashboard account");
  assert.equal(getAuthCopy("signup").githubLabel, "Create Account with GitHub");
});
