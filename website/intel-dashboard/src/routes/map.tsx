import { For, Show, createMemo, createResource, createSignal } from "solid-js";
import { REGION_LABELS, type IntelRegion, type IntelItem } from "~/lib/types";
import {
  buildFreshnessStatus,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestamp,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { useLiveRefresh } from "~/lib/live-refresh";
import SeverityBadge from "~/components/ui/SeverityBadge";
import { formatRelativeTime } from "~/lib/utils";
import { Globe, X as XIcon, MapPin } from "lucide-solid";

interface RegionSummary {
  region: IntelRegion;
  eventCount: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  topItems: IntelItem[];
  lastUpdate: string;
}

const REGION_ORDER: IntelRegion[] = ["middle_east", "ukraine", "europe", "pacific", "us", "global"];

const REGION_COORDS: Record<IntelRegion, { x: number; y: number }> = {
  middle_east: { x: 58, y: 42 },
  ukraine: { x: 54, y: 28 },
  europe: { x: 48, y: 30 },
  pacific: { x: 80, y: 45 },
  us: { x: 22, y: 35 },
  global: { x: 50, y: 60 },
};

function threatLevel(summary: RegionSummary): { label: string; color: string; dotColor: string; bgColor: string } {
  if (summary.critical >= 3) return { label: "CRITICAL", color: "text-red-400", dotColor: "#ef4444", bgColor: "bg-red-500/10" };
  if (summary.critical >= 1 || summary.high >= 3) return { label: "HIGH", color: "text-amber-400", dotColor: "#f59e0b", bgColor: "bg-amber-500/10" };
  if (summary.high >= 1 || summary.medium >= 2) return { label: "ELEVATED", color: "text-blue-400", dotColor: "#3b82f6", bgColor: "bg-blue-500/10" };
  return { label: "LOW", color: "text-zinc-400", dotColor: "#71717a", bgColor: "bg-zinc-500/10" };
}

async function loadIntel(): Promise<IntelItem[]> {
  try {
    const res = await fetch("/api/intel", {
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function buildRegions(items: IntelItem[]): RegionSummary[] {
  const grouped: Record<string, IntelItem[]> = {};
  for (const item of items) {
    const region = item.region || "global";
    if (!grouped[region]) grouped[region] = [];
    grouped[region].push(item);
  }

  return REGION_ORDER.map((region) => {
    const regionItems = grouped[region] ?? [];
    const critical = regionItems.filter((i) => i.severity === "critical").length;
    const high = regionItems.filter((i) => i.severity === "high").length;
    const medium = regionItems.filter((i) => i.severity === "medium").length;
    const low = regionItems.filter((i) => i.severity === "low").length;
    const lastUpdate = regionItems[0]?.timestamp ?? new Date().toISOString();
    const topItems = regionItems.slice(0, 5);
    return { region, eventCount: regionItems.length, critical, high, medium, low, topItems, lastUpdate };
  });
}

export default function ThreatMap() {
  const [intel, { refetch }] = createResource(loadIntel, { initialValue: [] as IntelItem[] });
  const [selectedRegion, setSelectedRegion] = createSignal<IntelRegion | null>(null);
  const feedThresholds = { liveMaxMinutes: 20, delayedMaxMinutes: 90 } as const;

  useLiveRefresh(() => {
    void refetch();
  }, 45_000, { runImmediately: false });

  const intelItems = () => intel.latest ?? intel() ?? [];
  const loadingInitial = () => intel.state === "refreshing" && intelItems().length === 0;
  const regions = () => buildRegions(intelItems());
  const totalEvents = () => intelItems().length;
  const totalCritical = () => regions().reduce((s, r) => s + r.critical, 0);
  const totalHigh = () => regions().reduce((s, r) => s + r.high, 0);
  const latestIntelTs = createMemo(() => maxIsoTimestamp(intelItems().map((item) => item.timestamp)));
  const feedFreshness = createMemo(() => buildFreshnessStatus(latestIntelTs(), feedThresholds));
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, "Threat map feed");

  const selectedSummary = () => {
    const sel = selectedRegion();
    if (!sel) return null;
    return regions().find((r) => r.region === sel) ?? null;
  };

  return (
    <div class="space-y-6 animate-fade-in">
      {/* Header */}
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Globe size={12} class="text-purple-400" />
              <span class="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">Live Map</span>
            </div>
          </div>
          <h1 class="text-3xl font-bold text-white tracking-tight">Threat Map</h1>
          <p class="text-sm text-zinc-500 mt-1.5">Regional threat assessment from live OSINT data</p>
        </div>
        <div class="flex items-center gap-2">
          <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
            Feed: {feedFreshness().label}
            <Show when={feedFreshness().minutes !== null}> ({feedFreshness().minutes}m)</Show>
          </span>
          <Show when={totalEvents() > 0}>
            <div class="flex items-center gap-1 p-1 surface-card rounded-2xl">
              <div class="px-3.5 py-2 text-center">
                <p class="text-lg font-bold font-mono-data text-white">{totalEvents()}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Events</p>
              </div>
              <div class="w-px h-8 bg-white/[0.06]" />
              <div class="px-3.5 py-2 text-center">
                <p class="text-lg font-bold font-mono-data text-red-400">{totalCritical()}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">Critical</p>
              </div>
              <div class="w-px h-8 bg-white/[0.06]" />
              <div class="px-3.5 py-2 text-center">
                <p class="text-lg font-bold font-mono-data text-amber-400">{totalHigh()}</p>
                <p class="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">High</p>
              </div>
            </div>
          </Show>
        </div>
      </div>

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

      <Show
        when={!loadingInitial()}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <For each={[1, 2, 3, 4, 5, 6]}>
              {() => <div class="surface-card p-5"><div class="h-6 w-32 bg-white/[0.04] rounded mb-3 animate-shimmer" /><div class="h-2 w-full bg-white/[0.04] rounded-full mb-3 animate-shimmer" /><div class="h-4 w-24 bg-white/[0.04] rounded animate-shimmer" /></div>}
            </For>
          </div>
        }
      >
        {/* Dot Map */}
        <div class="surface-card p-6 relative overflow-hidden" style="min-height: 340px">
          {/* Grid overlay for visual texture */}
          <div class="absolute inset-0 opacity-[0.02]" style="background-image: radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px); background-size: 20px 20px" />

          <svg viewBox="0 0 100 70" class="w-full h-auto relative z-10" style="max-height: 310px">
            {/* Subtle grid lines */}
            <line x1="0" y1="35" x2="100" y2="35" stroke="rgba(255,255,255,0.02)" stroke-width="0.2" />
            <line x1="50" y1="0" x2="50" y2="70" stroke="rgba(255,255,255,0.02)" stroke-width="0.2" />

            <For each={regions()}>
              {(r) => {
                const coords = REGION_COORDS[r.region];
                const threat = threatLevel(r);
                const isSelected = () => selectedRegion() === r.region;
                const radius = () => Math.max(2.5, Math.min(7, r.eventCount / 4));
                const pulseColor = r.critical > 0 ? "rgba(239,68,68,0.3)" : r.high > 0 ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.2)";

                return (
                  <g
                    onClick={() => setSelectedRegion(isSelected() ? null : r.region)}
                    style="cursor: pointer"
                  >
                    {/* Outer pulse ring */}
                    <Show when={r.critical > 0 || r.high > 0}>
                      <circle cx={coords.x} cy={coords.y} r={radius() + 4} fill="none" stroke={pulseColor} stroke-width="0.5" class="animate-pulse-glow" />
                      <circle cx={coords.x} cy={coords.y} r={radius() + 2} fill={pulseColor} class="animate-pulse-glow" />
                    </Show>

                    {/* Main dot */}
                    <circle
                      cx={coords.x} cy={coords.y} r={radius()}
                      fill={threat.dotColor}
                      stroke={isSelected() ? "white" : "none"}
                      stroke-width={isSelected() ? "0.6" : "0"}
                      opacity="0.9"
                    />

                    {/* Inner glow */}
                    <circle cx={coords.x} cy={coords.y} r={radius() * 0.4} fill="white" opacity="0.3" />

                    {/* Region label */}
                    <text x={coords.x} y={coords.y - radius() - 2} text-anchor="middle" fill="white" font-size="2.8" font-weight="500" opacity="0.6">
                      {REGION_LABELS[r.region]}
                    </text>

                    {/* Event count */}
                    <text x={coords.x} y={coords.y + radius() + 3.5} text-anchor="middle" fill={threat.dotColor} font-size="2.2" font-weight="700" font-family="JetBrains Mono, monospace">
                      {r.eventCount}
                    </text>
                  </g>
                );
              }}
            </For>
          </svg>
        </div>

        {/* Selected Region Detail */}
        <Show when={selectedSummary()}>
          {(summary) => (
            <div class="surface-card p-5 ring-1 ring-white/[0.08] animate-scale-in relative overflow-hidden">
              <div class={`absolute left-0 top-0 bottom-0 w-[3px] ${
                summary().critical > 0 ? "bg-red-500" : summary().high > 0 ? "bg-amber-500" : "bg-blue-500"
              }`} />

              <div class="flex items-center justify-between mb-4 pl-3">
                <div class="flex items-center gap-3">
                  <MapPin size={16} class={threatLevel(summary()).color} />
                  <h3 class="text-lg font-semibold text-white">{REGION_LABELS[summary().region]}</h3>
                  <span class={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${threatLevel(summary()).bgColor} ${threatLevel(summary()).color}`}>
                    {threatLevel(summary()).label}
                  </span>
                </div>
                <button onClick={() => setSelectedRegion(null)} class="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all">
                  <XIcon size={14} />
                </button>
              </div>
              <div class="space-y-2.5 pl-3">
                <For each={summary().topItems}>
                  {(item, idx) => (
                    <div
                      class="flex items-start gap-3"
                      style={`animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 40}ms`}
                    >
                      <SeverityBadge severity={item.severity} />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-white leading-snug">{item.title}</p>
                        <p class="text-[11px] text-zinc-600 mt-0.5">{item.source} &middot; {formatRelativeTime(item.timestamp)}</p>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          )}
        </Show>

        {/* Region Grid */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <For each={regions()}>
            {(r, idx) => {
              const threat = threatLevel(r);
              return (
                <div
                  class={`surface-card surface-card-hover p-5 transition-all duration-300 cursor-pointer relative overflow-hidden ${selectedRegion() === r.region ? "ring-1 ring-white/[0.12]" : ""}`}
                  onClick={() => setSelectedRegion(selectedRegion() === r.region ? null : r.region)}
                  style={`animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 60}ms`}
                >
                  {/* Top accent */}
                  <div class={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent to-transparent ${
                    r.critical > 0 ? "via-red-500/30" : r.high > 0 ? "via-amber-500/30" : "via-blue-500/20"
                  }`} />

                  <div class="flex items-center justify-between mb-3">
                    <div>
                      <h3 class="text-base font-semibold text-white">{REGION_LABELS[r.region]}</h3>
                      <span class={`text-[10px] font-bold uppercase tracking-wider ${threat.color}`}>{threat.label}</span>
                    </div>
                    <span class="text-2xl font-bold font-mono-data text-white/90">{r.eventCount}</span>
                  </div>

                  {/* Severity bar */}
                  <div class="flex gap-0.5 h-2 rounded-full overflow-hidden mb-3">
                    <Show when={r.critical > 0}><div class="bg-red-500 rounded-l-full" style={`flex: ${r.critical}`} /></Show>
                    <Show when={r.high > 0}><div class="bg-amber-500" style={`flex: ${r.high}`} /></Show>
                    <Show when={r.medium > 0}><div class="bg-blue-500" style={`flex: ${r.medium}`} /></Show>
                    <Show when={r.low > 0}><div class="bg-zinc-600 rounded-r-full" style={`flex: ${r.low}`} /></Show>
                  </div>

                  {/* Severity counts */}
                  <div class="flex items-center gap-3 text-[11px]">
                    <Show when={r.critical > 0}><span class="text-red-400 font-medium">{r.critical} critical</span></Show>
                    <Show when={r.high > 0}><span class="text-amber-400 font-medium">{r.high} high</span></Show>
                    <Show when={r.medium > 0}><span class="text-blue-400">{r.medium} med</span></Show>
                    <Show when={r.low > 0}><span class="text-zinc-500">{r.low} low</span></Show>
                  </div>

                  <div class="mt-3 pt-3 border-t border-white/[0.04]">
                    <span class="text-[11px] text-zinc-600 font-mono-data">Latest: {formatRelativeTime(r.lastUpdate)}</span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </div>
  );
}
