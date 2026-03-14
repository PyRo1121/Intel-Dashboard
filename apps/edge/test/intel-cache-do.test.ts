import assert from "node:assert/strict";
import test from "node:test";
import { buildWhalesUnavailableResponse } from "../src/whales-unavailable-response.ts";

test("buildWhalesUnavailableResponse preserves outage semantics instead of returning an empty 200 payload", async () => {
  const response = buildWhalesUnavailableResponse();

  assert.equal(response.status, 503);
  await assert.doesNotReject(async () => {
    const payload = await response.json() as { error?: string };
    assert.equal(payload.error, "Whale transactions are not yet available. First refresh is still in progress.");
  });
});
