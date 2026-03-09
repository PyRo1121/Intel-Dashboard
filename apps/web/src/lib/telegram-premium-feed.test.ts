import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTelegramPremiumFeed,
  isFirstReportTelegramEntry,
  isHighSignalTelegramEntry,
  resolveTelegramPremiumDefaultState,
  shouldHideTelegramPremiumNoise,
} from "./telegram-premium-feed.ts";

test("applyTelegramPremiumFeed promotes stronger corroborated entries ahead of raw recency", () => {
  const entries = [
    {
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: {
        rankScore: 61,
        signalScore: 72,
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
        signalScore: 68,
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

  assert.equal(ranked[0]?.dedupe?.signalScore, 72);
  assert.equal(ranked[0]?.dedupe?.rankScore, 61);
  assert.equal(ranked[1]?.dedupe?.signalScore, 68);
});

test("shouldHideTelegramPremiumNoise removes low-signal stale duplicate chatter", () => {
  assert.equal(
    shouldHideTelegramPremiumNoise({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: {
        rankScore: 58,
        signalScore: 58,
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
        signalScore: 88,
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

test("high signal and first-report helpers use signal metadata", () => {
  assert.equal(
    isHighSignalTelegramEntry({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: { signalScore: 65, signalGrade: "B" },
    }),
    true,
  );
  assert.equal(
    isFirstReportTelegramEntry({
      message: { datetime: "2026-03-09T12:05:00.000Z" },
      dedupe: { signalReasons: ["first", "fresh"] },
    }),
    true,
  );
});

test("telegram premium defaults stay freshness-first", () => {
  assert.deepEqual(resolveTelegramPremiumDefaultState(true), {
    signalFirst: false,
    hideNoise: false,
  });
  assert.deepEqual(resolveTelegramPremiumDefaultState(false), {
    signalFirst: false,
    hideNoise: false,
  });
});
