import { For, Show, createSignal, createResource } from "solid-js";
import SeverityBadge from "~/components/ui/SeverityBadge";
import { useLiveRefresh } from "~/lib/live-refresh";
import type { IntelItem, Severity } from "~/lib/types";
import { formatRelativeTime } from "~/lib/utils";
import { Radio, ExternalLink, Clock } from "lucide-solid";

const FILTERS: (Severity | "all")[] = ["all", "critical", "high", "medium", "low"];

async function loadOsint(): Promise<IntelItem[]> {
  try {
    const res = await fetch("/api/intel", {
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function OsintFeed() {
  const [filter, setFilter] = createSignal<Severity | "all">("all");
  const [osint, { refetch }] = createResource(loadOsint, { initialValue: [] as IntelItem[] });

  useLiveRefresh(() => {
    void refetch();
  }, 30_000, { runImmediately: false });

  const items = () => osint.latest ?? osint() ?? [];
  const loadingInitial = () => osint.state === "refreshing" && items().length === 0;
  const filtered = () => {
    const f = filter();
    if (f === "all") return items();
    return items().filter((item) => item.severity === f);
  };

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
    <div class="space-y-6 animate-fade-in">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div class="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
              <span class="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Live Feed</span>
            </div>
          </div>
          <h1 class="text-3xl font-bold text-white tracking-tight">OSINT Feed</h1>
          <p class="text-sm text-zinc-500 mt-1.5">
            Open-source intelligence from GDELT, RSS, NOTAMs, and military aircraft tracking
          </p>
        </div>
        <Show when={items().length > 0}>
          <div class="flex items-center gap-1 p-1 surface-card rounded-2xl">
            <div class="px-3.5 py-2 text-center">
              <p class="text-lg font-bold font-mono-data text-white">{items().length}</p>
              <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Events</p>
            </div>
            <div class="w-px h-8 bg-white/[0.06]" />
            <div class="px-3.5 py-2 text-center">
              <p class="text-lg font-bold font-mono-data text-red-400">{severityCounts().critical}</p>
              <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Critical</p>
            </div>
            <div class="w-px h-8 bg-white/[0.06]" />
            <div class="px-3.5 py-2 text-center">
              <p class="text-lg font-bold font-mono-data text-amber-400">{severityCounts().high}</p>
              <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">High</p>
            </div>
          </div>
        </Show>
      </div>

      {/* Filter Pills */}
      <div class="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.02] border border-white/[0.04] w-fit">
        <For each={FILTERS}>
          {(f) => {
            const count = () => f === "all" ? items().length : severityCounts()[f as Severity];
            return (
              <button
                onClick={() => setFilter(f)}
                class={`px-3.5 py-2 rounded-xl text-[12px] font-medium transition-all duration-300 ${
                  filter() === f
                    ? f === "critical" ? "bg-red-500/15 text-red-300 shadow-sm" :
                      f === "high" ? "bg-amber-500/15 text-amber-300 shadow-sm" :
                      f === "medium" ? "bg-blue-500/15 text-blue-300 shadow-sm" :
                      "bg-white/[0.08] text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03]"
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
                <div class="surface-card p-5">
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
                  class="block surface-card surface-card-hover p-5 transition-all duration-200 group relative overflow-hidden no-underline cursor-pointer"
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
                      <h3 class="text-sm font-medium text-white leading-snug group-hover:text-blue-50 transition-colors">{item.title}</h3>
                      <p class="text-[12px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">{item.summary}</p>
                      <div class="inline-flex items-center gap-1 mt-2 text-[11px] text-zinc-600 group-hover:text-blue-400 transition-colors">
                        View source <ExternalLink size={10} />
                      </div>
                    </div>
                    <Show when={item.timestamp}>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <Clock size={11} class="text-zinc-700" />
                        <span class="text-[11px] text-zinc-700 whitespace-nowrap font-mono-data">
                          {formatRelativeTime(item.timestamp)}
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
  );
}
