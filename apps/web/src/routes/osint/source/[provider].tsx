import { createResource, For, Show, createSignal } from "solid-js";
import { Link, Meta, Title } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { Clock, ExternalLink, Shield } from "lucide-solid";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import { useAuth } from "~/lib/auth";
import { isAuthUserOwner, resolveAuthUserEntitlementView } from "~/lib/auth-user";
import { useWallClock } from "~/lib/live-refresh";
import { fetchSubscriberFeedPreferences, saveSubscriberFeedPreferences } from "~/lib/my-feed-client";
import { fetchOsintSourceProfile } from "~/lib/osint-source-client";
import {
  cloneSubscriberFeedPreferences,
  includesSubscriberPreferenceValue,
  toggleSubscriberPreferenceValue,
} from "~/lib/subscriber-feed-preferences";
import { formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";

export default function OsintSourceProfilePage() {
  const params = useParams();
  const auth = useAuth();
  const entitled = () => resolveAuthUserEntitlementView(auth.user()).entitled;
  const owner = () => isAuthUserOwner(auth.user());
  const [saving, setSaving] = createSignal(false);
  const [controlsSaved, setControlsSaved] = createSignal("");
  const nowMs = useWallClock(1000);
  const provider = () => (params.provider ?? "").trim().toLowerCase();

  const [preferences, { refetch: refetchPreferences }] = createResource(
    () => (entitled() ? "enabled" : null),
    () => fetchSubscriberFeedPreferences(),
  );
  const [profile] = createResource(
    () => (entitled() && provider() ? provider() : null),
    (nextProvider) => fetchOsintSourceProfile(nextProvider),
  );

  const loadingInitial = () => isInitialResourceLoading(profile.state, profile()?.recentItems?.length ?? 0);
  const title = () => profile()?.source.name || provider() || "OSINT Source";
  const favoriteSource = () => includesSubscriberPreferenceValue(preferences()?.favoriteSources ?? [], profile()?.source.name);

  const persistPreferences = async (updater: (current: ReturnType<typeof cloneSubscriberFeedPreferences>) => void) => {
    setSaving(true);
    setControlsSaved("");
    try {
      const next = cloneSubscriberFeedPreferences(preferences());
      updater(next);
      const saved = await saveSubscriberFeedPreferences(next);
      if (!saved) {
        setControlsSaved("Save failed");
        return;
      }
      setControlsSaved("Saved");
      await refetchPreferences();
    } catch (error) {
      console.error("Failed to save provider quick actions", error);
      setControlsSaved("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Title>{`${title()} — OSINT Provider Profile | Intel Dashboard`}</Title>
      <Meta name="description" content="Subscriber-only OSINT provider profile and current-window source history." />
      <Link rel="canonical" href={siteUrl(`/osint/source/${encodeURIComponent(provider())}`)} />

      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <div class="intel-badge mb-2">
              <Shield size={11} class="text-cyan-300" />
              OSINT Provider Profile
            </div>
            <h1 class="intel-heading">{title()}</h1>
            <p class="intel-subheading">Current-window provider profile for subscribers, with deeper catalog diagnostics for owners.</p>
          </div>
        </header>

        <Show
          when={entitled()}
          fallback={
            <div class="surface-card p-10">
              <h2 class="text-lg font-semibold text-white">Subscriber access required</h2>
              <p class="mt-2 text-sm text-zinc-400">OSINT provider profiles are only available for owner and subscriber accounts.</p>
            </div>
          }
        >
          <Show when={!loadingInitial()} fallback={<div class="surface-card p-6 text-sm text-zinc-400">Loading provider profile...</div>}>
            <Show
              when={profile()}
              fallback={<div class="surface-card p-6 text-sm text-zinc-400">No provider profile is available for this source yet.</div>}
            >
              {(payload) => (
                <div class="space-y-4">
                  <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Subscriber value</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().source.subscriberValueScore}</p>
                      <p class="mt-1 text-xs text-zinc-400">{payload().summary.verdict}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Current items</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().summary.currentItemCount}</p>
                      <p class="mt-1 text-xs text-zinc-400">{payload().source.sourceType}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Trust</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().source.trustTier}</p>
                      <p class="mt-1 text-xs text-zinc-400">{payload().source.latencyTier}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Severity mix</p>
                      <p class="mt-2 text-sm font-semibold text-white">
                        C {payload().summary.criticalCount} · H {payload().summary.highCount} · M {payload().summary.mediumCount} · L {payload().summary.lowCount}
                      </p>
                    </article>
                  </section>

                  <section class="surface-card p-4">
                    <div class="flex flex-wrap gap-2 text-[11px] text-zinc-400">
                      <span class="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5">{payload().source.name}</span>
                      <For each={payload().summary.regions}>
                        {(region) => <span class="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5">{region}</span>}
                      </For>
                      <For each={payload().summary.categories}>
                        {(category) => <span class="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5">{category}</span>}
                      </For>
                    </div>
                  </section>

                  <section class="surface-card p-4">
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={saving()}
                        onClick={() => void persistPreferences((next) => {
                          next.favoriteSources = toggleSubscriberPreferenceValue(next.favoriteSources, payload().source.name);
                        })}
                        class={`rounded-xl border px-3 py-2 text-sm ${favoriteSource() ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-white/[0.08] bg-black/20 text-zinc-300"} disabled:opacity-50`}
                      >
                        {favoriteSource() ? "Favorited provider" : "Favorite provider"}
                      </button>
                      <For each={payload().summary.regions}>
                        {(region) => {
                          const active = () => includesSubscriberPreferenceValue(preferences()?.watchRegions ?? [], region);
                          return (
                            <button
                              type="button"
                              disabled={saving()}
                              onClick={() => void persistPreferences((next) => {
                                next.watchRegions = toggleSubscriberPreferenceValue(next.watchRegions, region);
                              })}
                              class={`rounded-xl border px-3 py-2 text-sm ${active() ? "border-blue-400/30 bg-blue-500/10 text-blue-200" : "border-white/[0.08] bg-black/20 text-zinc-300"} disabled:opacity-50`}
                            >
                              {active() ? `Watching ${region}` : `Watch ${region}`}
                            </button>
                          );
                        }}
                      </For>
                      <For each={payload().summary.categories}>
                        {(category) => {
                          const active = () => includesSubscriberPreferenceValue(preferences()?.watchCategories ?? [], category);
                          return (
                            <button
                              type="button"
                              disabled={saving()}
                              onClick={() => void persistPreferences((next) => {
                                next.watchCategories = toggleSubscriberPreferenceValue(next.watchCategories, category);
                              })}
                              class={`rounded-xl border px-3 py-2 text-sm ${active() ? "border-violet-400/30 bg-violet-500/10 text-violet-200" : "border-white/[0.08] bg-black/20 text-zinc-300"} disabled:opacity-50`}
                            >
                              {active() ? `Watching ${category}` : `Watch ${category}`}
                            </button>
                          );
                        }}
                      </For>
                      <Show when={controlsSaved()}>
                        <span class="text-xs text-zinc-400">{controlsSaved()}</span>
                      </Show>
                    </div>
                  </section>

                  <section class="surface-card p-4">
                    <h2 class="mb-3 text-sm font-semibold text-white">Recent items</h2>
                    <Show
                      when={payload().recentItems.length > 0}
                      fallback={<p class="text-sm text-zinc-400">No recent items for this provider in the current live snapshot.</p>}
                    >
                      <div class="space-y-2">
                        <For each={payload().recentItems}>
                          {(item) => (
                            <a href={item.url} target="_blank" rel="noopener noreferrer" class="block rounded-xl border border-white/[0.08] bg-black/20 p-3 no-underline">
                              <div class="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                                <span class="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5">{item.severity || "unknown"}</span>
                                <span><Clock size={11} class="mr-1 inline" />{formatRelativeTimeAt(item.timestamp, nowMs())}</span>
                              </div>
                              <h2 class="text-sm font-medium text-white">{item.title}</h2>
                              <p class="mt-1 text-[12px] text-zinc-400 line-clamp-2">{item.summary}</p>
                              <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                                <span>{item.region}</span>
                                <span>·</span>
                                <span>{item.category}</span>
                                <span class="inline-flex items-center gap-1 text-blue-300">Source <ExternalLink size={11} /></span>
                              </div>
                            </a>
                          )}
                        </For>
                      </div>
                    </Show>
                  </section>

                  <Show when={owner() && payload().ownerDiagnostics}>
                    {(diagnostics) => (
                      <section class="surface-card p-4">
                        <h2 class="mb-3 text-sm font-semibold text-white">Owner diagnostics</h2>
                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm">
                          <div><span class="text-zinc-500">Acquisition</span><p class="text-white">{diagnostics().acquisitionMethod ?? "n/a"}</p></div>
                          <div><span class="text-zinc-500">Scrape risk</span><p class="text-white">{diagnostics().scrapeRisk ?? "n/a"}</p></div>
                          <div><span class="text-zinc-500">Media capability</span><p class="text-white">{diagnostics().mediaCapability.join(", ") || "text"}</p></div>
                        </div>
                      </section>
                    )}
                  </Show>

                  <section>
                    <A href="/osint" class="text-sm text-blue-300">Back to OSINT Feed</A>
                  </section>
                </div>
              )}
            </Show>
          </Show>
        </Show>
      </div>
    </>
  );
}
