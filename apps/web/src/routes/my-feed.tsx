import { createEffect, createResource, createSignal, For, Show } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { BellRing, Clock, ExternalLink, MessageSquare, Radio } from "lucide-solid";
import { useAuth } from "~/lib/auth";
import { resolveAuthUserEntitlementView } from "~/lib/auth-user";
import { fetchSubscriberFeed, fetchSubscriberFeedPreferences, saveSubscriberFeedPreferences } from "~/lib/my-feed-client";
import { formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";
import { useWallClock } from "~/lib/live-refresh";
import type { SubscriberFeedPreferences, SubscriberFeedScope } from "@intel-dashboard/shared/subscriber-feed.ts";
import { MY_FEED_DESCRIPTION, MY_FEED_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import {
  formatSubscriberPreferenceInput,
  normalizeSubscriberFeedPreferences,
  parseSubscriberPreferenceInput,
} from "~/lib/subscriber-feed-preferences";

const SCOPES: SubscriberFeedScope[] = ["all", "favorites", "watched", "telegram", "osint"];

export default function MyFeedPage() {
  const auth = useAuth();
  const entitlement = () => resolveAuthUserEntitlementView(auth.user());
  const entitled = () => entitlement().entitled;
  const [scope, setScope] = createSignal<SubscriberFeedScope>("all");
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal("");
  const [favoriteChannelsInput, setFavoriteChannelsInput] = createSignal("");
  const [favoriteSourcesInput, setFavoriteSourcesInput] = createSignal("");
  const [watchRegionsInput, setWatchRegionsInput] = createSignal("");
  const [watchTagsInput, setWatchTagsInput] = createSignal("");
  const [watchCategoriesInput, setWatchCategoriesInput] = createSignal("");
  const nowMs = useWallClock(1000);

  const [preferences, { refetch: refetchPreferences }] = createResource(
    () => (entitled() ? "enabled" : null),
    () => fetchSubscriberFeedPreferences(),
  );
  const [feed, { refetch: refetchFeed }] = createResource(
    () => (entitled() ? scope() : null),
    (nextScope) => fetchSubscriberFeed(nextScope),
  );

  const items = () => feed()?.items ?? [];
  const loadingInitial = () => isInitialResourceLoading(feed.state, items().length);

  const applyPreferencesToForm = (prefs: SubscriberFeedPreferences | null | undefined) => {
    if (!prefs) return;
    const normalized = normalizeSubscriberFeedPreferences(prefs);
    setFavoriteChannelsInput(formatSubscriberPreferenceInput(normalized.favoriteChannels));
    setFavoriteSourcesInput(formatSubscriberPreferenceInput(normalized.favoriteSources));
    setWatchRegionsInput(formatSubscriberPreferenceInput(normalized.watchRegions));
    setWatchTagsInput(formatSubscriberPreferenceInput(normalized.watchTags));
    setWatchCategoriesInput(formatSubscriberPreferenceInput(normalized.watchCategories));
  };

  createEffect(() => {
    applyPreferencesToForm(preferences());
  });

  const persistPreferences = async () => {
    setSaving(true);
    setSaved("");
    const payload: SubscriberFeedPreferences = normalizeSubscriberFeedPreferences({
      favoriteChannels: parseSubscriberPreferenceInput(favoriteChannelsInput()),
      favoriteSources: parseSubscriberPreferenceInput(favoriteSourcesInput()),
      watchRegions: parseSubscriberPreferenceInput(watchRegionsInput()),
      watchTags: parseSubscriberPreferenceInput(watchTagsInput()),
      watchCategories: parseSubscriberPreferenceInput(watchCategoriesInput()),
    });
    try {
      const savedPrefs = await saveSubscriberFeedPreferences(payload);
      if (!savedPrefs) {
        setSaved("Save failed");
        return;
      }
      applyPreferencesToForm(savedPrefs);
      setSaved("Preferences saved");
      await refetchPreferences();
      await refetchFeed();
    } catch (error) {
      console.error("Failed to save subscriber feed preferences", error);
      setSaved("Failed to save preferences. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Title>{MY_FEED_TITLE}</Title>
      <Meta name="description" content={MY_FEED_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/my-feed")} />
      <Meta property="og:title" content={MY_FEED_TITLE} />
      <Meta property="og:description" content={MY_FEED_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/my-feed")} />
      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <div class="intel-badge mb-2">
              <BellRing size={11} class="text-violet-300" />
              Subscriber Personalized Feed
            </div>
            <h1 class="intel-heading">My Feed</h1>
            <p class="intel-subheading">Combined Telegram and OSINT ranked around your favorites and watched entities.</p>
          </div>
        </header>

        <Show
          when={entitled()}
          fallback={
            <div class="surface-card p-10">
              <h2 class="text-lg font-semibold text-white">Subscriber access required</h2>
              <p class="mt-2 text-sm text-zinc-400">My Feed is only available for owner and subscriber accounts.</p>
            </div>
          }
        >
          <div class="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <section class="surface-card space-y-3 p-4">
              <h2 class="text-sm font-semibold text-white">Preferences</h2>
              <div class="space-y-3 text-sm">
                <label class="block">
                  <span class="mb-1 block text-zinc-400">Favorite Telegram channels</span>
                  <input value={favoriteChannelsInput()} onInput={(event) => setFavoriteChannelsInput(event.currentTarget.value)} class="w-full rounded-sm border border-white/[0.08] bg-black/20 px-3 py-2 text-white" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-zinc-400">Favorite OSINT providers</span>
                  <input value={favoriteSourcesInput()} onInput={(event) => setFavoriteSourcesInput(event.currentTarget.value)} class="w-full rounded-sm border border-white/[0.08] bg-black/20 px-3 py-2 text-white" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-zinc-400">Watched regions</span>
                  <input value={watchRegionsInput()} onInput={(event) => setWatchRegionsInput(event.currentTarget.value)} class="w-full rounded-sm border border-white/[0.08] bg-black/20 px-3 py-2 text-white" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-zinc-400">Watched tags</span>
                  <input value={watchTagsInput()} onInput={(event) => setWatchTagsInput(event.currentTarget.value)} class="w-full rounded-sm border border-white/[0.08] bg-black/20 px-3 py-2 text-white" />
                </label>
                <label class="block">
                  <span class="mb-1 block text-zinc-400">Watched categories</span>
                  <input value={watchCategoriesInput()} onInput={(event) => setWatchCategoriesInput(event.currentTarget.value)} class="w-full rounded-sm border border-white/[0.08] bg-black/20 px-3 py-2 text-white" />
                </label>
                <button type="button" disabled={saving()} onClick={() => void persistPreferences()} class="rounded-sm border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-sm font-medium text-violet-200">
                  {saving() ? "Saving..." : "Save preferences"}
                </button>
                <Show when={saved()}>
                  <p class="text-xs text-zinc-400">{saved()}</p>
                </Show>
              </div>
            </section>

            <section class="space-y-3">
              <div class="surface-card flex flex-wrap items-center gap-2 p-3">
                <For each={SCOPES}>
                  {(entryScope) => (
                    <button
                      type="button"
                      aria-pressed={scope() === entryScope}
                      onClick={() => setScope(entryScope)}
                      class={`rounded-sm border px-3 py-1.5 text-[12px] ${scope() === entryScope ? "border-blue-400/40 bg-blue-500/15 text-blue-200" : "border-white/[0.08] bg-black/20 text-zinc-500"}`}
                    >
                      {entryScope}
                    </button>
                  )}
                </For>
              </div>

              <Show when={!loadingInitial()} fallback={<div class="surface-card p-6 text-sm text-zinc-400">Loading My Feed...</div>}>
                <div class="space-y-2">
                  <For each={items()}>
                    {(item) => (
                      <a href={item.link} target="_blank" rel="noopener noreferrer" class="block surface-card p-4 no-underline">
                        <div class="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                          <span class="rounded-none border border-white/[0.08] bg-black/20 px-2 py-0.5">
                            {item.sourceSurface === "telegram" ? <MessageSquare size={12} class="mr-1 inline" /> : <Radio size={12} class="mr-1 inline" />}
                            {item.sourceSurface}
                          </span>
                          <Show when={item.signalGrade}>
                            <span class="rounded-none border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                              {item.signalGrade} · {item.signalScore}
                            </span>
                          </Show>
                          <Show when={item.favoriteMatch}>
                            <span class="rounded-none border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">Favorite match</span>
                          </Show>
                          <Show when={item.watchMatch}>
                            <span class="rounded-none border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">Watched</span>
                          </Show>
                          <span class="text-zinc-500"><Clock size={12} class="mr-1 inline" />{formatRelativeTimeAt(item.timestamp, nowMs())}</span>
                        </div>
                        <h3 class="text-sm font-medium text-white">{item.title}</h3>
                        <p class="mt-1 text-[12px] text-zinc-400 line-clamp-2">{item.summary}</p>
                        <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span>{item.sourceLabel}</span>
                          <span>·</span>
                          <span>{item.channelOrProvider}</span>
                          <span>·</span>
                          <span>{item.region || "global"}</span>
                          <span class="inline-flex items-center gap-1 text-blue-300">Source <ExternalLink size={11} /></span>
                        </div>
                      </a>
                    )}
                  </For>
                  <Show when={items().length === 0}>
                    <div class="surface-card p-6 text-sm text-zinc-400">No items match the current subscriber feed scope yet.</div>
                  </Show>
                </div>
              </Show>
            </section>
          </div>
        </Show>
      </div>
    </>
  );
}
