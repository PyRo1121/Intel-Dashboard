import {
  buildTelegramDedupeClusterKey,
  getTelegramDominantCategory,
  getTelegramLegacyEntryKey,
  registerTelegramClusterIndex,
  scoreTelegramDedupeCluster,
} from "./telegram-dedupe-cluster.ts";
import {
  messageMediaSignature,
  normalizeDedupeText,
  tokenizeDedupeText,
} from "./telegram-dedupe.ts";
import { messageText } from "./telegram-entry.ts";
import { parseTimestampMs } from "./utils.ts";

export type TelegramDedupeMessageLike = {
  link: string;
  datetime: string;
  text_original: string;
  text_en: string;
  image_text_en?: string;
  views: string;
  media: Array<{ url: string }>;
};

export type TelegramDedupeEntryLike = {
  category: string;
  channelLabel: string;
  channelUsername: string;
  message: TelegramDedupeMessageLike;
  dedupe?: {
    clusterKey?: string;
    sourceCount?: number;
    duplicateCount?: number;
    sourceLabels?: string[];
    categorySet?: string[];
  };
};

type TelegramDedupeCluster<TEntry extends TelegramDedupeEntryLike> = {
  key: string;
  primary: TEntry;
  canonicalText: string;
  tokenSet: Set<string>;
  mediaSignature: string;
  latestTs: number;
  sourceLabels: Set<string>;
  sourceUsers: Set<string>;
  categories: Map<string, number>;
  aliases: Set<string>;
};

export function dedupeTelegramEntries<TEntry extends TelegramDedupeEntryLike>(
  entries: TEntry[],
  options: {
    mediaWindowMs?: number;
    textWindowMs?: number;
  } = {},
): Array<
  TEntry & {
    dedupe?: {
      clusterKey?: string;
      sourceCount?: number;
      duplicateCount?: number;
      sourceLabels?: string[];
      categorySet?: string[];
    };
  }
> {
  if (entries.length <= 1) return entries;
  const mediaWindowMs = options.mediaWindowMs ?? 6 * 60 * 60 * 1000;
  const textWindowMs = options.textWindowMs ?? 2 * 60 * 60 * 1000;
  const sorted = [...entries].sort(
    (left, right) => parseTimestampMs(right.message.datetime) - parseTimestampMs(left.message.datetime),
  );
  const clusters: TelegramDedupeCluster<TEntry>[] = [];
  const canonicalIndex = new Map<string, number[]>();
  const mediaIndex = new Map<string, number[]>();
  const tokenIndex = new Map<string, number[]>();

  for (const entry of sorted) {
    const msgTs = parseTimestampMs(entry.message.datetime);
    const canonical = normalizeDedupeText(messageText(entry.message));
    const tokens = tokenizeDedupeText(canonical);
    const tokenSet = new Set(tokens);
    const mediaSignature = messageMediaSignature(entry.message);
    const candidateIndexes = new Set<number>();

    for (const index of canonicalIndex.get(canonical) ?? []) candidateIndexes.add(index);
    if (mediaSignature) {
      for (const index of mediaIndex.get(mediaSignature) ?? []) candidateIndexes.add(index);
    }
    for (const token of tokens.slice(0, 8)) {
      if (token.length < 5) continue;
      for (const index of tokenIndex.get(token) ?? []) candidateIndexes.add(index);
    }

    let bestIndex = -1;
    let bestScore = 0;
    for (const candidateIndex of candidateIndexes) {
      const cluster = clusters[candidateIndex];
      if (!cluster) continue;
      const score = scoreTelegramDedupeCluster({
        msgTs,
        msgCanonical: canonical,
        msgTokens: tokenSet,
        msgMediaSignature: mediaSignature,
        cluster,
        mediaWindowMs,
        textWindowMs,
      });
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.82) {
      const cluster = clusters[bestIndex]!;
      cluster.sourceLabels.add(entry.channelLabel);
      if (entry.channelUsername) cluster.sourceUsers.add(entry.channelUsername);
      cluster.categories.set(entry.category, (cluster.categories.get(entry.category) ?? 0) + 1);
      cluster.aliases.add(getTelegramLegacyEntryKey(entry));
      if (msgTs >= cluster.latestTs) {
        cluster.latestTs = msgTs;
        cluster.primary = entry;
      }
      if (canonical.length > cluster.canonicalText.length) {
        cluster.canonicalText = canonical;
      }
      if (!cluster.mediaSignature && mediaSignature) {
        cluster.mediaSignature = mediaSignature;
      }
      for (const token of tokenSet) {
        if (cluster.tokenSet.size >= 120) break;
        cluster.tokenSet.add(token);
      }
      registerTelegramClusterIndex(canonicalIndex, canonical, bestIndex);
      if (mediaSignature) registerTelegramClusterIndex(mediaIndex, mediaSignature, bestIndex);
      for (const token of tokens.slice(0, 8)) {
        if (token.length >= 5) registerTelegramClusterIndex(tokenIndex, token, bestIndex);
      }
      continue;
    }

    const clusterIndex = clusters.length;
    const cluster: TelegramDedupeCluster<TEntry> = {
      key: buildTelegramDedupeClusterKey(entry, canonical, msgTs, mediaSignature),
      primary: entry,
      canonicalText: canonical,
      tokenSet,
      mediaSignature,
      latestTs: msgTs,
      sourceLabels: new Set([entry.channelLabel]),
      sourceUsers: new Set(entry.channelUsername ? [entry.channelUsername] : []),
      categories: new Map([[entry.category, 1]]),
      aliases: new Set([getTelegramLegacyEntryKey(entry)]),
    };
    clusters.push(cluster);
    registerTelegramClusterIndex(canonicalIndex, canonical, clusterIndex);
    if (mediaSignature) registerTelegramClusterIndex(mediaIndex, mediaSignature, clusterIndex);
    for (const token of tokens.slice(0, 8)) {
      if (token.length >= 5) registerTelegramClusterIndex(tokenIndex, token, clusterIndex);
    }
  }

  return clusters
    .sort((left, right) => right.latestTs - left.latestTs)
    .map((cluster) => {
      const sourceLabels = Array.from(cluster.sourceLabels).sort((left, right) => left.localeCompare(right));
      const sourceUsers = cluster.sourceUsers.size > 0 ? cluster.sourceUsers : cluster.sourceLabels;
      const sourceCount = sourceUsers.size;
      const clusterCategories = Array.from(cluster.categories.keys());
      const primary = cluster.primary;
      return {
        ...primary,
        category: getTelegramDominantCategory(cluster.categories, primary.category),
        dedupe: {
          ...primary.dedupe,
          clusterKey: cluster.key,
          sourceCount,
          duplicateCount: Math.max(0, cluster.aliases.size - 1),
          sourceLabels: sourceLabels.slice(0, 24),
          categorySet: clusterCategories,
        },
      };
    }) as Array<
      TEntry & {
        dedupe?: {
          clusterKey?: string;
          sourceCount?: number;
          duplicateCount?: number;
          sourceLabels?: string[];
          categorySet?: string[];
        };
      }
    >;
}
