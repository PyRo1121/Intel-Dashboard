import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import type { Briefing } from "~/lib/types";
import {
  buildFreshnessStatusAt,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestamp,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { fetchPublicJson } from "~/lib/client-json";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import { formatAgeCompactFromMs, formatLongDateTime, formatShortDateTime } from "~/lib/utils";
import { FileText, ChevronDown, Clock, Send } from "lucide-solid";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { BRIEFINGS_DESCRIPTION, BRIEFINGS_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";

async function loadBriefings(): Promise<Briefing[]> {
  const result = await fetchPublicJson<unknown>("/api/briefings");
  return result.ok && Array.isArray(result.data) ? result.data : [];
}

export default function Briefings() {
  const [briefings, { refetch }] = createResource(loadBriefings, { initialValue: [] as Briefing[] });
  const [expanded, setExpanded] = createSignal<string | null>(null);
  const feedThresholds = { liveMaxMinutes: 240, delayedMaxMinutes: 480 } as const;
  const nowMs = useWallClock(1000);

  useLiveRefresh(() => {
    void refetch();
  }, 120_000, { runImmediately: true });

  const items = () => briefings.latest ?? briefings() ?? [];
  const loadingInitial = () => briefings.state === "refreshing" && items().length === 0;
  const latestBriefingTs = createMemo(() => maxIsoTimestamp(items().map((briefing) => briefing.timestamp)));
  const feedFreshness = createMemo(() =>
    buildFreshnessStatusAt(nowMs(), latestBriefingTs(), feedThresholds, {
      noData: "No briefings",
      live: "On schedule",
      delayed: "Late",
      stale: "Stale",
    }),
  );
  const latestFeedAgeMs = createMemo(() => {
    const ts = latestBriefingTs();
    if (!ts) return null;
    return Math.max(0, nowMs() - ts);
  });
  const latestFeedAgeLabel = createMemo(() => formatAgeCompactFromMs(latestFeedAgeMs()));
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, "Briefing feed");

  const totalEvents = (s: Briefing["severity_summary"]) =>
    s.critical + s.high + s.medium + s.low;

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <>
      <Title>{BRIEFINGS_TITLE}</Title>
      <Meta name="description" content={BRIEFINGS_DESCRIPTION} />
      <Meta property="og:title" content={BRIEFINGS_TITLE} />
      <Meta property="og:description" content={BRIEFINGS_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/briefings")} />
      <Meta property="og:type" content="website" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={BRIEFINGS_TITLE} />
      <Meta name="twitter:description" content={BRIEFINGS_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/briefings")} />
      <div class="intel-page">
      {/* Header */}
      <header class="intel-page-header">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="intel-badge">
              <Send size={11} class="text-emerald-400" />
              Auto-Generated
            </div>
          </div>
          <h1 class="intel-heading">Briefings</h1>
          <p class="intel-subheading">
            AI-generated intelligence briefings delivered every 4 hours via Telegram
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
            Briefings: {feedFreshness().label}
            <Show when={latestFeedAgeMs() !== null}> ({latestFeedAgeLabel()})</Show>
          </span>
          <Show when={items().length > 0}>
            <div class="flex items-center gap-1 p-1 surface-card rounded-2xl">
              <div class="px-3.5 py-2 text-center">
                <p class="text-lg font-bold font-mono-data text-white">{items().length}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Briefings</p>
              </div>
            </div>
          </Show>
        </div>
      </header>

      <Show when={freshnessNotice()}>
        {(notice) => (
          <section
            class={`freshness-transition-banner rounded-2xl border px-4 py-3 text-xs ${freshnessBannerTone(notice().state)} ${notice().phase === "exit" ? "freshness-transition-banner--exit" : ""}`}
            role="status"
            aria-live="polite"
          >
            {notice().message}
          </section>
        )}
      </Show>

      <FeedAccessNotice surface="Briefings" />

      <Show
        when={!loadingInitial()}
        fallback={
          <div class="space-y-3">
            <For each={[1, 2, 3]}>
              {() => (
                <div class="surface-card p-6">
                  <div class="h-5 w-40 bg-white/[0.04] rounded mb-3 animate-shimmer" />
                  <div class="h-1.5 w-full bg-white/[0.04] rounded-full mb-4 animate-shimmer" />
                  <div class="h-4 w-full bg-white/[0.04] rounded mb-2 animate-shimmer" />
                  <div class="h-4 w-5/6 bg-white/[0.04] rounded animate-shimmer" />
                </div>
              )}
            </For>
          </div>
        }
      >
        <Show
          when={items().length > 0}
          fallback={
            <div class="surface-card p-14 text-center">
              <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                <FileText size={28} class="text-emerald-400/50" />
              </div>
              <h3 class="text-sm font-medium text-zinc-400 mb-1">
                No briefings yet
              </h3>
              <p class="text-[12px] text-zinc-600 max-w-md mx-auto">
                Intelligence briefings are generated every 4 hours (0/4/8/12/16/20 UTC) and delivered to Telegram.
                They will appear here once the first briefing cycle completes.
              </p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={items()}>
              {(briefing, idx) => {
                const isExpanded = () => expanded() === briefing.id;
                return (
                  <div
                    class="surface-card transition-all duration-300 cursor-pointer hover:bg-[var(--color-surface-card-hover)] relative overflow-hidden group"
                    onClick={() => toggle(briefing.id)}
                    style={idx() < 10 ? `animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 60}ms` : undefined}
                  >
                    {/* Top severity accent */}
                    <div class={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${
                      briefing.severity_summary.critical > 0 ? "via-red-500/30" :
                      briefing.severity_summary.high > 0 ? "via-amber-500/25" : "via-blue-500/20"
                    }`} />

                    <div class="p-6">
                      {/* Header row */}
                      <div class="flex items-start justify-between gap-4 mb-4">
                        <div class="flex items-center gap-3">
                          <div class="flex items-center gap-1.5">
                            <Clock size={13} class="text-zinc-600" />
                            <span class="text-sm font-semibold font-mono-data text-white">
                              {formatShortDateTime(briefing.timestamp)}
                            </span>
                          </div>
                          <span class="text-[11px] text-zinc-600 font-mono-data">
                            {totalEvents(briefing.severity_summary)} events
                          </span>
                        </div>
                        <div class={`flex items-center justify-center w-7 h-7 rounded-lg text-zinc-600 group-hover:text-zinc-400 transition-all duration-300 ${isExpanded() ? "rotate-180" : ""}`}>
                          <ChevronDown size={16} />
                        </div>
                      </div>

                      {/* Severity bar */}
                      <div class="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3">
                        <Show when={briefing.severity_summary.critical > 0}>
                          <div class="bg-red-500 rounded-l-full" style={`flex: ${briefing.severity_summary.critical}`} />
                        </Show>
                        <Show when={briefing.severity_summary.high > 0}>
                          <div class="bg-amber-500" style={`flex: ${briefing.severity_summary.high}`} />
                        </Show>
                        <Show when={briefing.severity_summary.medium > 0}>
                          <div class="bg-blue-500" style={`flex: ${briefing.severity_summary.medium}`} />
                        </Show>
                        <Show when={briefing.severity_summary.low > 0}>
                          <div class="bg-zinc-600 rounded-r-full" style={`flex: ${briefing.severity_summary.low}`} />
                        </Show>
                      </div>

                      {/* Severity counts */}
                      <div class="flex items-center gap-3 text-[11px] mb-4">
                        <Show when={briefing.severity_summary.critical > 0}>
                          <span class="inline-flex items-center gap-1 text-red-400 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                            {briefing.severity_summary.critical} critical
                          </span>
                        </Show>
                        <Show when={briefing.severity_summary.high > 0}>
                          <span class="inline-flex items-center gap-1 text-amber-400 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {briefing.severity_summary.high} high
                          </span>
                        </Show>
                        <Show when={briefing.severity_summary.medium > 0}>
                          <span class="inline-flex items-center gap-1 text-blue-400">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            {briefing.severity_summary.medium} med
                          </span>
                        </Show>
                        <Show when={briefing.severity_summary.low > 0}>
                          <span class="inline-flex items-center gap-1 text-zinc-500">
                            <span class="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            {briefing.severity_summary.low} low
                          </span>
                        </Show>
                      </div>

                      {/* Content */}
                      <div class={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden ${isExpanded() ? "max-h-[2000px] opacity-100" : "max-h-24 opacity-80"}`}>
                        <p class="text-[13px] text-zinc-400 leading-relaxed whitespace-pre-line">
                          {briefing.content}
                        </p>
                      </div>

                      {/* Expand hint */}
                      <Show when={briefing.content.length > 300 && !isExpanded()}>
                        <div class="mt-3 pt-3 border-t border-white/[0.04]">
                          <span class="text-[11px] text-emerald-400/60 font-medium">Click to expand full briefing</span>
                        </div>
                      </Show>

                      {/* Full date when expanded */}
                      <Show when={isExpanded()}>
                        <div class="mt-4 pt-3 border-t border-white/[0.04]">
                          <span class="text-[11px] text-zinc-700 font-mono-data">{formatLongDateTime(briefing.timestamp)}</span>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>
      </Show>
      </div>
    </>
  );
}
