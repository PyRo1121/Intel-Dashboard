export type TelegramVerificationState = "verified" | "corroborated" | "single_source" | undefined;
export type TelegramTrustTier = "core" | "verified" | "watch" | undefined;
export type TelegramFreshnessState = "hot" | "warm" | "cool" | "cold";
export type TelegramTrustBadgeTier = "High" | "Medium" | "Watch";

export function freshnessStateForAge(ageMs: number): TelegramFreshnessState {
  if (ageMs <= 10 * 60 * 1000) return "hot";
  if (ageMs <= 60 * 60 * 1000) return "warm";
  if (ageMs <= 6 * 60 * 60 * 1000) return "cool";
  return "cold";
}

export function freshnessBadgeClass(state: TelegramFreshnessState): string {
  if (state === "hot") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (state === "warm") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (state === "cool") return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

export function trustTierFromSignals(args: {
  trustTier?: TelegramTrustTier;
  sourceCount?: number;
}): TelegramTrustBadgeTier {
  if (args.trustTier === "core") return "High";
  if (args.trustTier === "verified") return "Medium";
  if (args.trustTier === "watch") return "Watch";
  const sourceCount = args.sourceCount ?? 1;
  if (sourceCount >= 3) return "Medium";
  return "Watch";
}

export function trustBadgeClass(tier: TelegramTrustBadgeTier): string {
  if (tier === "High") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (tier === "Medium") return "border-blue-400/30 bg-blue-500/10 text-blue-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

export function verificationLabelFromSignals(args: {
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

