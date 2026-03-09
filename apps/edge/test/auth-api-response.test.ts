import assert from "node:assert/strict";
import test from "node:test";
import { misconfiguredApiResponse, unauthorizedApiResponse } from "../src/auth-api-response.ts";

test("unauthorizedApiResponse returns the shared private 401 payload", async () => {
  const response = unauthorizedApiResponse("https://intel.pyro1121.com");
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Unauthorized",
    login_url: "/login",
  });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
});

test("misconfiguredApiResponse returns the shared private 503 payload", async () => {
  const response = misconfiguredApiResponse("https://intel.pyro1121.com");
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: "Server auth misconfigured",
  });
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
});
