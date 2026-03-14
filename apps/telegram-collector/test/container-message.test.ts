import assert from "node:assert/strict";
import test from "node:test";
// @ts-ignore -- container runtime module is plain .mjs for the Node container process.
import { normalizeTelegramEventMessage } from "../src/container-message.mjs";

const channelMap = new Map([
  ["osirskiy", {
    username: "osirskiy",
    label: "Oleksandr Syrskyi",
    category: "conflict",
  }],
]);

test("normalizeTelegramEventMessage normalizes configured text messages", () => {
  const normalized = normalizeTelegramEventMessage({
    event: {
      chat: { username: "osirskiy" },
      message: {
        id: 42,
        message: " frontline update ",
        date: new Date("2026-03-14T12:00:00.000Z"),
        views: 123,
      },
    },
    channelMap,
  });

  assert.ok(normalized);
  assert.equal(normalized?.channel, "osirskiy");
  assert.equal(normalized?.textOriginal, "frontline update");
  assert.equal(normalized?.datetime, "2026-03-14T12:00:00.000Z");
  assert.equal(normalized?.views, "123");
});

test("normalizeTelegramEventMessage does not advertise media without usable media references", () => {
  const normalized = normalizeTelegramEventMessage({
    event: {
      chat: { username: "osirskiy" },
      message: {
        id: 43,
        message: "caption only",
        date: new Date("2026-03-14T12:05:00.000Z"),
        photo: { _: "photo" },
        media: {
          document: {
            mimeType: "video/mp4",
          },
        },
      },
    },
    channelMap,
  });

  assert.ok(normalized);
  assert.deepEqual(normalized?.media, []);
  assert.equal(normalized?.hasPhoto, false);
  assert.equal(normalized?.hasVideo, false);
});

test("normalizeTelegramEventMessage drops media-only events until collector media transport exists", () => {
  const normalized = normalizeTelegramEventMessage({
    event: {
      chat: { username: "osirskiy" },
      message: {
        id: 44,
        message: "",
        date: new Date("2026-03-14T12:10:00.000Z"),
        photo: { _: "photo" },
      },
    },
    channelMap,
  });

  assert.equal(normalized, null);
});
