import type { SubscriberFeedPreferences } from "@intel-dashboard/shared/subscriber-feed.ts";

export function normalizeSubscriberPreferenceValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
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
