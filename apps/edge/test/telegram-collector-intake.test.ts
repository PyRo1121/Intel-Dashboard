import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTelegramCollectorBatch } from "../src/telegram-collector-intake.ts";

test("normalizeTelegramCollectorBatch rejects malformed payloads", () => {
  assert.equal(normalizeTelegramCollectorBatch(null), null);
  assert.equal(normalizeTelegramCollectorBatch({ source: "mtproto", accountId: "", collectedAt: "", messages: [] }), null);
});

test("normalizeTelegramCollectorBatch trims values and deduplicates messages", () => {
  const batch = normalizeTelegramCollectorBatch({
    source: "mtproto",
    accountId: " acct-1 ",
    collectedAt: "2026-03-10T14:00:00.000Z",
    messages: [
      {
        channel: " AbuAliExpress ",
        label: " Abu Ali Express ",
        category: " conflict ",
        messageId: "123",
        datetime: "2026-03-10T14:00:01.000Z",
        link: "https://t.me/AbuAliExpress/123",
        textOriginal: " update ",
        media: [{ type: "photo", url: "https://cdn.example/photo.jpg" }],
      },
      {
        channel: "abualiexpress",
        label: "ignored duplicate",
        category: "conflict",
        messageId: "123",
        datetime: "2026-03-10T14:00:01.000Z",
        link: "https://t.me/AbuAliExpress/123",
        textOriginal: "duplicate",
      },
    ],
  });

  assert.ok(batch);
  assert.equal(batch?.accountId, "acct-1");
  assert.equal(batch?.messages.length, 1);
  assert.equal(batch?.messages[0]?.channel, "abualiexpress");
  assert.equal(batch?.messages[0]?.label, "Abu Ali Express");
});
