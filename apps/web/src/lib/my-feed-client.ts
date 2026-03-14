import type {
  SubscriberFeedPreferences,
  SubscriberFeedPreferencesPayload,
  SubscriberFeedResponse,
  SubscriberFeedScope,
} from "@intel-dashboard/shared/subscriber-feed.ts";
import { normalizeSubscriberFeedPreferencesPayload } from "@intel-dashboard/shared/subscriber-feed.ts";
import { fetchClientJson } from "./client-json.ts";

export async function fetchSubscriberFeed(scope: SubscriberFeedScope, signal?: AbortSignal): Promise<SubscriberFeedResponse | null> {
  const result = await fetchClientJson<SubscriberFeedResponse>(
    `/api/subscriber/my-feed?scope=${encodeURIComponent(scope)}`,
    signal ? { signal } : {},
  );
  return result.ok ? result.data : null;
}

export async function fetchSubscriberFeedPreferences(signal?: AbortSignal): Promise<SubscriberFeedPreferences | null> {
  const result = await fetchClientJson<SubscriberFeedPreferencesPayload>(
    "/api/subscriber/feed-preferences",
    signal ? { signal } : {},
  );
  return result.ok ? normalizeSubscriberFeedPreferencesPayload(result.data) : null;
}

export async function saveSubscriberFeedPreferences(
  preferences: SubscriberFeedPreferences,
  signal?: AbortSignal,
): Promise<SubscriberFeedPreferences | null> {
  const result = await fetchClientJson<SubscriberFeedPreferencesPayload>(
    "/api/subscriber/feed-preferences",
    {
      method: "POST",
      body: JSON.stringify(preferences),
      ...(signal ? { signal } : {}),
    },
  );
  return result.ok ? normalizeSubscriberFeedPreferencesPayload(result.data) : null;
}
