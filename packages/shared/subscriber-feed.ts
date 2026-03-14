export type SubscriberFeedScope = "all" | "favorites" | "watched" | "telegram" | "osint";

export type SubscriberFeedPreferences = {
  favoriteChannels: string[];
  favoriteSources: string[];
  watchRegions: string[];
  watchTags: string[];
  watchCategories: string[];
  updatedAt?: string;
};

export type SubscriberFeedItem = {
  id: string;
  sourceSurface: "telegram" | "osint";
  timestamp: string;
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
  channelOrProvider: string;
  severity: string;
  region: string;
  tags: string[];
  signalScore: number;
  signalGrade?: string;
  rankReasons: string[];
  favoriteMatch: boolean;
  watchMatch: boolean;
  combinedScore: number;
};

export type SubscriberFeedResponse = {
  preferences: SubscriberFeedPreferences;
  items: SubscriberFeedItem[];
};

export type SubscriberFeedQuery = {
  scope: SubscriberFeedScope;
  limit?: number;
};

export type SubscriberFeedPreferencesPayload = SubscriberFeedPreferences;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(value: unknown): string[] {
  const pushNormalized = (rawValue: unknown, seen: Set<string>, entries: string[]) => {
    if (typeof rawValue !== "string") return;
    for (const part of rawValue.split(/[\n,]+/)) {
      const normalized = normalizeString(part).toLowerCase();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      entries.push(normalized);
    }
  };

  if (!Array.isArray(value)) {
    const seen = new Set<string>();
    const entries: string[] = [];
    pushNormalized(value, seen, entries);
    return entries;
  }

  const seen = new Set<string>();
  const entries: string[] = [];
  for (const item of value) {
    pushNormalized(item, seen, entries);
  }
  return entries;
}

export function normalizeSubscriberFeedPreferencesPayload(value: unknown): SubscriberFeedPreferencesPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const updatedAt = normalizeString(record.updatedAt) || undefined;
  return {
    favoriteChannels: normalizeStringList(record.favoriteChannels),
    favoriteSources: normalizeStringList(record.favoriteSources),
    watchRegions: normalizeStringList(record.watchRegions),
    watchTags: normalizeStringList(record.watchTags),
    watchCategories: normalizeStringList(record.watchCategories),
    ...(updatedAt ? { updatedAt } : {}),
  };
}
