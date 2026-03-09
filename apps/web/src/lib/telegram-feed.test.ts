import test from "node:test";
import assert from "node:assert/strict";
import { getLatestTelegramMessageTimestamp, sortTelegramChannelsByMessageTime } from "./telegram-feed.ts";

test("telegram feed helpers sort messages newest-first and find latest timestamp", () => {
  const channels = sortTelegramChannelsByMessageTime([
    {
      id: "a",
      messages: [
        { datetime: "2026-03-09T11:00:00.000Z" },
        { datetime: "2026-03-09T12:00:00.000Z" },
      ],
    },
    {
      id: "b",
      messages: [{ datetime: "2026-03-09T10:30:00.000Z" }],
    },
  ]);

  assert.equal(channels[0].messages[0]?.datetime, "2026-03-09T12:00:00.000Z");
  assert.equal(
    getLatestTelegramMessageTimestamp(channels),
    Date.UTC(2026, 2, 9, 12, 0, 0),
  );
});
