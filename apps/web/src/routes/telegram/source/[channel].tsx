import { createResource, For, Show, createSignal } from "solid-js";
import { Link, Meta, Title } from "@solidjs/meta";
import { A, useParams } from "@solidjs/router";
import { Clock, ExternalLink, Shield } from "lucide-solid";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import type { TelegramSourceHistoryWindow } from "@intel-dashboard/shared/telegram-source-history.ts";
import { TELEGRAM_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { useAuth } from "~/lib/auth";
import { isAuthUserOwner, resolveAuthUserEntitlementView } from "~/lib/auth-user";
import { useWallClock } from "~/lib/live-refresh";
import { fetchTelegramSourceHistory } from "~/lib/telegram-client";
import { formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";

const WINDOWS: TelegramSourceHistoryWindow[] = ["24h", "7d", "30d"];

export default function TelegramSourceHistoryPage() {
  const params = useParams();
  const auth = useAuth();
  const entitled = () => resolveAuthUserEntitlementView(auth.user()).entitled;
  const owner = () => isAuthUserOwner(auth.user());
  const [window, setWindow] = createSignal<TelegramSourceHistoryWindow>("24h");
  const nowMs = useWallClock(1000);
  const channel = () => (params.channel ?? "").trim().toLowerCase();

  const [history] = createResource(
    () => (entitled() && channel() ? { channel: channel(), window: window() } : null),
    (args) => fetchTelegramSourceHistory(args.channel, args.window),
  );

  const loadingInitial = () => isInitialResourceLoading(history.state, history()?.recentEvents?.length ?? 0);
  const title = () => history()?.source.label || channel() || "Telegram Source";

  return (
    <>
      <Title>{`${title()} — Telegram Source History | Intel Dashboard`}</Title>
      <Meta name="description" content="Subscriber-only Telegram source performance history and owner diagnostics." />
      <Link rel="canonical" href={siteUrl(`/telegram/source/${encodeURIComponent(channel())}`)} />

      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <div class="intel-badge mb-2">
              <Shield size={11} class="text-cyan-300" />
              Telegram Source History
            </div>
            <h1 class="intel-heading">{title()}</h1>
            <p class="intel-subheading">Source performance over time for subscribers, with deeper diagnostics for owners.</p>
          </div>
        </header>

        <Show
          when={entitled()}
          fallback={
            <div class="surface-card p-10">
              <h2 class="text-lg font-semibold text-white">Subscriber access required</h2>
              <p class="mt-2 text-sm text-zinc-400">Telegram source history is only available for owner and subscriber accounts.</p>
            </div>
          }
        >
          <section class="surface-card mb-4 flex flex-wrap items-center gap-2 p-3">
            <For each={WINDOWS}>
              {(entryWindow) => (
                <button
                  type="button"
                  aria-pressed={window() === entryWindow}
                  onClick={() => setWindow(entryWindow)}
                  class={`rounded-xl border px-3 py-1.5 text-[12px] ${window() === entryWindow ? "border-blue-400/40 bg-blue-500/15 text-blue-200" : "border-white/[0.08] bg-black/20 text-zinc-500"}`}
                >
                  {entryWindow}
                </button>
              )}
            </For>
          </section>

          <Show when={!loadingInitial()} fallback={<div class="surface-card p-6 text-sm text-zinc-400">Loading source history...</div>}>
            <Show
              when={history()}
              fallback={<div class="surface-card p-6 text-sm text-zinc-400">No source history is available for this channel yet.</div>}
            >
              {(payload) => (
                <div class="space-y-4">
                  <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Score</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().summary.score}</p>
                      <p class="mt-1 text-xs text-zinc-400">{payload().summary.verdict}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Lead count</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().summary.leadCount}</p>
                      <p class="mt-1 text-xs text-zinc-400">Recent first reports {payload().summary.recentFirstReports}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Average signal</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{payload().summary.averageSignalScore}</p>
                      <p class="mt-1 text-xs text-zinc-400">Trust {payload().source.trustTier}</p>
                    </article>
                    <article class="surface-card p-4">
                      <p class="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Duplicate rate</p>
                      <p class="mt-2 text-2xl font-semibold text-white">{Math.round(payload().summary.duplicateRate * 100)}%</p>
                      <p class="mt-1 text-xs text-zinc-400">
                        <Clock size={11} class="mr-1 inline" />
                        {formatRelativeTimeAt(payload().summary.lastSeenAt, nowMs())}
                      </p>
                    </article>
                  </section>

                  <section class="surface-card p-4">
                    <div class="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <span>{payload().source.channel}</span>
                      <span>·</span>
                      <span>{payload().source.category}</span>
                      <span>·</span>
                      <span>{payload().source.latencyTier}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <For each={payload().summary.topReasons}>
                        {(reason) => (
                          <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">{reason}</span>
                        )}
                      </For>
                    </div>
                  </section>

                  <section class="surface-card p-4">
                    <h2 class="mb-3 text-sm font-semibold text-white">Recent notable events</h2>
                    <Show
                      when={payload().recentEvents.length > 0}
                      fallback={<p class="text-sm text-zinc-400">No notable events in this window.</p>}
                    >
                      <div class="space-y-2">
                        <For each={payload().recentEvents}>
                          {(event) => (
                            <a href={event.link} target="_blank" rel="noopener noreferrer" class="block rounded-xl border border-white/[0.08] bg-black/20 p-3 no-underline">
                              <div class="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                                <Show when={event.signalGrade}>
                                  <span class="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                                    {event.signalGrade} · {event.signalScore}
                                  </span>
                                </Show>
                                <span><Clock size={11} class="mr-1 inline" />{formatRelativeTimeAt(event.datetime, nowMs())}</span>
                              </div>
                              <h3 class="text-sm font-medium text-white">{event.title}</h3>
                              <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                                <For each={event.rankReasons}>
                                  {(reason) => (
                                    <span class="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5">{reason}</span>
                                  )}
                                </For>
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
                          <div><span class="text-zinc-500">Best source score</span><p class="text-white">{diagnostics().bestSourceScore}</p></div>
                          <div><span class="text-zinc-500">Average source score</span><p class="text-white">{diagnostics().averageSourceScore}</p></div>
                          <div><span class="text-zinc-500">Source count seen</span><p class="text-white">{diagnostics().sourceCountSeen}</p></div>
                          <div><span class="text-zinc-500">Lead wins</span><p class="text-white">{diagnostics().leadWins}</p></div>
                          <div><span class="text-zinc-500">Follow-ons</span><p class="text-white">{diagnostics().followOnCount}</p></div>
                          <div><span class="text-zinc-500">Duplicate penalties</span><p class="text-white">{diagnostics().duplicatePenaltyCount}</p></div>
                        </div>
                      </section>
                    )}
                  </Show>

                  <section>
                    <A href="/telegram" class="text-sm text-blue-300">Back to Telegram</A>
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
