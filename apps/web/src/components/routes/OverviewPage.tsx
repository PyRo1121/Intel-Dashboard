import { For, Show, createMemo, createResource } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { TriangleAlert, Radio, Shield, ExternalLink, ArrowUpRight, Activity } from "lucide-solid";
import StatCard from "~/components/ui/StatCard";
import SeverityBadge from "~/components/ui/SeverityBadge";
import { fetchIntelFeed } from "~/lib/intel-feed";
import { readLatestArray } from "~/lib/resource-latest";
import {
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestamp,
  STANDARD_FEED_FRESHNESS_THRESHOLDS,
  useFeedFreshness,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import type { IntelItem } from "~/lib/types";
import { countBySeverity, formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { FREE_FEED_DELAY_MINUTES, PREMIUM_PRICE_USD, TRIAL_DAYS } from "@intel-dashboard/shared/access-offers.ts";
import { OVERVIEW_DESCRIPTION, OVERVIEW_OG_DESCRIPTION, OVERVIEW_TITLE, OVERVIEW_TWITTER_DESCRIPTION } from "@intel-dashboard/shared/route-meta.ts";

export default function OverviewPage(props: { canonicalHref: string }) {
  const [intel, { refetch }] = createResource(fetchIntelFeed, { initialValue: [] as IntelItem[] });
  const feedThresholds = STANDARD_FEED_FRESHNESS_THRESHOLDS;
  const nowMs = useWallClock(1000);

  useLiveRefresh(() => {
    void refetch();
  }, 10_000, { runImmediately: true });

  const intelItems = () => readLatestArray(intel.latest, intel());
  const loadingInitial = () => isInitialResourceLoading(intel.state, intelItems().length);
  const severityCounts = () => countBySeverity(intelItems());
  const latestIntelTs = createMemo(() => maxIsoTimestamp(intelItems().map((item) => item.timestamp)));
  const freshness = useFeedFreshness({
    nowMs,
    latestTimestampMs: latestIntelTs,
    thresholds: feedThresholds,
    subject: "Intel feed",
  });

  return (
    <>
      <Title>{OVERVIEW_TITLE}</Title>
      <Meta name="description" content={OVERVIEW_DESCRIPTION} />
      <Link rel="canonical" href={props.canonicalHref} />
      <Meta property="og:title" content={OVERVIEW_TITLE} />
      <Meta property="og:description" content={OVERVIEW_OG_DESCRIPTION} />
      <Meta property="og:url" content={props.canonicalHref} />
      <Meta name="twitter:title" content={OVERVIEW_TITLE} />
      <Meta name="twitter:description" content={OVERVIEW_TWITTER_DESCRIPTION} />
      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <div class="intel-badge mb-2">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
              Live
            </div>
            <h1 class="intel-heading">Intel Dashboard Overview</h1>
            <p class="intel-subheading">Real-time geopolitical and OSINT monitoring with premium instant delivery.</p>
            <p class="mt-1 text-xs text-zinc-600">{TRIAL_DAYS}-day trial, then ${PREMIUM_PRICE_USD}/month. Free users receive delayed and capped feeds (up to {FREE_FEED_DELAY_MINUTES} minutes).</p>
          </div>
          <div class="flex items-center gap-2">
            <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(freshness.feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              Feed: {freshness.feedFreshness().label}
              <Show when={freshness.latestFeedAgeMs() !== null}> ({freshness.latestFeedAgeLabel()})</Show>
            </span>
            <a href="/osint" class="intel-btn intel-btn-ghost !min-h-9 !px-3 !py-1 text-[12px]">
              Full feed <ArrowUpRight size={14} />
            </a>
          </div>
        </header>

        <Show when={freshness.freshnessNotice()}>
          {(notice) => (
            <output
              class={`freshness-transition-banner rounded-2xl border px-4 py-3 text-xs ${freshnessBannerTone(notice().state)} ${notice().phase === "exit" ? "freshness-transition-banner--exit" : ""}`}
              aria-live="polite"
            >
              {notice().message}
            </output>
          )}
        </Show>

        <FeedAccessNotice surface="OSINT" />

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={<TriangleAlert size={20} />} label="OSINT Events" value={intelItems().length || "-"} accentColor="blue" delay={0} />
          <StatCard icon={<Shield size={20} />} label="Critical" value={severityCounts().critical || "-"} accentColor="red" delay={1} />
          <StatCard icon={<Radio size={20} />} label="High Priority" value={severityCounts().high || "-"} accentColor="amber" delay={2} />
        </div>

        <div>
          <div class="flex items-center gap-3 mb-5">
            <div class="w-1 h-6 rounded-full bg-cyan-500" />
            <div>
              <h2 class="text-lg font-semibold text-white">Recent Intelligence</h2>
              <p class="text-[11px] text-zinc-600">Latest from GDELT, RSS, and OSINT sources</p>
            </div>
          </div>
          <Show
            when={intelItems().length > 0}
            fallback={
              <div class="surface-card p-10 text-center">
                <div class="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <Activity size={24} class="text-blue-400/60" />
                </div>
                <h3 class="text-sm font-medium text-zinc-400 mb-1">{loadingInitial() ? "Loading OSINT data..." : "No intelligence events yet"}</h3>
                <p class="text-[12px] text-zinc-600 max-w-sm mx-auto">{loadingInitial() ? "Live intelligence from geopolitical sources" : "The feed will populate as new indexed events arrive."}</p>
              </div>
            }
          >
            <div class="space-y-2">
              <For each={intelItems().slice(0, 20)}>
                {(item, idx) => (
                  <a
                    href={item.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="block surface-card surface-card-hover p-3 transition-all duration-200 no-underline cursor-pointer group"
                    style={`animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 30}ms`}
                  >
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                          <SeverityBadge severity={item.severity} />
                          <span class="text-[11px] text-zinc-600 uppercase tracking-wider font-semibold">{item.source}</span>
                          <Show when={item.region}>
                            <span class="text-[11px] text-zinc-700">&middot;</span>
                            <span class="text-[11px] text-zinc-600 capitalize">{(item.region || "").replace("_", " ")}</span>
                          </Show>
                        </div>
                        <h3 class="text-sm font-medium text-white leading-snug group-hover:text-blue-50 transition-colors">{item.title}</h3>
                        <Show when={item.summary}>
                          <p class="mt-1 text-[12px] text-zinc-500 line-clamp-2">{item.summary}</p>
                        </Show>
                        <div class="mt-2 flex items-center gap-2 text-[11px] text-zinc-600">
                          <span data-e2e="overview-intel-age">{formatRelativeTimeAt(item.timestamp, nowMs())}</span>
                        </div>
                      </div>
                      <ExternalLink size={14} class="flex-shrink-0 text-zinc-700 group-hover:text-cyan-300 transition-colors" />
                    </div>
                  </a>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
}
