import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTelegramPremiumFeed,
  shouldHideTelegramPremiumNoise,
} from "./telegram-premium-feed.ts";

test("applyTelegramPremiumFeed promotes stronger corroborated entries ahead of raw recency", () => {
  const entries = [
    {
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: {
        rankScore: 61,
        freshnessTier: "breaking" as const,
        verificationState: "single_source" as const,
        sourceCount: 1,
        duplicateCount: 0,
      },
    },
    {
      message: { datetime: "2026-03-09T12:01:00.000Z" },
      dedupe: {
        rankScore: 92,
        freshnessTier: "fresh" as const,
        verificationState: "verified" as const,
        sourceCount: 3,
        duplicateCount: 4,
      },
    },
  ];

  const ranked = applyTelegramPremiumFeed({
    entries,
    signalFirst: true,
    hideNoise: false,
  });

  assert.equal(ranked[0]?.dedupe?.rankScore, 92);
});

test("shouldHideTelegramPremiumNoise removes low-signal stale duplicate chatter", () => {
  assert.equal(
    shouldHideTelegramPremiumNoise({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: {
        rankScore: 58,
        freshnessTier: "watch",
        verificationState: "single_source",
        sourceCount: 1,
        duplicateCount: 2,
      },
    }),
    true,
  );

  assert.equal(
    shouldHideTelegramPremiumNoise({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: {
        rankScore: 88,
        freshnessTier: "breaking",
        verificationState: "verified",
        sourceCount: 3,
        duplicateCount: 5,
      },
    }),
    false,
  );

  assert.equal(
    shouldHideTelegramPremiumNoise({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
    }),
    false,
  );
});
