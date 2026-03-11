import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTelegramSignalGrade,
  createDefaultTelegramSignalProfile,
  createSeededTelegramSignalProfiles,
  isHighSignalTelegramScore,
  resolveTelegramSignalProfileCategory,
} from "../src/telegram-signal-grade.ts";

test("computeTelegramSignalGrade rewards first corroborated core-source events", () => {
  const result = computeTelegramSignalGrade({
    input: {
      averageSourceScore: 88,
      bestSourceScore: 94,
      sourceCount: 6,
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


test("computeTelegramSignalGrade does not award first-report or high-signal for stale watch-tier events", () => {
  const result = computeTelegramSignalGrade({
    input: {
      averageSourceScore: 95,
      bestSourceScore: 98,
      sourceCount: 8,
      duplicateCount: 1,
      trustTier: "core",
      freshnessTier: "watch",
      verificationState: "verified",
      hasMedia: true,
      hasUsefulImageText: false,
      isFirstReport: true,
    },
  });

  assert.ok(result.score < 70);
  assert.equal(result.grade === "A" || result.grade === "B", false);
  assert.equal(result.reasons.includes("first"), false);
});

test("computeTelegramSignalGrade requires at least six sources before first-report credit applies", () => {
  const result = computeTelegramSignalGrade({
    input: {
      averageSourceScore: 88,
      bestSourceScore: 94,
      sourceCount: 5,
      duplicateCount: 1,
      trustTier: "core",
      freshnessTier: "breaking",
      verificationState: "verified",
      hasMedia: true,
      hasUsefulImageText: false,
      isFirstReport: true,
    },
  });

  assert.equal(result.reasons.includes("first"), false);
});


test("resolveTelegramSignalProfileCategory maps categories into grouped profiles", () => {
  assert.equal(resolveTelegramSignalProfileCategory("cyber"), "cyber");
  assert.equal(resolveTelegramSignalProfileCategory("ua_official"), "alerts");
  assert.equal(resolveTelegramSignalProfileCategory("ru_milblog"), "conflict");
  assert.equal(resolveTelegramSignalProfileCategory(""), "default");
});

test("seeded Telegram signal profiles include default, conflict, cyber, and alerts", () => {
  const ids = createSeededTelegramSignalProfiles().map((profile) => profile.profileId);
  assert.deepEqual(ids, ["default", "conflict", "cyber", "alerts"]);
});

test("cyber profile values source quality and corroboration more than first-report speed", () => {
  const profiles = new Map(createSeededTelegramSignalProfiles().map((profile) => [profile.profileId, profile]));
  const conflict = profiles.get("conflict");
  const cyber = profiles.get("cyber");
  assert.ok(conflict && cyber);
  assert.ok((cyber?.weights.sourceQuality ?? 0) > (conflict?.weights.sourceQuality ?? 0));
  assert.ok((cyber?.weights.lead ?? 0) < (conflict?.weights.lead ?? 0));
});
