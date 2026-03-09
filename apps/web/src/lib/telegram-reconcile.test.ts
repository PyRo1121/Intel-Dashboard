import test from "node:test";
import assert from "node:assert/strict";
import { reconcileTelegramData } from "./telegram-reconcile.ts";

test("reconcileTelegramData reuses identical prior messages and preserves changed ones", () => {
  const sharedMessage = {
    link: "https://t.me/example/1",
    datetime: "2026-03-09T12:00:00.000Z",
    text_original: "Original",
    text_en: "Translated",
    image_text_en: "OCR",
    views: "1.2K",
    media: [{ url: "photo.jpg" }],
  };

  const prev = {
    channels: [
      {
        category: "ru_milblog",
        messages: [sharedMessage],
      },
    ],
  };

  const updatedMessage = {
    ...sharedMessage,
    views: "1.3K",
  };

  const nextSharedCopy = {
    ...sharedMessage,
  };

  const next = {
    channels: [
      {
        category: "ru_milblog",
        messages: [nextSharedCopy, updatedMessage],
      },
    ],
  };

  const reconciled = reconcileTelegramData(prev, next);
  assert.equal(reconciled.channels[0].messages[0], sharedMessage);
  assert.notEqual(reconciled.channels[0].messages[1], sharedMessage);
  assert.equal(reconciled.channels[0].messages[1].views, "1.3K");
});
