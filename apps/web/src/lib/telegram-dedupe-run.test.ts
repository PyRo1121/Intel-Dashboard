import test from "node:test";
import assert from "node:assert/strict";
import { dedupeTelegramEntries } from "./telegram-dedupe-run.ts";

test("dedupeTelegramEntries collapses duplicate entries and preserves newest primary", () => {
  const entries = [
    {
      category: "ru_milblog",
      channelLabel: "Channel B",
      channelUsername: "channel_b",
      message: {
        link: "https://t.me/example/2",
        datetime: "2026-03-09T12:05:00.000Z",
        text_original: "Missile strike reported",
        text_en: "Missile strike reported",
        image_text_en: "",
        views: "10",
        media: [],
      },
    },
    {
      category: "naval",
      channelLabel: "Channel A",
      channelUsername: "channel_a",
      message: {
        link: "https://t.me/example/1",
        datetime: "2026-03-09T12:00:00.000Z",
        text_original: "Missile strike reported",
        text_en: "Missile strike reported",
        image_text_en: "",
        views: "8",
        media: [],
      },
    },
  ];

  const deduped = dedupeTelegramEntries(entries, {
    textWindowMs: 10 * 60 * 1000,
    mediaWindowMs: 10 * 60 * 1000,
  });

  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].channelLabel, "Channel B");
  assert.equal(deduped[0].dedupe?.sourceCount, 2);
  assert.equal(deduped[0].dedupe?.duplicateCount, 1);
  assert.deepEqual(deduped[0].dedupe?.sourceLabels, ["Channel A", "Channel B"]);
});
