import assert from "node:assert/strict";
import test from "node:test";
import { corsJson, privateApiJson, privateApiMethodNotAllowed } from "../src/private-api-headers.ts";

test("corsJson applies JSON content type and origin headers", async () => {
  const response = corsJson("https://intel.pyro1121.com", 400, { error: "Bad Request" }, {
    Allow: "POST",
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Bad Request" });
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Allow"), "POST");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://intel.pyro1121.com");
});

test("privateApiJson applies private no-store JSON headers", async () => {
  const response = privateApiJson("https://intel.pyro1121.com", 403, { error: "Forbidden" });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Forbidden" });
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
  assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
  assert.match(response.headers.get("Vary") || "", /Origin/);
  assert.match(response.headers.get("Vary") || "", /Cookie/);
  assert.match(response.headers.get("Vary") || "", /Authorization/);
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
});

test("privateApiJson applies private no-store JSON headers on explicit error responses", async () => {
  const response = privateApiJson("https://intel.pyro1121.com", 400, { error: "Bad Request" });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Bad Request" });
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, no-cache, must-revalidate");
  assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
  assert.match(response.headers.get("Vary") || "", /Origin/);
  assert.match(response.headers.get("Vary") || "", /Cookie/);
  assert.match(response.headers.get("Vary") || "", /Authorization/);
});

test("privateApiJson merges extra headers", async () => {
  const response = privateApiJson("https://intel.pyro1121.com", 405, { error: "Method Not Allowed" }, null, {
    Allow: "GET, POST",
  });

  assert.equal(response.headers.get("Allow"), "GET, POST");
  assert.equal(response.headers.get("Content-Type"), "application/json");
});

test("privateApiMethodNotAllowed applies allow header and default payload", async () => {
  const response = privateApiMethodNotAllowed("https://intel.pyro1121.com", "GET, POST");

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "Method Not Allowed" });
  assert.equal(response.headers.get("Allow"), "GET, POST");
});
