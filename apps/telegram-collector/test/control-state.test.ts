import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDefaultCollectorControlState,
  isStoredCollectorControlState,
  normalizeCollectorControlUpdate,
} from "../src/control-state.ts";

test("isStoredCollectorControlState requires explicit accountId and watchedChannels", () => {
  const fallback = buildDefaultCollectorControlState({
    configured: true,
    missingConfig: [],
    watchedChannels: ["abualiexpress"],
    accountId: "primary",
  });

  assert.equal(
    isStoredCollectorControlState(
      {
        configured: true,
        watchedChannels: ["abualiexpress"],
      },
      fallback,
    ),
    false,
  );

  assert.equal(
    isStoredCollectorControlState(
      {
        accountId: "primary",
        configured: true,
      },
      fallback,
    ),
    false,
  );
});

test("isStoredCollectorControlState requires a valid updatedAt timestamp", () => {
  const fallback = buildDefaultCollectorControlState({
    configured: true,
    missingConfig: [],
    watchedChannels: ["abualiexpress"],
    accountId: "primary",
  });

  assert.equal(
    isStoredCollectorControlState(
      {
        accountId: "primary",
        watchedChannels: ["abualiexpress"],
        updatedAt: "",
      },
      fallback,
    ),
    false,
  );

  assert.equal(
    isStoredCollectorControlState(
      {
        accountId: "primary",
        watchedChannels: ["abualiexpress"],
        updatedAt: "not-a-date",
      },
      fallback,
    ),
    false,
  );
});

test("normalizeCollectorControlUpdate allows explicit null to clear nullable fields", () => {
  const fallback = buildDefaultCollectorControlState({
    configured: true,
    missingConfig: [],
    watchedChannels: ["abualiexpress"],
    accountId: "primary",
  });
  fallback.lastError = "stale";
  fallback.lastEventAt = "2026-03-14T00:00:00.000Z";
  fallback.joinBlockedUntil = "2026-03-14T00:10:00.000Z";

  const normalized = normalizeCollectorControlUpdate(
    {
      accountId: "primary",
      watchedChannels: ["abualiexpress"],
      lastError: null,
      lastEventAt: null,
      joinBlockedUntil: null,
    },
    fallback,
  );

  assert.equal(normalized.lastError, null);
  assert.equal(normalized.lastEventAt, null);
  assert.equal(normalized.joinBlockedUntil, null);
});
