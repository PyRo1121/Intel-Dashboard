import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneSubscriberFeedPreferences,
  includesSubscriberPreferenceValue,
  normalizeSubscriberPreferenceValue,
  toggleSubscriberPreferenceValue,
} from "./subscriber-feed-preferences.ts";

test("normalizeSubscriberPreferenceValue trims and lowercases", () => {
  assert.equal(normalizeSubscriberPreferenceValue("  Alpha_Channel  "), "alpha_channel");
  assert.equal(normalizeSubscriberPreferenceValue(""), "");
});

test("toggleSubscriberPreferenceValue adds and removes normalized values", () => {
  assert.deepEqual(toggleSubscriberPreferenceValue([], " Alpha "), ["alpha"]);
  assert.deepEqual(toggleSubscriberPreferenceValue(["alpha", "beta"], "ALPHA"), ["beta"]);
});

test("includesSubscriberPreferenceValue matches normalized values", () => {
  assert.equal(includesSubscriberPreferenceValue(["alpha", "beta"], " Beta "), true);
  assert.equal(includesSubscriberPreferenceValue(["alpha", "beta"], "gamma"), false);
});

test("cloneSubscriberFeedPreferences returns a writable copy", () => {
  const cloned = cloneSubscriberFeedPreferences({
    favoriteChannels: ["alpha"],
    favoriteSources: ["desk"],
    watchRegions: ["ukraine"],
    watchTags: ["cyber"],
    watchCategories: ["analysis"],
    updatedAt: "2026-03-09T12:00:00.000Z",
  });
  cloned.favoriteChannels.push("beta");
  assert.deepEqual(cloned.favoriteChannels, ["alpha", "beta"]);
});
