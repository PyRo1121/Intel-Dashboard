import assert from "node:assert/strict";
import test from "node:test";
import { buildDefaultCollectorControlState, isStoredCollectorControlState } from "../src/control-state.ts";

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
