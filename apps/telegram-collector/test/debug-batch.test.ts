import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDebugCollectorBatch } from "../src/debug-batch.ts";

test("normalizeDebugCollectorBatch wraps a messages-only payload", () => {
  const batch = normalizeDebugCollectorBatch({
    messages: [
      {
        channel: "osirskiy",
        category: "conflict",
        messageId: "1",
        datetime: "2026-03-10T18:45:00.000Z",
        link: "https://t.me/osirskiy/1",
      },
    ],
  }, "collector");

  assert.ok(batch);
  assert.equal(batch?.source, "mtproto");
  assert.equal(batch?.accountId, "collector");
  assert.equal(batch?.messages.length, 1);
});

test("normalizeDebugCollectorBatch keeps the trusted account id when the payload tries to override it", () => {
  const batch = normalizeDebugCollectorBatch({
    accountId: "untrusted",
    messages: [
      {
        channel: "osirskiy",
        category: "conflict",
        messageId: "1",
        datetime: "2026-03-10T18:45:00.000Z",
        link: "https://t.me/osirskiy/1",
      },
    ],
  }, "collector");

  assert.equal(batch?.accountId, "collector");
});
