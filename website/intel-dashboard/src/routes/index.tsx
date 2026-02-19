import { For, Show, createResource } from "solid-js";
import { TriangleAlert, Radio, Shield, ExternalLink, ArrowUpRight, Activity } from "lucide-solid";
import StatCard from "~/components/ui/StatCard";
import SeverityBadge from "~/components/ui/SeverityBadge";
import { useLiveRefresh } from "~/lib/live-refresh";
import type { IntelItem } from "~/lib/types";
import { formatRelativeTime } from "~/lib/utils";

async function loadIntel(): Promise<IntelItem[]> {
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

export default function Overview() {
  const [intel, { refetch }] = createResource(loadIntel, { initialValue: [] as IntelItem[] });

  useLiveRefresh(() => {
    void refetch();
  }, 30_000, { runImmediately: false });

  const intelItems = () => intel.latest ?? intel() ?? [];
  const loadingInitial = () => intel.state === "refreshing" && intelItems().length === 0;
  const criticalCount = () => intelItems().filter((i) => i.severity === "critical").length;
  const highCount = () => intelItems().filter((i) => i.severity === "high").length;

  return (
    <div class="space-y-8 animate-fade-in">
      <div class="relative">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5 mb-2">
              <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                <span class="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Live</span>
              </div>
            </div>
            <h1 class="text-3xl font-bold text-white tracking-tight">War Intel Overview</h1>
            <p class="text-sm text-zinc-500 mt-1.5">Real-time geopolitical and OSINT monitoring</p>
          </div>
          <a href="/osint" class="flex items-center gap-1 text-[12px] text-zinc-500 hover:text-emerald-400 transition-colors font-medium">
            Full feed <ArrowUpRight size={14} />
          </a>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard icon={<TriangleAlert size={20} />} label="OSINT Events" value={intelItems().length || "-"} accentColor="blue" delay={0} />
        <StatCard icon={<Shield size={20} />} label="Critical" value={criticalCount() || "-"} accentColor="red" delay={1} />
        <StatCard icon={<Radio size={20} />} label="High Priority" value={highCount() || "-"} accentColor="amber" delay={2} />
      </div>

      <div>
        <div class="flex items-center gap-3 mb-5">
          <div class="w-1 h-6 rounded-full bg-blue-500" />
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
                  class="block surface-card surface-card-hover p-4 transition-all duration-200 no-underline cursor-pointer group"
                  style={`animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 30}ms`}
                >
                  <div class="flex items-start justify-between gap-4">
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
                      <p class="text-[12px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">{item.summary}</p>
                      <div class="inline-flex items-center gap-1 mt-1.5 text-[11px] text-zinc-600 group-hover:text-blue-400 transition-colors">
                        View source <ExternalLink size={10} />
                      </div>
                    </div>
                    <Show when={item.timestamp}>
                      <span class="text-[11px] text-zinc-700 whitespace-nowrap font-mono-data flex-shrink-0">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </Show>
                  </div>
                </a>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  );
}
