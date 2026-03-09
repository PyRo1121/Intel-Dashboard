import test from "node:test";
import assert from "node:assert/strict";
import {
  getTelegramAvatarBgColor,
  getTelegramAvatarLetter,
  getTelegramChannelName,
  getTelegramDomainTags,
  getTelegramEntryKey,
  getTelegramMessageFallbackKey,
  getTelegramEntrySourceSignatures,
  getTelegramRankReasons,
  getTelegramSources,
  getTelegramSourceLabels,
  getTelegramSourceLabelsTitle,
  toTelegramSafeDomId,
  doesTelegramGroupMatchEntry,
} from "./telegram-entry-meta.ts";

const entry = {
  category: "ru_milblog",
  channelLabel: "Channel",
  channelUsername: "channel",
  message: {
    link: "https://t.me/example/1",
    datetime: "2026-03-09T12:00:00.000Z",
    text_original: "Original text",
    image_text_en: undefined,
    media: [],
  },
  dedupe: {
    clusterKey: "cluster_1",
    sourceCount: 2,
    sourceSignatures: [" sig-1 ", "", "sig-2"],
    sourceLabels: ["Alpha", "Beta"],
    freshnessTier: "breaking" as const,
    domainTags: ["strategic"],
    categorySet: ["ru_milblog", "naval"],
    sources: [{ label: "Channel" }, { label: "Mirror" }],
  },
};

test("telegram entry meta helpers normalize keys, signatures, and safe ids", () => {
  assert.equal(getTelegramEntryKey(entry), "cluster_1");
  assert.equal(getTelegramMessageFallbackKey(entry), "https://t.me/example/1");
  assert.deepEqual(getTelegramEntrySourceSignatures(entry), [" sig-1 ", "sig-2"]);
  assert.deepEqual(getTelegramSourceLabels(entry), ["Alpha", "Beta"]);
  assert.deepEqual(getTelegramSourceLabels(entry, 1), ["Alpha"]);
  assert.equal(getTelegramSourceLabelsTitle(entry), "Alpha, Beta");
  assert.deepEqual(getTelegramDomainTags(entry), ["strategic"]);
  assert.deepEqual(getTelegramSources(entry), [{ label: "Channel" }, { label: "Mirror" }]);
  assert.equal(toTelegramSafeDomId("msg:focus/1?"), "msg_focus_1_");
});

test("telegram entry meta helpers derive avatar color and rank reasons", () => {
  assert.equal(getTelegramAvatarBgColor("ru_milblog"), "#fca5a5");
  assert.equal(getTelegramChannelName(entry), "Channel");
  assert.equal(getTelegramAvatarLetter(entry), "C");
  assert.deepEqual(
    getTelegramRankReasons({
      entry,
      hasUsefulImageText: () => false,
    }),
    ["breaking", "2 sources", "strategic"],
  );
});

test("telegram entry meta helpers fall back cleanly for missing labels", () => {
  assert.equal(
    getTelegramChannelName({
      ...entry,
      channelLabel: "",
      channelUsername: "",
    }),
    "Telegram source",
  );
  assert.equal(
    getTelegramAvatarLetter({
      ...entry,
      channelLabel: "",
      channelUsername: "",
    }),
    "T",
  );
});

test("telegram entry meta helpers match groups by id, predicate, and category set", () => {
  assert.equal(doesTelegramGroupMatchEntry({ id: "all" }, entry), true);
  assert.equal(doesTelegramGroupMatchEntry({ id: "naval", categories: ["naval"] }, entry), true);
  assert.equal(doesTelegramGroupMatchEntry({ id: "custom", predicate: (item: typeof entry) => item.channelUsername === "channel" }, entry), true);
  assert.equal(doesTelegramGroupMatchEntry({ id: "none", categories: ["cyber"] }, entry), false);
});
