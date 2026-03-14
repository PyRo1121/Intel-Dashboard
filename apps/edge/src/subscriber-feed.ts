import type { SubscriberFeedItem, SubscriberFeedPreferences, SubscriberFeedScope } from "@intel-dashboard/shared/subscriber-feed.ts";
import { matchesOsintSourcePreference } from "@intel-dashboard/shared/osint-source-profile.ts";
export type { SubscriberFeedPreferences };

type TelegramCanonicalEventLike = {
  event_id: string;
  datetime: string;
  category: string;
  domain_tags?: string[];
  source_labels?: string[];
  source_channels?: string[];
  text_en?: string;
  text_original?: string;
  signal_score?: number;
  signal_grade?: string;
  signal_reasons?: string[];
  trust_tier?: string;
  first_reporter_channel?: string;
  first_reporter_label?: string;
  sources?: Array<{ link?: string }>;
};

type IntelItemLike = {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: string;
  category: string;
  severity: string;
};

export function createEmptySubscriberFeedPreferences(): SubscriberFeedPreferences {
  return {
    favoriteChannels: [],
    favoriteSources: [],
    watchRegions: [],
    watchTags: [],
    watchCategories: [],
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
          .filter((entry) => entry.length > 0),
      ),
    ).slice(0, 100);
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry) => entry.length > 0),
      ),
    ).slice(0, 100);
  }
  return [];
}

export function normalizeSubscriberFeedPreferences(value: unknown): SubscriberFeedPreferences {
  if (!value || typeof value !== "object") {
    return createEmptySubscriberFeedPreferences();
  }
  const record = value as Record<string, unknown>;
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt.trim() : undefined;
  return {
    favoriteChannels: normalizeStringArray(record.favoriteChannels),
    favoriteSources: normalizeStringArray(record.favoriteSources),
    watchRegions: normalizeStringArray(record.watchRegions),
    watchTags: normalizeStringArray(record.watchTags),
    watchCategories: normalizeStringArray(record.watchCategories),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function normalizeSubscriberFeedScope(value: string | null | undefined): SubscriberFeedScope {
  if (value === "favorites" || value === "watched" || value === "telegram" || value === "osint") {
    return value;
  }
  return "all";
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function parseTimestampMs(value: string | undefined): number {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function includesNormalized(list: string[], value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized.length > 0 && list.includes(normalized);
}

function intersectsNormalized(list: string[], values: string[] | undefined): boolean {
  if (list.length < 1 || !Array.isArray(values)) return false;
  const normalized = new Set(
    values
      .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
      .filter(Boolean),
  );
  for (const value of list) {
    if (normalized.has(value)) return true;
  }
  return false;
}

export function normalizeTelegramSubscriberFeedItem(
  event: TelegramCanonicalEventLike,
  preferences: SubscriberFeedPreferences,
): SubscriberFeedItem {
  const channel = event.source_channels?.[0] ?? event.first_reporter_channel ?? "";
  const sourceLabel = event.source_labels?.[0] ?? event.first_reporter_label ?? "Telegram";
  const tags = Array.isArray(event.domain_tags) ? event.domain_tags : [];
  const text = [event.text_en, event.text_original]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find((value): value is string => value.length > 0) ?? "";
  const favoriteMatch = includesNormalized(preferences.favoriteChannels, channel);
  const watchMatch =
    includesNormalized(preferences.watchRegions, event.category) ||
    intersectsNormalized(preferences.watchTags, tags) ||
    includesNormalized(preferences.watchCategories, event.category);
  const signalScore = clamp(typeof event.signal_score === "number" ? event.signal_score : 0, 0, 100);
  const combinedScore = clamp(
    signalScore +
      (favoriteMatch ? 18 : 0) +
      (watchMatch ? 10 : 0),
    0,
    100,
  );

  return {
    id: `telegram:${event.event_id}`,
    sourceSurface: "telegram",
    timestamp: event.datetime,
    title: text.slice(0, 180),
    summary: text,
    link: event.sources?.[0]?.link ?? "",
    sourceLabel,
    channelOrProvider: channel,
    severity: event.trust_tier ?? "",
    region: event.category,
    tags,
    signalScore,
    signalGrade: event.signal_grade,
    rankReasons: Array.isArray(event.signal_reasons) ? event.signal_reasons : [],
    favoriteMatch,
    watchMatch,
    combinedScore,
  };
}

export function normalizeOsintSubscriberFeedItem(
  item: IntelItemLike,
  preferences: SubscriberFeedPreferences,
): SubscriberFeedItem {
  const tags = [item.category, item.region].filter(Boolean);
  const favoriteMatch = matchesOsintSourcePreference(preferences.favoriteSources, { name: item.source });
  const watchMatch =
    includesNormalized(preferences.watchRegions, item.region) ||
    includesNormalized(preferences.watchCategories, item.category) ||
    intersectsNormalized(preferences.watchTags, tags);

  const severityBase =
    item.severity === "critical" ? 90 :
    item.severity === "high" ? 78 :
    item.severity === "medium" ? 62 :
    45;
  const combinedScore = clamp(severityBase + (favoriteMatch ? 18 : 0) + (watchMatch ? 10 : 0), 0, 100);

  return {
    id: `osint:${item.url}`,
    sourceSurface: "osint",
    timestamp: item.timestamp,
    title: item.title,
    summary: item.summary,
    link: item.url,
    sourceLabel: item.source,
    channelOrProvider: item.source,
    severity: item.severity,
    region: item.region,
    tags,
    signalScore: severityBase,
    rankReasons: [],
    favoriteMatch,
    watchMatch,
    combinedScore,
  };
}

export function filterSubscriberFeedItems(items: SubscriberFeedItem[], scope: SubscriberFeedScope): SubscriberFeedItem[] {
  if (scope === "favorites") {
    return items.filter((item) => item.favoriteMatch);
  }
  if (scope === "watched") {
    return items.filter((item) => item.watchMatch);
  }
  if (scope === "telegram") {
    return items.filter((item) => item.sourceSurface === "telegram");
  }
  if (scope === "osint") {
    return items.filter((item) => item.sourceSurface === "osint");
  }
  return items;
}

export function sortSubscriberFeedItems(items: SubscriberFeedItem[]): SubscriberFeedItem[] {
  return [...items].sort((left, right) => {
    if (right.combinedScore !== left.combinedScore) return right.combinedScore - left.combinedScore;
    return parseTimestampMs(right.timestamp) - parseTimestampMs(left.timestamp);
  });
}
