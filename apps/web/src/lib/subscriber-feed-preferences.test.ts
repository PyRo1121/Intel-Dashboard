import assert from "node:assert/strict";
import test from "node:test";
import {
  cloneSubscriberFeedPreferences,
  formatSubscriberPreferenceInput,
  includesSubscriberPreferenceValue,
  normalizeSubscriberFeedPreferences,
  normalizeSubscriberPreferenceList,
  normalizeSubscriberPreferenceValue,
  parseSubscriberPreferenceInput,
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

test("normalizeSubscriberPreferenceList deduplicates array and comma-separated input", () => {
  assert.deepEqual(normalizeSubscriberPreferenceList([" Alpha ", "alpha", "", null]), ["alpha"]);
  assert.deepEqual(normalizeSubscriberPreferenceList(" desk , Desk, wire "), ["desk", "wire"]);
});

test("normalizeSubscriberFeedPreferences guards malformed payloads", () => {
  assert.deepEqual(
    normalizeSubscriberFeedPreferences({
      favoriteChannels: [" Alpha ", 42, "alpha"],
      favoriteSources: " Desk , desk ",
      watchRegions: null,
      watchTags: ["Cyber", "cyber"],
      watchCategories: [" Analysis "],
      updatedAt: "2026-03-14T12:00:00.000Z",
    }),
    {
      favoriteChannels: ["alpha"],
      favoriteSources: ["desk"],
      watchRegions: [],
      watchTags: ["cyber"],
      watchCategories: ["analysis"],
      updatedAt: "2026-03-14T12:00:00.000Z",
    },
  );
});

test("parse and format subscriber preference input stay normalized", () => {
  assert.deepEqual(parseSubscriberPreferenceInput(" Alpha , beta, ALPHA "), ["alpha", "beta"]);
  assert.equal(formatSubscriberPreferenceInput([" Beta ", "alpha", "alpha"]), "beta, alpha");
});
