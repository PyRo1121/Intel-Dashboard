import assert from "node:assert/strict";
import test from "node:test";
import { signCollectorRequest } from "../src/edge-client.ts";

test("signCollectorRequest returns admin headers", async () => {
  const headers = await signCollectorRequest({
    method: "POST",
    path: "/api/telegram/collector-ingest",
    secret: "secret-value",
    nonce: "nonce-value-123456",
    timestampMs: Date.parse("2026-03-10T14:30:00.000Z"),
  });

  assert.equal(headers["X-Admin-Nonce"], "nonce-value-123456");
  assert.equal(headers["X-Admin-Timestamp"], String(Date.parse("2026-03-10T14:30:00.000Z")));
  assert.match(headers["X-Admin-Signature"], /^[a-f0-9]{64}$/);
});
