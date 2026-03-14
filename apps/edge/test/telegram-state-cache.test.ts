import test from "node:test";
import assert from "node:assert/strict";
import {
  LATEST_TELEGRAM_STATE_DO_MAX_LENGTH,
  shouldPersistLatestTelegramStateLocally,
} from "../src/telegram-state-cache.ts";

test("shouldPersistLatestTelegramStateLocally accepts non-empty state strings under the safe cutoff", () => {
  assert.equal(shouldPersistLatestTelegramStateLocally("{}"), true);
  assert.equal(
    shouldPersistLatestTelegramStateLocally("x".repeat(LATEST_TELEGRAM_STATE_DO_MAX_LENGTH)),
    true,
  );
});

test("shouldPersistLatestTelegramStateLocally rejects empty or oversized state strings", () => {
  assert.equal(shouldPersistLatestTelegramStateLocally(""), false);
  assert.equal(
    shouldPersistLatestTelegramStateLocally("x".repeat(LATEST_TELEGRAM_STATE_DO_MAX_LENGTH + 1)),
    false,
  );
});
