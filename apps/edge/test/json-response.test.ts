import assert from "node:assert/strict";
import test from "node:test";
import { jsonResponse } from "../src/json-response.ts";

test("jsonResponse sets JSON content type by default and preserves extra headers", async () => {
  const response = jsonResponse({ ok: true }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

