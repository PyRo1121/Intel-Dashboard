import test from "node:test";
import assert from "node:assert/strict";
import { getAuthCopy } from "../../shared/auth-copy.ts";

test("getAuthCopy returns login copy", () => {
  assert.equal(getAuthCopy("login").title, "Sign in to SentinelStream");
  assert.equal(getAuthCopy("login").xLabel, "Continue with X");
});

test("getAuthCopy returns signup copy", () => {
  assert.equal(getAuthCopy("signup").title, "Create your SentinelStream access");
  assert.equal(getAuthCopy("signup").githubLabel, "Create Account with GitHub");
});
