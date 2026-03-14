import type { SubscriberFeedPreferences } from "@intel-dashboard/shared/subscriber-feed.ts";

export function normalizeSubscriberPreferenceValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeSubscriberPreferenceList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => (typeof entry === "string" ? normalizeSubscriberPreferenceValue(entry) : ""))
          .filter(Boolean),
      ),
    );
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((entry) => normalizeSubscriberPreferenceValue(entry))
          .filter(Boolean),
      ),
    );
  }
  return [];
}

export function normalizeSubscriberFeedPreferences(value: unknown): SubscriberFeedPreferences {
  if (!value || typeof value !== "object") {
    return {
      favoriteChannels: [],
      favoriteSources: [],
      watchRegions: [],
      watchTags: [],
      watchCategories: [],
    };
  }
  const record = value as Record<string, unknown>;
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt.trim() : undefined;
  return {
    favoriteChannels: normalizeSubscriberPreferenceList(record.favoriteChannels),
    favoriteSources: normalizeSubscriberPreferenceList(record.favoriteSources),
    watchRegions: normalizeSubscriberPreferenceList(record.watchRegions),
    watchTags: normalizeSubscriberPreferenceList(record.watchTags),
    watchCategories: normalizeSubscriberPreferenceList(record.watchCategories),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function parseSubscriberPreferenceInput(value: string): string[] {
  return normalizeSubscriberPreferenceList(value);
}

export function formatSubscriberPreferenceInput(values: readonly string[]): string {
  return normalizeSubscriberPreferenceList(values).join(", ");
}

export function toggleSubscriberPreferenceValue(values: string[], rawValue: string): string[] {
  const normalized = normalizeSubscriberPreferenceValue(rawValue);
  if (!normalized) return [...values];
  const current = Array.from(new Set(values.map((value) => normalizeSubscriberPreferenceValue(value)).filter(Boolean)));
  if (current.includes(normalized)) {
    return current.filter((value) => value !== normalized);
  }
  return [...current, normalized].sort((left, right) => left.localeCompare(right));
}

export function includesSubscriberPreferenceValue(values: string[], rawValue: string | null | undefined): boolean {
  const normalized = normalizeSubscriberPreferenceValue(rawValue);
  return normalized.length > 0 && values.map((value) => normalizeSubscriberPreferenceValue(value)).includes(normalized);
}

export function cloneSubscriberFeedPreferences(preferences: SubscriberFeedPreferences | null | undefined): SubscriberFeedPreferences {
  return {
    favoriteChannels: [...(preferences?.favoriteChannels ?? [])],
    favoriteSources: [...(preferences?.favoriteSources ?? [])],
    watchRegions: [...(preferences?.watchRegions ?? [])],
    watchTags: [...(preferences?.watchTags ?? [])],
    watchCategories: [...(preferences?.watchCategories ?? [])],
    ...(preferences?.updatedAt ? { updatedAt: preferences.updatedAt } : {}),
  };
}
