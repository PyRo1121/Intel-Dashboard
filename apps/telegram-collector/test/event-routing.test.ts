import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error local mjs helper
import { getEventChannelId, getEventChannelUsername, isLikelyChannelEvent, normalizeTelegramEventMessage } from "../src/event-routing.mjs";

test("getEventChannelUsername normalizes usernames", () => {
  assert.equal(getEventChannelUsername({ chat: { username: "@AbuAliExpress" } }), "abualiexpress");
  assert.equal(getEventChannelUsername({ chat: { username: "  osirskiy " } }), "osirskiy");
  assert.equal(getEventChannelUsername({ chat: { username: "" } }), null);
});

test("getEventChannelId resolves channel identifiers from multiple Telegram shapes", () => {
  assert.equal(getEventChannelId({ message: { peerId: { channelId: 123n } } }), "123");
  assert.equal(getEventChannelId({ chatId: 456 }), "456");
  assert.equal(getEventChannelId({ chat: { id: "789" } }), "789");
  assert.equal(getEventChannelId({}), null);
});

test("normalizeTelegramEventMessage filters to configured channels and preserves payload", () => {
  const channelMap = new Map([
    ["abualiexpress", { username: "abualiexpress", label: "Abu Ali Express", category: "conflict" }],
  ]);
  const channelIdMap = new Map();
  const normalized = normalizeTelegramEventMessage({
    chat: { username: "@AbuAliExpress" },
    message: {
      id: 42,
      message: "Test post",
      date: new Date("2026-03-11T20:00:00.000Z"),
      views: 123,
      media: { document: { mimeType: "video/mp4" } },
      photo: true,
    },
  }, channelMap, channelIdMap);
  assert.deepEqual(normalized, {
    channel: "abualiexpress",
    label: "Abu Ali Express",
    category: "conflict",
    messageId: "42",
    datetime: "2026-03-11T20:00:00.000Z",
    link: "https://t.me/abualiexpress/42",
    textOriginal: "Test post",
    textEn: "Test post",
    language: "unknown",
    views: "123",
    media: [],
    hasPhoto: false,
    hasVideo: false,
    collectorMessageId: "abualiexpress:42",
  });
  assert.equal(normalizeTelegramEventMessage({ chat: { username: "other" }, message: { id: 1 } }, channelMap, channelIdMap), null);
});

test("normalizeTelegramEventMessage preserves zero views instead of dropping them", () => {
  const channelMap = new Map([
    ["abualiexpress", { username: "abualiexpress", label: "Abu Ali Express", category: "conflict" }],
  ]);
  const normalized = normalizeTelegramEventMessage({
    chat: { username: "@AbuAliExpress" },
    message: {
      id: 43,
      message: "Zero view post",
      date: new Date("2026-03-11T20:02:00.000Z"),
      views: 0,
    },
  }, channelMap, new Map());
  assert.equal(normalized?.views, "0");
});

test("normalizeTelegramEventMessage drops media-only events until collector has usable media references", () => {
  const channelMap = new Map([
    ["abualiexpress", { username: "abualiexpress", label: "Abu Ali Express", category: "conflict" }],
  ]);
  const channelIdMap = new Map();
  assert.equal(
    normalizeTelegramEventMessage({
      chat: { username: "@AbuAliExpress" },
      message: {
        id: 42,
        message: "",
        date: new Date("2026-03-11T20:00:00.000Z"),
        media: { document: { mimeType: "video/mp4" } },
        photo: true,
      },
    }, channelMap, channelIdMap),
    null,
  );
});

test("normalizeTelegramEventMessage matches configured channels by channel id when username is missing", () => {
  const channelMap = new Map();
  const channelIdMap = new Map([
    ["987654321", { username: "osirskiy", label: "Oleksandr Syrskyi", category: "conflict" }],
  ]);
  const normalized = normalizeTelegramEventMessage({
    message: {
      id: 7,
      peerId: { channelId: 987654321n },
      message: "Channel id routed",
      date: new Date("2026-03-11T20:01:00.000Z"),
    },
  }, channelMap, channelIdMap);
  assert.equal(normalized?.channel, "osirskiy");
  assert.equal(normalized?.messageId, "7");
});


test("isLikelyChannelEvent ignores non-channel traffic", () => {
  assert.equal(isLikelyChannelEvent({ chat: { username: "@AbuAliExpress" } }), true);
  assert.equal(isLikelyChannelEvent({ message: { peerId: { channelId: 123n } } }), true);
  assert.equal(isLikelyChannelEvent({ chatId: 8379767484, chat: {} }), false);
});
