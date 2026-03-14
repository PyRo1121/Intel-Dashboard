import test from "node:test";
import assert from "node:assert/strict";
import { mergeLatestChannelStates } from "../src/telegram-state-merge.ts";

type ChannelState = {
  username: string;
  value: string;
};

test("mergeLatestChannelStates preserves latest untouched channels while overlaying scoped scrape updates", () => {
  const latest = [
    { username: "alpha", value: "latest-alpha" },
    { username: "bravo", value: "latest-bravo" },
    { username: "charlie", value: "latest-charlie" },
  ] satisfies ChannelState[];
  const scopedFallback = [
    { username: "alpha", value: "scrape-alpha" },
    { username: "bravo", value: "stale-bravo" },
    { username: "charlie", value: "stale-charlie" },
  ] satisfies ChannelState[];
  const updated = [{ username: "alpha", value: "fresh-alpha" }] satisfies ChannelState[];

  const merged = mergeLatestChannelStates({
    latestChannels: latest,
    scopedFallbackChannels: scopedFallback,
    scopedUsernames: ["alpha", "bravo"],
    updatedChannels: updated,
  });

  assert.equal(merged.get("alpha")?.value, "fresh-alpha");
  assert.equal(merged.get("bravo")?.value, "stale-bravo");
  assert.equal(merged.get("charlie")?.value, "latest-charlie");
});

test("mergeLatestChannelStates falls back to previous state when no latest snapshot exists", () => {
  const previous = [
    { username: "alpha", value: "prev-alpha" },
    { username: "bravo", value: "prev-bravo" },
  ] satisfies ChannelState[];
  const updated = [{ username: "bravo", value: "collector-bravo" }] satisfies ChannelState[];

  const merged = mergeLatestChannelStates({
    fallbackChannels: previous,
    updatedChannels: updated,
  });

  assert.equal(merged.get("alpha")?.value, "prev-alpha");
  assert.equal(merged.get("bravo")?.value, "collector-bravo");
});
