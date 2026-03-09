import test from "node:test";
import assert from "node:assert/strict";
import { isTelegramMessageVisible } from "./telegram-visibility.ts";

test("isTelegramMessageVisible applies age and media filters", () => {
  const nowMs = Date.UTC(2026, 2, 9, 12, 0, 0);
  const recentMessage = {
    datetime: new Date(nowMs - 60_000).toISOString(),
    media: [],
    has_photo: false,
    has_video: false,
  };
  const oldMessage = {
    datetime: new Date(nowMs - 25 * 60 * 60 * 1000).toISOString(),
    media: [],
    has_photo: false,
    has_video: false,
  };

  assert.equal(isTelegramMessageVisible({ message: recentMessage, ageWindow: "all", mediaOnly: false, nowMs }), true);
  assert.equal(isTelegramMessageVisible({ message: oldMessage, ageWindow: "24h", mediaOnly: false, nowMs }), false);
  assert.equal(isTelegramMessageVisible({ message: recentMessage, ageWindow: "24h", mediaOnly: false, nowMs }), true);
  assert.equal(isTelegramMessageVisible({ message: recentMessage, ageWindow: "all", mediaOnly: true, nowMs }), false);
  assert.equal(
    isTelegramMessageVisible({
      message: { ...recentMessage, media: [{ url: "photo.jpg" }] },
      ageWindow: "all",
      mediaOnly: true,
      nowMs,
    }),
    true,
  );
});
