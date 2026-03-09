import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTelegramDedupeClusterKey,
  getTelegramDominantCategory,
  getTelegramLegacyEntryKey,
  registerTelegramClusterIndex,
  scoreTelegramDedupeCluster,
} from "./telegram-dedupe-cluster.ts";

test("telegram dedupe cluster helpers derive stable keys and dominant categories", () => {
  const entry = {
    category: "ru_milblog",
    message: {
      link: "",
      datetime: "2026-03-09T12:00:00.000Z",
      text_original: "Original message body",
    },
  };

  assert.equal(
    getTelegramLegacyEntryKey(entry),
    "ru_milblog:2026-03-09T12:00:00.000Z:Original message body",
  );
  assert.match(
    buildTelegramDedupeClusterKey(entry, "canonical text", 1_800_000, ""),
    /^cluster_1_/,
  );
  assert.equal(
    getTelegramDominantCategory(new Map([["naval", 2], ["air_defense", 4]]), "naval"),
    "air_defense",
  );
});

test("telegram dedupe cluster helpers register indexes and score cluster similarity", () => {
  const map = new Map<string, number[]>();
  registerTelegramClusterIndex(map, "alpha", 1);
  registerTelegramClusterIndex(map, "alpha", 1);
  registerTelegramClusterIndex(map, "alpha", 2);
  assert.deepEqual(map.get("alpha"), [1, 2]);

  assert.equal(
    scoreTelegramDedupeCluster({
      msgTs: 1000,
      msgCanonical: "same canonical text",
      msgTokens: new Set(["same", "canonical", "text"]),
      msgMediaSignature: "",
      cluster: {
        canonicalText: "same canonical text",
        mediaSignature: "",
        latestTs: 1500,
        tokenSet: new Set(["same", "canonical", "text"]),
      },
      mediaWindowMs: 10_000,
      textWindowMs: 10_000,
    }),
    0.98,
  );

  assert.equal(
    scoreTelegramDedupeCluster({
      msgTs: 1000,
      msgCanonical: "short text",
      msgTokens: new Set(["short", "text"]),
      msgMediaSignature: "media-1",
      cluster: {
        canonicalText: "other text",
        mediaSignature: "media-1",
        latestTs: 1500,
        tokenSet: new Set(["other", "text"]),
      },
      mediaWindowMs: 10_000,
      textWindowMs: 10_000,
    }),
    1,
  );
});
