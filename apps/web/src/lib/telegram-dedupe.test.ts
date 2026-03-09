import test from "node:test";
import assert from "node:assert/strict";
import {
  fastHash,
  isSameTelegramMessage,
  jaccardSimilarity,
  messageMediaSignature,
  normalizeDedupeText,
  tokenizeDedupeText,
} from "./telegram-dedupe.ts";
import { buildTelegramDedupeClusterKey } from "./telegram-dedupe-cluster.ts";

test("telegram dedupe helpers normalize text and tokenize useful terms", () => {
  const normalized = normalizeDedupeText("Breaking: Join @channel https://example.com Missile strike reported");
  assert.equal(normalized, "missile strike reported");
  assert.deepEqual(tokenizeDedupeText(normalized), ["missile", "strike", "reported"]);
});

test("telegram dedupe helpers hash deterministically and compare token overlap", () => {
  assert.equal(fastHash("cluster-seed"), fastHash("cluster-seed"));
  assert.notEqual(fastHash("cluster-a"), fastHash("cluster-b"));
  assert.equal(jaccardSimilarity(new Set(["a", "b"]), new Set(["b", "c"])), 1 / 3);
});

test("telegram dedupe helpers derive media signatures and message equality", () => {
  const message = {
    link: "https://t.me/example/1",
    datetime: "2026-03-09T12:00:00.000Z",
    text_en: "Translated",
    text_original: "Original",
    image_text_en: "OCR",
    views: "1.2K",
    media: [{ url: "https://cdn.example.com/path/photo.jpg" }, { url: "clip.mp4" }],
  };
  assert.equal(messageMediaSignature(message), "clip.mp4|photo.jpg");
  assert.equal(isSameTelegramMessage(message, { ...message }), true);
  assert.equal(isSameTelegramMessage(message, { ...message, text_original: "Changed original" }), false);
  assert.equal(
    isSameTelegramMessage(message, {
      ...message,
      media: [{ url: "https://cdn.example.com/path/other.jpg" }, { url: "clip.mp4" }],
    }),
    false,
  );
  assert.equal(isSameTelegramMessage(message, { ...message, views: "1.3K" }), false);
});

test("telegram dedupe cluster key stays deterministic when timestamp is invalid", () => {
  const entry = {
    category: "ru_milblog",
    message: {
      link: "https://t.me/example/1",
      datetime: "not-a-date",
      text_original: "Original",
    },
  };
  const first = buildTelegramDedupeClusterKey(entry, "canonical text", Number.NaN, "");
  const second = buildTelegramDedupeClusterKey(entry, "canonical text", Number.NaN, "");
  assert.equal(first, second);
});
