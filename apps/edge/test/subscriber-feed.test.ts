import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySubscriberFeedPreferences,
  filterSubscriberFeedItems,
  normalizeOsintSubscriberFeedItem,
  normalizeSubscriberFeedPreferences,
  normalizeSubscriberFeedScope,
  normalizeTelegramSubscriberFeedItem,
  sortSubscriberFeedItems,
} from "../src/subscriber-feed.ts";

test("normalizeSubscriberFeedPreferences trims and deduplicates string lists", () => {
  const prefs = normalizeSubscriberFeedPreferences({
    favoriteChannels: [" alpha ", "alpha", ""],
    favoriteSources: "desk, desk , wire",
    watchRegions: ["ukraine"],
    watchTags: ["cyber", "cyber"],
    watchCategories: ["conflict"],
  });

  assert.deepEqual(prefs.favoriteChannels, ["alpha"]);
  assert.deepEqual(prefs.favoriteSources, ["desk", "wire"]);
  assert.deepEqual(prefs.watchTags, ["cyber"]);
});

test("normalize feed items mark favorite/watch matches and sort by combined score", () => {
  const prefs = createEmptySubscriberFeedPreferences();
  prefs.favoriteChannels = ["alpha"];
  prefs.watchRegions = ["ukraine"];

  const telegram = normalizeTelegramSubscriberFeedItem(
    {
      event_id: "evt-1",
      datetime: "2026-03-09T12:00:00.000Z",
      category: "ukraine",
      source_labels: ["Alpha"],
      source_channels: ["alpha"],
      text_en: "Telegram event",
      signal_score: 80,
      signal_grade: "A",
      signal_reasons: ["first"],
      sources: [{ link: "https://t.me/alpha/1" }],
    },
    prefs,
  );
  const osint = normalizeOsintSubscriberFeedItem(
    {
      title: "OSINT item",
      summary: "OSINT item summary",
      source: "Example Desk",
      url: "https://example.com/item",
      timestamp: "2026-03-09T11:00:00.000Z",
      region: "global",
      category: "news",
      severity: "high",
    },
    prefs,
  );

  assert.equal(telegram.favoriteMatch, true);
  assert.equal(telegram.watchMatch, true);
  assert.equal(osint.favoriteMatch, false);
  assert.equal(sortSubscriberFeedItems([osint, telegram])[0]?.sourceSurface, "telegram");
});

test("scope filters reduce the mixed feed correctly", () => {
  const items = [
    {
      id: "a",
      sourceSurface: "telegram",
      favoriteMatch: true,
      watchMatch: false,
      combinedScore: 90,
      timestamp: "2026-03-09T12:00:00.000Z",
    },
    {
      id: "b",
      sourceSurface: "osint",
      favoriteMatch: false,
      watchMatch: true,
      combinedScore: 80,
      timestamp: "2026-03-09T11:00:00.000Z",
    },
  ] as const;

  assert.equal(filterSubscriberFeedItems(items as never, normalizeSubscriberFeedScope("favorites")).length, 1);
  assert.equal(filterSubscriberFeedItems(items as never, normalizeSubscriberFeedScope("watched")).length, 1);
  assert.equal(filterSubscriberFeedItems(items as never, normalizeSubscriberFeedScope("telegram")).length, 1);
  assert.equal(filterSubscriberFeedItems(items as never, normalizeSubscriberFeedScope("osint")).length, 1);
});
