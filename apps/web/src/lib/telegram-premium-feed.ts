import { parseTimestampMs } from "./utils.ts";

type TelegramPremiumEntryLike = {
  message: {
    datetime: string;
  };
  dedupe?: {
    rankScore?: number;
    subscriberValueScore?: number;
    verificationState?: "verified" | "corroborated" | "single_source";
    freshnessTier?: "breaking" | "fresh" | "watch";
    sourceCount?: number;
    duplicateCount?: number;
  };
};

type TelegramFreshnessTier = "breaking" | "fresh" | "watch" | undefined;
type TelegramVerificationTier = "verified" | "corroborated" | "single_source" | undefined;

function freshnessWeight(value: TelegramFreshnessTier): number {
  if (value === "breaking") return 3;
  if (value === "fresh") return 2;
  return 1;
}

function verificationWeight(value: TelegramVerificationTier): number {
  if (value === "verified") return 3;
  if (value === "corroborated") return 2;
  return 1;
}

export function compareTelegramPremiumEntries<TEntry extends TelegramPremiumEntryLike>(left: TEntry, right: TEntry): number {
  const leftRank = left.dedupe?.rankScore ?? left.dedupe?.subscriberValueScore ?? 0;
  const rightRank = right.dedupe?.rankScore ?? right.dedupe?.subscriberValueScore ?? 0;
  if (rightRank !== leftRank) return rightRank - leftRank;

  const leftFreshness = freshnessWeight(left.dedupe?.freshnessTier);
  const rightFreshness = freshnessWeight(right.dedupe?.freshnessTier);
  if (rightFreshness !== leftFreshness) return rightFreshness - leftFreshness;

  const leftVerification = verificationWeight(left.dedupe?.verificationState);
  const rightVerification = verificationWeight(right.dedupe?.verificationState);
  if (rightVerification !== leftVerification) return rightVerification - leftVerification;

  const leftSourceCount = left.dedupe?.sourceCount ?? 1;
  const rightSourceCount = right.dedupe?.sourceCount ?? 1;
  if (rightSourceCount !== leftSourceCount) return rightSourceCount - leftSourceCount;

  return parseTimestampMs(right.message.datetime) - parseTimestampMs(left.message.datetime);
}

export function shouldHideTelegramPremiumNoise<TEntry extends TelegramPremiumEntryLike>(entry: TEntry): boolean {
  const hasRankSignal =
    typeof entry.dedupe?.rankScore === "number" || typeof entry.dedupe?.subscriberValueScore === "number";
  if (!hasRankSignal) {
    return false;
  }
  const rank = entry.dedupe?.rankScore ?? entry.dedupe?.subscriberValueScore ?? 0;
  const sourceCount = entry.dedupe?.sourceCount ?? 1;
  const duplicateCount = entry.dedupe?.duplicateCount ?? 0;
  const verificationState = entry.dedupe?.verificationState ?? "single_source";
  const freshnessTier = entry.dedupe?.freshnessTier ?? "watch";

  return (
    rank < 74 &&
    sourceCount <= 1 &&
    duplicateCount >= 1 &&
    verificationState === "single_source" &&
    freshnessTier !== "breaking"
  );
}

export function applyTelegramPremiumFeed<TEntry extends TelegramPremiumEntryLike>(args: {
  entries: TEntry[];
  signalFirst: boolean;
  hideNoise: boolean;
}): TEntry[] {
  const filtered = args.hideNoise ? args.entries.filter((entry) => !shouldHideTelegramPremiumNoise(entry)) : args.entries;
  if (!args.signalFirst) {
    return filtered;
  }
  return [...filtered].sort(compareTelegramPremiumEntries);
}
