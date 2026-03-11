import test from "node:test";
import assert from "node:assert/strict";
import {
  countTelegramEntriesWithMedia,
  countVerifiedTelegramEntries,
  entryMediaCount,
  freshnessBadgeClass,
  freshnessStateForAge,
  hasUsefulImageText,
  isVerifiedEntry,
  mediaUrl,
  messageText,
  trustBadgeClass,
  trustTierForSignals,
  verificationLabelForSignals,
} from "./telegram-entry.ts";

test("telegram freshness helpers map ages to expected states and classes", () => {
  assert.equal(freshnessStateForAge(5 * 60 * 1000), "hot");
  assert.equal(freshnessStateForAge(30 * 60 * 1000), "warm");
  assert.equal(freshnessStateForAge(2 * 60 * 60 * 1000), "cool");
  assert.equal(freshnessStateForAge(7 * 60 * 60 * 1000), "cold");
  assert.match(freshnessBadgeClass("hot"), /rose/);
  assert.match(freshnessBadgeClass("cold"), /zinc/);
});

test("telegram trust helpers map explicit and inferred trust tiers", () => {
  assert.equal(trustTierForSignals({ trustTier: "core" }), "High");
  assert.equal(trustTierForSignals({ trustTier: "verified" }), "Medium");
  assert.equal(trustTierForSignals({ sourceCount: 3 }), "Medium");
  assert.equal(trustTierForSignals({ sourceCount: 1 }), "Watch");
  assert.match(trustBadgeClass("High"), /amber/);
});

test("telegram verification helper maps explicit and inferred signals", () => {
  assert.equal(verificationLabelForSignals({ verificationState: "verified" }), "Cross-confirmed");
  assert.equal(verificationLabelForSignals({ sourceCount: 2 }), "Multi-source");
  assert.equal(verificationLabelForSignals({ hasMedia: true }), "Media-backed");
  assert.equal(verificationLabelForSignals({ hasUsefulImageText: true }), "OCR-backed");
  assert.equal(verificationLabelForSignals({}), "Single-source");
});

test("telegram entry helpers normalize text, media URLs, and verification state", () => {
  const entry = {
    dedupe: { sourceCount: 1 as const },
    message: {
      text_original: " Original text ",
      text_en: " English text ",
      image_text_en: "Detected label",
      link: "https://t.me/example/1",
      datetime: "2026-03-09T12:00:00.000Z",
      media: [{ url: "telegram/photo.jpg" }],
    },
  };

  assert.equal(hasUsefulImageText("Detected label"), true);
  assert.equal(hasUsefulImageText("No readable text detected in image."), false);
  assert.equal(messageText(entry.message), "English text");
  assert.equal(mediaUrl("telegram/photo.jpg"), "/media/telegram/photo.jpg");
  assert.equal(mediaUrl("https://cdn.example.com/photo.jpg"), "https://cdn.example.com/photo.jpg");
  assert.equal(entryMediaCount(entry), 1);
  assert.equal(isVerifiedEntry(entry), true);
  assert.equal(
    isVerifiedEntry({
      dedupe: { sourceCount: 1 },
      message: {
        ...entry.message,
        image_text_en: undefined,
        media: [],
      },
    }),
    false,
  );
  assert.equal(
    countVerifiedTelegramEntries([
      entry,
      {
        dedupe: { sourceCount: 1 },
        message: {
          ...entry.message,
          image_text_en: undefined,
          media: [],
        },
      },
    ]),
    1,
  );
  assert.equal(
    countTelegramEntriesWithMedia([
      entry,
      {
        dedupe: { sourceCount: 1 },
        message: {
          ...entry.message,
          media: [],
        },
      },
    ]),
    1,
  );
});
