import test from "node:test";
import assert from "node:assert/strict";
import { getAuthCopy } from "../../shared/auth-copy.ts";

test("getAuthCopy returns login copy", () => {
  assert.deepEqual(getAuthCopy("login"), {
    title: "Sign in to SentinelStream",
    description: "Continue your intelligence workflow with secure OAuth authentication.",
    xLabel: "Continue with X",
    githubLabel: "Continue with GitHub",
    switchLabel: "Need access? Create account",
  });
});

test("getAuthCopy returns signup copy", () => {
  assert.deepEqual(getAuthCopy("signup"), {
    title: "Create your SentinelStream access",
    description: "OAuth-only onboarding. Start in seconds with X or GitHub.",
    xLabel: "Create Account with X",
    githubLabel: "Create Account with GitHub",
    switchLabel: "Already have access? Sign in",
  });
});
