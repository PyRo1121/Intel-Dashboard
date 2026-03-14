import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChatHistoryCacheKeyFromLimits,
  collectPersistedChatHistoryEndpoints,
  normalizeChunkStorageBaseKey,
} from "../src/intel-cache-chat-history.ts";

test("buildChatHistoryCacheKeyFromLimits builds canonical chat-history keys", () => {
  assert.equal(
    buildChatHistoryCacheKeyFromLimits(6, 25),
    "/api/chat-history?sessions=6&messages=25",
  );
});

test("normalizeChunkStorageBaseKey strips chunk storage suffixes", () => {
  assert.equal(
    normalizeChunkStorageBaseKey("cache:/api/chat-history?sessions=6&messages=25:meta"),
    "cache:/api/chat-history?sessions=6&messages=25",
  );
  assert.equal(
    normalizeChunkStorageBaseKey("cache:/api/chat-history?sessions=6&messages=25:chunks"),
    "cache:/api/chat-history?sessions=6&messages=25",
  );
  assert.equal(
    normalizeChunkStorageBaseKey("cache:/api/chat-history?sessions=6&messages=25:3"),
    "cache:/api/chat-history?sessions=6&messages=25",
  );
});

test("collectPersistedChatHistoryEndpoints returns unique base chat-history endpoints", () => {
  const endpoints = collectPersistedChatHistoryEndpoints([
    "cache:/api/chat-history?sessions=6&messages=25:meta",
    "cache:/api/chat-history?sessions=6&messages=25:chunks",
    "cache:/api/chat-history?sessions=6&messages=25:0",
    "cache:/api/chat-history?sessions=10&messages=40",
    "cache:/api/intel:meta",
  ]);

  assert.deepEqual(endpoints.sort(), [
    "/api/chat-history?sessions=10&messages=40",
    "/api/chat-history?sessions=6&messages=25",
  ]);
});
