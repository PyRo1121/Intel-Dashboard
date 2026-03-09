import { fastHash, jaccardSimilarity } from "./telegram-dedupe.ts";

export type TelegramClusterLike = {
  canonicalText: string;
  mediaSignature: string;
  latestTs: number;
  tokenSet: Set<string>;
};

export type TelegramEntryClusterKeyLike = {
  category: string;
  message: {
    link: string;
    datetime: string;
    text_original: string;
  };
};

export function getTelegramLegacyEntryKey(entry: TelegramEntryClusterKeyLike): string {
  return entry.message.link || `${entry.category}:${entry.message.datetime}:${entry.message.text_original.slice(0, 48)}`;
}

export function registerTelegramClusterIndex(map: Map<string, number[]>, key: string, index: number): void {
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    if (existing[existing.length - 1] !== index) existing.push(index);
    return;
  }
  map.set(key, [index]);
}

export function getTelegramDominantCategory(categories: Map<string, number>, fallback: string): string {
  let selected = fallback;
  let best = -1;
  for (const [category, count] of categories.entries()) {
    if (count > best) {
      selected = category;
      best = count;
    }
  }
  return selected;
}

export function scoreTelegramDedupeCluster(args: {
  msgTs: number;
  msgCanonical: string;
  msgTokens: Set<string>;
  msgMediaSignature: string;
  cluster: TelegramClusterLike;
  mediaWindowMs: number;
  textWindowMs: number;
}): number {
  const tsDelta = Math.abs(args.msgTs - args.cluster.latestTs);

  if (
    args.msgMediaSignature &&
    args.cluster.mediaSignature &&
    args.msgMediaSignature === args.cluster.mediaSignature &&
    tsDelta <= args.mediaWindowMs
  ) {
    return 1;
  }

  if (!args.msgCanonical || !args.cluster.canonicalText || tsDelta > args.textWindowMs) {
    return 0;
  }

  if (args.msgCanonical === args.cluster.canonicalText) {
    return 0.98;
  }

  const leftLength = args.msgCanonical.length;
  const rightLength = args.cluster.canonicalText.length;
  const shorter = Math.min(leftLength, rightLength);
  const longer = Math.max(leftLength, rightLength);
  const lengthRatio = longer > 0 ? shorter / longer : 0;
  const contains =
    args.msgCanonical.includes(args.cluster.canonicalText) ||
    args.cluster.canonicalText.includes(args.msgCanonical);

  if (shorter >= 90 && lengthRatio >= 0.72 && contains) {
    return 0.93;
  }

  const similarity = jaccardSimilarity(args.msgTokens, args.cluster.tokenSet);
  if (similarity >= 0.84) return similarity;
  if (similarity >= 0.74 && shorter >= 180) return similarity - 0.01;
  return 0;
}

export function buildTelegramDedupeClusterKey(
  entry: TelegramEntryClusterKeyLike,
  canonicalText: string,
  msgTs: number,
  mediaSignature: string,
): string {
  const seed = canonicalText || mediaSignature || getTelegramLegacyEntryKey(entry);
  const stableTs = Number.isFinite(msgTs) && msgTs > 0 ? msgTs : 0;
  const bucket = Math.floor(stableTs / (30 * 60 * 1000));
  return `cluster_${bucket}_${fastHash(seed.slice(0, 400))}`;
}
