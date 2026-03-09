import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTelegramSignalGrade,
  createDefaultTelegramSignalProfile,
  isHighSignalTelegramScore,
} from "../src/telegram-signal-grade.ts";

test("computeTelegramSignalGrade rewards first corroborated core-source events", () => {
  const result = computeTelegramSignalGrade({
    input: {
      averageSourceScore: 88,
      bestSourceScore: 94,
      sourceCount: 3,
      duplicateCount: 1,
      trustTier: "core",
      freshnessTier: "breaking",
      verificationState: "verified",
      hasMedia: true,
      hasUsefulImageText: false,
      isFirstReport: true,
    },
  });

  assert.equal(result.grade, "A");
  assert.ok(result.score >= 85);
  assert.deepEqual(result.reasons, ["first", "multi-source", "core source", "media-backed"]);
});

test("computeTelegramSignalGrade penalizes late single-source duplicate chatter", () => {
  const result = computeTelegramSignalGrade({
    input: {
      averageSourceScore: 52,
      bestSourceScore: 56,
      sourceCount: 1,
      duplicateCount: 3,
      trustTier: "watch",
      freshnessTier: "watch",
      verificationState: "single_source",
      hasMedia: false,
      hasUsefulImageText: false,
      isFirstReport: false,
    },
  });

  assert.equal(result.grade, "D");
  assert.ok(result.score < 55);
});

test("isHighSignalTelegramScore uses the subscriber threshold", () => {
  assert.equal(isHighSignalTelegramScore(70), true);
  assert.equal(isHighSignalTelegramScore(69), false);
});

test("default signal profile thresholds stay stable", () => {
  const profile = createDefaultTelegramSignalProfile();
  assert.deepEqual(profile.thresholds, { a: 85, b: 70, c: 55 });
});
