import { For, Show, createMemo, createSignal, createResource } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import SeverityBadge from "~/components/ui/SeverityBadge";
import {
  buildFreshnessStatusAt,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestamp,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import type { IntelItem, Severity } from "~/lib/types";
import { formatAgeCompactFromMs, formatRelativeTimeAt } from "~/lib/utils";
import { Radio, ExternalLink, Clock } from "lucide-solid";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { OSINT_DESCRIPTION, OSINT_TITLE } from "../../shared/route-meta.ts";
import { siteUrl } from "../../shared/site-config.ts";

const FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, entity) => {
      const normalized = String(entity).toLowerCase();
      if (normalized.startsWith("#x")) {
        const code = Number.parseInt(normalized.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      if (normalized.startsWith("#")) {
        const code = Number.parseInt(normalized.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return NAMED_HTML_ENTITIES[normalized] ?? `&${entity};`;
    });
}

function sanitizeIntelText(value: string | undefined): string {
  if (!value) return "";
  let next = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) break;
    next = decoded;
  }
  return next
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimSmart(value: string, maxChars = 360): string {
  if (value.length <= maxChars) return value;
  const sliced = value.slice(0, maxChars);
  const boundary = sliced.lastIndexOf(" ");
  const base = boundary > Math.floor(maxChars * 0.65) ? sliced.slice(0, boundary) : sliced;
  return `${base.trim()}...`;
}

function normalizeSummary(summaryRaw: string, title: string): string {
  let summary = sanitizeIntelText(summaryRaw)
    .replace(/\bThe post .*? appeared first on .*?\.?/gi, "")
    .replace(/\bLatest Updates\b[\s\S]*$/i, "")
    .replace(/\bFollow(?:ing)? .*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title && summary.toLowerCase().startsWith(title.toLowerCase())) {
    summary = summary.slice(title.length).replace(/^[-:;,.–—\s]+/, "").trim();
  }
  return trimSmart(summary || title, 340);
}

function normalizeIntelItem(item: IntelItem): IntelItem {
  const title = trimSmart(sanitizeIntelText(item.title), 180);
  const source = trimSmart(sanitizeIntelText(item.source), 64);
  const summary = normalizeSummary(item.summary, title);
  return { ...item, title, source, summary };
}

async function loadOsint(): Promise<IntelItem[]> {
  try {
    const res = await fetch("/api/intel", {
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data
        .filter((item): item is IntelItem => item && typeof item === "object")
        .map((item) => normalizeIntelItem(item))
      : [];
  } catch {
    return [];
  }
}

export default function OsintFeed() {
  const [filter, setFilter] = createSignal<Severity | "all">("all");
  const [osint, { refetch }] = createResource(loadOsint, { initialValue: [] as IntelItem[] });
  const feedThresholds = { liveMaxMinutes: 20, delayedMaxMinutes: 90 } as const;
  const nowMs = useWallClock(1000);

  useLiveRefresh(() => {
    void refetch();
  }, 10_000, { runImmediately: true });

  const items = () => osint.latest ?? osint() ?? [];
  const loadingInitial = () => osint.state === "refreshing" && items().length === 0;
  const latestIntelTs = createMemo(() => maxIsoTimestamp(items().map((item) => item.timestamp)));
  const feedFreshness = createMemo(() => buildFreshnessStatusAt(nowMs(), latestIntelTs(), feedThresholds));
  const latestFeedAgeMs = createMemo(() => {
    const ts = latestIntelTs();
    if (!ts) return null;
    return Math.max(0, nowMs() - ts);
  });
  const latestFeedAgeLabel = createMemo(() => formatAgeCompactFromMs(latestFeedAgeMs()));
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, "OSINT feed");
  const filtered = () => {
    const f = filter();
    if (f === "all") return items();
    return items().filter((item) => item.severity === f);
  };

  const seoTitle = OSINT_TITLE;
  const seoDesc = OSINT_DESCRIPTION;

  const severityCounts = () => {
    const all = items();
    return {
      critical: all.filter((i) => i.severity === "critical").length,
      high: all.filter((i) => i.severity === "high").length,
      medium: all.filter((i) => i.severity === "medium").length,
      low: all.filter((i) => i.severity === "low").length,
    };
  };

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
          <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
            Feed: {feedFreshness().label}
            <Show when={latestFeedAgeMs() !== null}> ({latestFeedAgeLabel()})</Show>
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
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
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
