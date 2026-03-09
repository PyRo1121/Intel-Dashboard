export type TelegramVerificationState = "verified" | "corroborated" | "single_source" | undefined;
export type TelegramSourceTrustTier = "core" | "verified" | "watch" | undefined;
export type TelegramFreshnessState = "hot" | "warm" | "cool" | "cold";
export type TelegramTrustTier = "High" | "Medium" | "Watch";

type TelegramMessageLike = {
  text_original: string;
  text_en: string;
  image_text_en?: string;
  link: string;
  datetime: string;
  media: Array<{ url: string }>;
};

type TelegramEntryLike = {
  dedupe?: {
    verificationState?: TelegramVerificationState;
    sourceCount?: number;
  };
  message: TelegramMessageLike;
};

export function freshnessStateForAge(ageMs: number): TelegramFreshnessState {
  if (ageMs <= 10 * 60 * 1000) return "hot";
  if (ageMs <= 60 * 60 * 1000) return "warm";
  if (ageMs <= 6 * 60 * 60 * 1000) return "cool";
  return "cold";
}

export function hasUsefulImageText(value: string | undefined): boolean {
  const text = (value || "").trim();
  if (!text) return false;
  return text.toLowerCase() !== "no readable text detected in image.";
}

export function messageText(message: TelegramMessageLike): string {
  return (message.text_en || message.text_original || "").trim();
}

export function mediaUrl(url: string): string {
  const normalized = (url || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return `/media/${normalized}`;
}

export function entryMediaCount(entry: TelegramEntryLike): number {
  return entry.message.media.length;
}

export function countTelegramEntriesWithMedia<TEntry extends TelegramEntryLike>(
  entries: readonly TEntry[],
): number {
  let count = 0;
  for (const entry of entries) {
    if (entryMediaCount(entry) > 0) {
      count += 1;
    }
  }
  return count;
}

export function isVerifiedEntry(entry: TelegramEntryLike): boolean {
  if (entry.dedupe?.verificationState === "verified" || entry.dedupe?.verificationState === "corroborated") {
    return true;
  }
  return (
    (entry.dedupe?.sourceCount ?? 1) >= 2 ||
    entry.message.media.length > 0 ||
    hasUsefulImageText(entry.message.image_text_en)
  );
}

export function countVerifiedTelegramEntries<TEntry extends TelegramEntryLike>(
  entries: readonly TEntry[],
): number {
  let count = 0;
  for (const entry of entries) {
    if (isVerifiedEntry(entry)) {
      count += 1;
    }
  }
  return count;
}

export function freshnessBadgeClass(state: TelegramFreshnessState): string {
  if (state === "hot") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (state === "warm") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (state === "cool") return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

export function trustTierForSignals(args: {
  trustTier?: TelegramSourceTrustTier;
  sourceCount?: number;
}): TelegramTrustTier {
  if (args.trustTier === "core") return "High";
  if (args.trustTier === "verified") return "Medium";
  if (args.trustTier === "watch") return "Watch";
  const sourceCount = args.sourceCount ?? 1;
  if (sourceCount >= 3) return "Medium";
  return "Watch";
}

export function trustBadgeClass(tier: TelegramTrustTier): string {
  if (tier === "High") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (tier === "Medium") return "border-blue-400/30 bg-blue-500/10 text-blue-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

export function verificationLabelForSignals(args: {
  verificationState?: TelegramVerificationState;
  sourceCount?: number;
  hasMedia?: boolean;
  hasUsefulImageText?: boolean;
}): string {
  if (args.verificationState === "verified") return "Cross-confirmed";
  if (args.verificationState === "corroborated") return "Multi-source";
  if (args.verificationState === "single_source") return "Single-source";
  const sourceCount = args.sourceCount ?? 1;
  if (sourceCount >= 3) return "Cross-confirmed";
  if (sourceCount >= 2) return "Multi-source";
  if (args.hasMedia) return "Media-backed";
  if (args.hasUsefulImageText) return "OCR-backed";
  return "Single-source";
}
