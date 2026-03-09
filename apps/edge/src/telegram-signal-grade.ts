import type { ChannelConfig } from "./channels";

import { HIGH_SIGNAL_TELEGRAM_SCORE_THRESHOLD } from "@intel-dashboard/shared/telegram-signal.ts";

export type TelegramSignalGrade = "A" | "B" | "C" | "D";

export type TelegramSignalProfileWeights = {
  sourceQuality: number;
  lead: number;
  corroboration: number;
  evidence: number;
  freshness: number;
  penalty: number;
};

export type TelegramSignalThresholds = {
  a: number;
  b: number;
  c: number;
};

export type TelegramSignalProfile = {
  profileId: string;
  category: string | null;
  weights: TelegramSignalProfileWeights;
  thresholds: TelegramSignalThresholds;
};

export type TelegramSignalInput = {
  averageSourceScore: number;
  bestSourceScore: number;
  sourceCount: number;
  duplicateCount: number;
  trustTier: ChannelConfig["trustTier"];
  freshnessTier: "breaking" | "fresh" | "watch";
  verificationState: "verified" | "corroborated" | "single_source";
  hasMedia: boolean;
  hasUsefulImageText: boolean;
  isFirstReport: boolean;
};

export type TelegramSignalBreakdown = {
  sourceQuality: number;
  lead: number;
  corroboration: number;
  evidence: number;
  freshness: number;
  penalty: number;
};

export type TelegramSignalResult = {
  score: number;
  grade: TelegramSignalGrade;
  reasons: string[];
  breakdown: TelegramSignalBreakdown;
};

const DEFAULT_PROFILE: TelegramSignalProfile = {
  profileId: "default",
  category: null,
  weights: {
    sourceQuality: 38,
    lead: 18,
    corroboration: 20,
    evidence: 10,
    freshness: 10,
    penalty: 14,
  },
  thresholds: {
    a: 85,
    b: 70,
    c: 55,
  },
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function normalizeScore(value: number | null | undefined): number {
  return Number.isFinite(value) ? clamp(Number(value), 0, 100) : 0;
}

function normalizeTrustTier(value: ChannelConfig["trustTier"]): number {
  if (value === "core") return 1;
  if (value === "verified") return 0.78;
  return 0.5;
}

function normalizeFreshnessTier(value: TelegramSignalInput["freshnessTier"]): number {
  if (value === "breaking") return 1;
  if (value === "fresh") return 0.65;
  return 0.3;
}

function normalizeVerificationState(value: TelegramSignalInput["verificationState"], sourceCount: number): number {
  if (value === "verified") return 1;
  if (value === "corroborated") return 0.72;
  return sourceCount > 1 ? 0.35 : 0.15;
}

export function createDefaultTelegramSignalProfile(): TelegramSignalProfile {
  return {
    profileId: DEFAULT_PROFILE.profileId,
    category: DEFAULT_PROFILE.category,
    weights: { ...DEFAULT_PROFILE.weights },
    thresholds: { ...DEFAULT_PROFILE.thresholds },
  };
}

export function computeTelegramSignalGrade(args: {
  input: TelegramSignalInput;
  profile?: TelegramSignalProfile | null;
}): TelegramSignalResult {
  const profile = args.profile ?? DEFAULT_PROFILE;
  const sourceQualityFactor =
    clamp(
      normalizeScore(args.input.averageSourceScore) * 0.6 +
        normalizeScore(args.input.bestSourceScore) * 0.4,
      0,
      100,
    ) / 100 * normalizeTrustTier(args.input.trustTier);
  const corroborationFactor =
    clamp((Math.max(0, args.input.sourceCount - 1) / 3) * 0.6 + normalizeVerificationState(args.input.verificationState, args.input.sourceCount) * 0.4, 0, 1);
  const evidenceFactor = clamp(
    (args.input.hasMedia ? 0.75 : 0) + (args.input.hasUsefulImageText ? 0.25 : 0),
    0,
    1,
  );
  const freshnessFactor = normalizeFreshnessTier(args.input.freshnessTier);
  const leadFactor = args.input.isFirstReport ? 1 : 0;
  const penaltyFactor = clamp(
    (args.input.verificationState === "single_source" ? 0.45 : 0) +
      (args.input.duplicateCount > args.input.sourceCount ? 0.25 : 0) +
      (!args.input.hasMedia && !args.input.hasUsefulImageText && args.input.sourceCount <= 1 ? 0.2 : 0),
    0,
    1,
  );

  const breakdown: TelegramSignalBreakdown = {
    sourceQuality: Math.round(profile.weights.sourceQuality * sourceQualityFactor),
    lead: Math.round(profile.weights.lead * leadFactor),
    corroboration: Math.round(profile.weights.corroboration * corroborationFactor),
    evidence: Math.round(profile.weights.evidence * evidenceFactor),
    freshness: Math.round(profile.weights.freshness * freshnessFactor),
    penalty: Math.round(profile.weights.penalty * penaltyFactor),
  };

  const score = clamp(
    breakdown.sourceQuality +
      breakdown.lead +
      breakdown.corroboration +
      breakdown.evidence +
      breakdown.freshness -
      breakdown.penalty,
    0,
    100,
  );

  const reasons: string[] = [];
  if (leadFactor > 0) reasons.push("first");
  if (args.input.sourceCount >= 2) reasons.push("multi-source");
  if (args.input.trustTier === "core") reasons.push("core source");
  if (args.input.hasMedia || args.input.hasUsefulImageText) reasons.push("media-backed");
  if (args.input.freshnessTier === "breaking" || args.input.freshnessTier === "fresh") reasons.push("fresh");

  let grade: TelegramSignalGrade = "D";
  if (score >= profile.thresholds.a) grade = "A";
  else if (score >= profile.thresholds.b) grade = "B";
  else if (score >= profile.thresholds.c) grade = "C";

  return {
    score,
    grade,
    reasons: reasons.slice(0, 4),
    breakdown,
  };
}

export function isHighSignalTelegramScore(score: number | null | undefined): boolean {
  return normalizeScore(score) >= HIGH_SIGNAL_TELEGRAM_SCORE_THRESHOLD;
}
