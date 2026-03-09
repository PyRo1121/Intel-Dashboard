import { For, Show, createMemo, createSignal, createResource } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { formatTitleLabel } from "~/lib/event-label";
import { fetchOsintItems } from "~/lib/osint-client";
import { readLatestArray } from "~/lib/resource-latest";
import SeverityBadge from "~/components/ui/SeverityBadge";
import {
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestamp,
  STANDARD_FEED_FRESHNESS_THRESHOLDS,
  useFeedFreshness,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import type { IntelItem, Severity } from "~/lib/types";
import { countBySeverity, formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";
import { Radio, ExternalLink, Clock } from "lucide-solid";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { OSINT_DESCRIPTION, OSINT_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";

const FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];

export default function OsintFeed() {
  const [filter, setFilter] = createSignal<Severity | "all">("all");
  const [osint, { refetch }] = createResource(fetchOsintItems, { initialValue: [] as IntelItem[] });
  const feedThresholds = STANDARD_FEED_FRESHNESS_THRESHOLDS;
  const nowMs = useWallClock(1000);

  useLiveRefresh(() => {
    void refetch();
  }, 10_000, { runImmediately: true });

  const items = () => readLatestArray(osint.latest, osint());
  const loadingInitial = () => isInitialResourceLoading(osint.state, items().length);
  const latestIntelTs = createMemo(() => maxIsoTimestamp(items().map((item) => item.timestamp)));
  const freshness = useFeedFreshness({
    nowMs,
    latestTimestampMs: latestIntelTs,
    thresholds: feedThresholds,
    subject: "OSINT feed",
  });
  const filtered = () => {
    const f = filter();
    if (f === "all") return items();
    return items().filter((item) => item.severity === f);
  };

  const seoTitle = OSINT_TITLE;
  const seoDesc = OSINT_DESCRIPTION;

  const severityCounts = () => countBySeverity(items());

  return (
    <>
      <Title>{seoTitle}</Title>
      <Meta name="description" content={seoDesc} />
      <Link rel="canonical" href={siteUrl("/osint")} />
      <Meta property="og:title" content={seoTitle} />
      <Meta property="og:description" content={seoDesc} />
      <Meta property="og:url" content={siteUrl("/osint")} />
      <Meta name="twitter:title" content={seoTitle} />
      <Meta name="twitter:description" content={seoDesc} />
    <div class="intel-page max-w-full overflow-x-clip">
      {/* Header */}
      <header class="intel-page-header max-w-full">
        <div>
          <div class="intel-badge mb-2">
            <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]" />
            Live Feed
          </div>
          <h1 class="intel-heading">OSINT Feed</h1>
          <p class="intel-subheading">
            Open-source intelligence from GDELT, RSS, NOTAMs, and military aircraft tracking
          </p>
        </div>
        <div class="flex w-full xl:w-auto items-center justify-start xl:justify-end gap-2 flex-wrap xl:flex-nowrap">
          <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(freshness.feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
            Feed: {freshness.feedFreshness().label}
            <Show when={freshness.latestFeedAgeMs() !== null}> ({freshness.latestFeedAgeLabel()})</Show>
          </span>
          <Show when={items().length > 0}>
            <div class="grid grid-cols-3 w-full min-w-0 sm:w-auto sm:min-w-[285px] overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03]">
              <div class="px-3.5 py-2 text-center">
                <p class="text-lg font-bold font-mono-data text-white">{items().length}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Events</p>
              </div>
              <div class="px-3.5 py-2 text-center border-l border-white/[0.06]">
                <p class="text-lg font-bold font-mono-data text-red-400">{severityCounts().critical}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Critical</p>
              </div>
              <div class="px-3.5 py-2 text-center border-l border-white/[0.06]">
                <p class="text-lg font-bold font-mono-data text-amber-400">{severityCounts().high}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">High</p>
              </div>
            </div>
          </Show>
        </div>
      </header>

      <Show when={freshness.freshnessNotice()}>
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

      <FeedAccessNotice surface="OSINT" />

      {/* Filter Pills */}
      <div class="intel-toolbar w-full sm:w-fit max-w-full" role="group" aria-label="OSINT severity filters">
        <For each={FILTERS}>
          {(f) => {
            const count = () => f === "all" ? items().length : severityCounts()[f as Severity];
            return (
              <button
                type="button"
                aria-pressed={filter() === f}
                onClick={() => setFilter(f)}
                class={`intel-chip whitespace-nowrap ${
                  filter() === f
                    ? f === "critical" ? "border-red-400/40 bg-red-500/15 text-red-200" :
                      f === "high" ? "border-amber-400/40 bg-amber-500/15 text-amber-200" :
                      f === "medium" ? "border-blue-400/40 bg-blue-500/15 text-blue-200" :
                      "intel-chip-active"
                    : ""
                }`}
              >
                {f === "all" ? "All" : formatTitleLabel(f)}
                <Show when={count() > 0}>
                  <span class="ml-1 opacity-50 text-[10px]">({count()})</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>

      {/* Feed */}
      <Show
        when={!loadingInitial()}
        fallback={
          <div class="space-y-2">
            <For each={[1, 2, 3, 4, 5]}>
              {() => (
                <div class="surface-card p-3">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="h-6 w-20 bg-white/[0.04] rounded-lg animate-shimmer" />
                    <div class="h-4 w-16 bg-white/[0.04] rounded animate-shimmer" />
                  </div>
                  <div class="h-4 w-3/4 bg-white/[0.04] rounded mb-2 animate-shimmer" />
                  <div class="h-3 w-full bg-white/[0.04] rounded animate-shimmer" />
                </div>
              )}
            </For>
          </div>
        }
      >
        <Show
          when={filtered().length > 0}
          fallback={
            <div class="surface-card p-14 text-center">
              <div class="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Radio size={28} class="text-blue-400/50" />
              </div>
              <h3 class="text-sm font-medium text-zinc-400 mb-1">
                {items().length === 0 ? "Awaiting OSINT collection" : "No events match this filter"}
              </h3>
              <p class="text-[12px] text-zinc-600 max-w-sm mx-auto">
                {items().length === 0
                  ? "The intelligence collection cron runs every 15 minutes. Data will appear here automatically."
                  : "Try selecting a different severity filter."}
              </p>
            </div>
          }
        >
          <div class="space-y-2">
            <For each={filtered()}>
              {(item, idx) => (
                <a
                  href={item.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block surface-card surface-card-hover p-3.5 transition-all duration-200 group relative overflow-hidden no-underline cursor-pointer"
                  style={idx() < 20 ? `animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 25}ms` : undefined}
                >
                  {/* Severity accent line */}
                  <div class={`absolute left-0 top-0 bottom-0 w-[2px] ${
                    item.severity === "critical" ? "bg-red-500" :
                    item.severity === "high" ? "bg-amber-500" :
                    item.severity === "medium" ? "bg-blue-500" : "bg-zinc-700"
                  }`} />

                  <div class="flex items-start justify-between gap-4 pl-3">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-2 flex-wrap">
                        <SeverityBadge severity={item.severity} />
                        <span class="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">{item.source}</span>
                        <Show when={item.region}>
                          <span class="text-[11px] text-zinc-700">&middot;</span>
                          <span class="text-[11px] text-zinc-600 capitalize">{(item.region || "").replace("_", " ")}</span>
                        </Show>
                        <Show when={item.category}>
                          <span class="text-[11px] text-zinc-700">&middot;</span>
                          <span class="text-[11px] text-zinc-600 capitalize">{(item.category || "").replace("_", " ")}</span>
                        </Show>
                      </div>
                      <h3 class="text-sm font-medium text-white leading-snug group-hover:text-blue-50 transition-colors [overflow-wrap:anywhere]">{item.title}</h3>
                      <p class="text-[12px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-2 break-words [overflow-wrap:anywhere]">{item.summary}</p>
                      <div class="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-600 group-hover:text-blue-400 transition-colors">
                        View source <ExternalLink size={10} />
                      </div>
                    </div>
                    <Show when={item.timestamp}>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} class="text-zinc-700" />
                        <span data-e2e="osint-item-age" class="text-[11px] text-zinc-700 whitespace-nowrap font-mono-data">
                          {formatRelativeTimeAt(item.timestamp, nowMs())}
                        </span>
                      </div>
                    </Show>
                  </div>
                </a>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
    </>
  );
}
