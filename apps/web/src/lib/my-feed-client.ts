import type { SubscriberFeedPreferences, SubscriberFeedResponse, SubscriberFeedScope } from "@intel-dashboard/shared/subscriber-feed.ts";
import { fetchClientJson } from "./client-json.ts";
import { normalizeSubscriberFeedPreferences } from "./subscriber-feed-preferences.ts";

export async function fetchSubscriberFeed(scope: SubscriberFeedScope, signal?: AbortSignal): Promise<SubscriberFeedResponse | null> {
  const result = await fetchClientJson<SubscriberFeedResponse>(
    `/api/subscriber/my-feed?scope=${encodeURIComponent(scope)}`,
    signal ? { signal } : {},
  );
  return result.ok ? result.data : null;
}

export async function fetchSubscriberFeedPreferences(signal?: AbortSignal): Promise<SubscriberFeedPreferences | null> {
  const result = await fetchClientJson<SubscriberFeedPreferences>(
    "/api/subscriber/feed-preferences",
    signal ? { signal } : {},
  );
  return result.ok ? normalizeSubscriberFeedPreferences(result.data) : null;
}

export async function saveSubscriberFeedPreferences(
  preferences: SubscriberFeedPreferences,
  signal?: AbortSignal,
): Promise<SubscriberFeedPreferences | null> {
  const normalizedPreferences = normalizeSubscriberFeedPreferences(preferences);
  const result = await fetchClientJson<SubscriberFeedPreferences>(
    "/api/subscriber/feed-preferences",
    {
      method: "POST",
      body: JSON.stringify(normalizedPreferences),
      ...(signal ? { signal } : {}),
    },
  );
  return result.ok ? normalizeSubscriberFeedPreferences(result.data) : null;
}
