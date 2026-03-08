import assert from "node:assert/strict";
import test from "node:test";
import { shouldFetchInitialSession } from "./auth-route.ts";

test("shouldFetchInitialSession skips public routes", () => {
  assert.equal(shouldFetchInitialSession(true), false);
});

test("shouldFetchInitialSession fetches for private or unspecified routes", () => {
  assert.equal(shouldFetchInitialSession(false), true);
  assert.equal(shouldFetchInitialSession(undefined), true);
});
