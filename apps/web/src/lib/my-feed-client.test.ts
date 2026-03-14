import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchSubscriberFeed,
  fetchSubscriberFeedPreferences,
  saveSubscriberFeedPreferences,
} from "./my-feed-client.ts";

test("my feed client helpers normalize success and failure payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.includes("/api/subscriber/my-feed")) {
        return new Response(
          JSON.stringify({
            preferences: {
              favoriteChannels: [],
              favoriteSources: [],
              watchRegions: [],
              watchTags: [],
              watchCategories: [],
            },
            items: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (url.includes("/api/subscriber/feed-preferences") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            favoriteChannels: [" Alpha ", "alpha"],
            favoriteSources: " Desk ",
            watchRegions: [null, "Global"],
            watchTags: [" cyber "],
            watchCategories: [" Analysis "],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      return new Response(
        JSON.stringify({
          favoriteChannels: [" alpha ", 42],
          favoriteSources: " desk ",
          watchRegions: " global ",
          watchTags: [" cyber "],
          watchCategories: [" analysis "],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    const feed = await fetchSubscriberFeed("all");
    assert.deepEqual(feed?.items, []);

    const prefs = await fetchSubscriberFeedPreferences();
    assert.deepEqual(prefs, {
      favoriteChannels: ["alpha"],
      favoriteSources: ["desk"],
      watchRegions: ["global"],
      watchTags: ["cyber"],
      watchCategories: ["analysis"],
    });

    const saved = await saveSubscriberFeedPreferences({
      favoriteChannels: ["alpha"],
      favoriteSources: [],
      watchRegions: [],
      watchTags: [],
      watchCategories: [],
    });
    assert.deepEqual(saved, {
      favoriteChannels: ["alpha"],
      favoriteSources: ["desk"],
      watchRegions: ["global"],
      watchTags: ["cyber"],
      watchCategories: ["analysis"],
    });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    assert.equal(await fetchSubscriberFeed("all"), null);
    assert.equal(await fetchSubscriberFeedPreferences(), null);
    assert.equal(
      await saveSubscriberFeedPreferences({
        favoriteChannels: [],
        favoriteSources: [],
        watchRegions: [],
        watchTags: [],
        watchCategories: [],
      }),
      null,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
