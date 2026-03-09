import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { Plane, Ship, ExternalLink, Clock, Eye, Navigation, Search, Radio, ChevronUp, ChevronDown, MapPin } from "lucide-solid";
import { getAviationSourceLabel, getAviationSourceNote } from "~/lib/air-sea-aviation";
import { formatTitleLabel } from "~/lib/event-label";
import {
  freshnessPillTone,
  freshnessTooltip,
  freshnessBannerTone,
  useFeedFreshness,
} from "~/lib/freshness";
import { fetchPublicJson } from "~/lib/client-json";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import { formatAgeCompactFromMs, formatRelativeTimeAt, formatNumber, parseTimestampMs } from "~/lib/utils";
import type { Severity } from "~/lib/types";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { AIR_SEA_DESCRIPTION, AIR_SEA_SOCIAL_DESCRIPTION, AIR_SEA_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import "leaflet/dist/leaflet.css";

/* ── Types (matches api/air-sea.ts response) ───────────────────────── */

interface Aircraft {
  icao24: string;
  callsign: string;
  type: string;
  country: string;
  region: string;
  squawk: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  speedKts: number;
  heading: number;
  verticalRateFpm: number;
  onGround: boolean;
  severity: Severity;
  tags: string[];
  description: string;
  links: { adsbexchange?: string; flightradar24?: string };
}

interface IntelReport {
  id: string;
  domain: "air" | "sea";
  category: string;
  channel: string;
  channelUsername: string;
  text: string;
  datetime: string;
  link: string;
  views: string;
  severity: Severity;
  region: string;
  tags: string[];
  media: Array<{ type: string; url: string; thumbnail?: string }>;
}

interface AirSeaPayload {
  timestamp: string;
  aviation: {
    timestamp: string;
    source: string;
    fetchedAtMs: number;
    emergencies: number;
    aircraft: Aircraft[];
  };
  intelFeed: IntelReport[];
  stats: {
    aircraftCount: number;
    airIntelCount: number;
    seaIntelCount: number;
    totalIntel: number;
    critical: number;
    high: number;
  };
}

const EMPTY: AirSeaPayload = {
  timestamp: "",
  aviation: { timestamp: "", source: "", fetchedAtMs: 0, emergencies: 0, aircraft: [] },
  intelFeed: [],
  stats: { aircraftCount: 0, airIntelCount: 0, seaIntelCount: 0, totalIntel: 0, critical: 0, high: 0 },
};

/* ── Category styling (matches telegram.tsx) ───────────────────────── */

const CAT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  ru_milblog: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-300" },
  ua_frontline: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-300" },
  ua_intel: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-300" },
  ua_osint: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-300" },
  en_analysis: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  en_osint: { bg: "bg-lime-500/10", border: "border-lime-500/20", text: "text-lime-300" },
  air_defense: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-300" },
  drone: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300" },
  naval: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-300" },
  satellite: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-300" },
  mapping: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300" },
  israel_milblog: { bg: "bg-blue-400/10", border: "border-blue-400/20", text: "text-blue-200" },
  iran_milblog: { bg: "bg-emerald-600/10", border: "border-emerald-600/20", text: "text-emerald-200" },
  global_osint: { bg: "bg-zinc-400/10", border: "border-zinc-400/20", text: "text-zinc-200" },
  middle_east_osint: { bg: "bg-amber-600/10", border: "border-amber-600/20", text: "text-amber-200" },
  nato_tracking: { bg: "bg-blue-600/10", border: "border-blue-600/20", text: "text-blue-200" },
  nuclear_monitoring: { bg: "bg-red-600/10", border: "border-red-600/20", text: "text-red-200" },
};
const DEFAULT_CAT = { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-300" };
function catStyle(cat: string) { return CAT_STYLE[cat] ?? DEFAULT_CAT; }

/* ── Tag styling ───────────────────────────────────────────────────── */

const TAG_COLORS: Record<string, string> = {
  drone: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  missile: "bg-red-500/15 text-red-300 border-red-500/25",
  "air-defense": "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "naval-major": "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  strike: "bg-orange-500/15 text-orange-300 border-orange-500/25",
};

/* ── Severity helpers ──────────────────────────────────────────────── */

function sevDot(s: Severity): string {
  if (s === "critical") return "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]";
  if (s === "high") return "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]";
  if (s === "medium") return "bg-blue-400";
  return "bg-zinc-500";
}

function sevBadge(s: Severity): string {
  if (s === "critical") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "high") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "medium") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
}

function sevMapColor(s: Severity): string {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f59e0b";
  if (s === "medium") return "#3b82f6";
  return "#71717a";
}

function regionLabel(r: string): string { return formatTitleLabel(r, "—"); }

function parseViews(v: string): number {
  const upper = v.replace(/,/g, "").trim().toUpperCase();
  const m = upper.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);
  if (!m) return Number.parseInt(upper.replace(/[^0-9]/g, ""), 10) || 0;
  const base = Number.parseFloat(m[1]);
  if (m[2] === "K") return Math.round(base * 1000);
  if (m[2] === "M") return Math.round(base * 1_000_000);
  if (m[2] === "B") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

/* ── Data loader ───────────────────────────────────────────────────── */

async function loadAirSea(): Promise<AirSeaPayload> {
  const result = await fetchPublicJson<AirSeaPayload>("/api/air-sea");
  return result.ok ? result.data : EMPTY;
}

/* ── Component ─────────────────────────────────────────────────────── */

export default function AirSeaOps() {
  const [payload, { refetch }] = createResource(loadAirSea, { initialValue: EMPTY });
  const feedThresholds = { liveMaxMinutes: 15, delayedMaxMinutes: 60 } as const;

  const [domainFilter, setDomainFilter] = createSignal<"all" | "air" | "sea">("all");
  const [sevFilter, setSevFilter] = createSignal<"all" | Severity>("all");
  const [query, setQuery] = createSignal("");
  const [showCount, setShowCount] = createSignal(60);
  const [selectedAircraft, setSelectedAircraft] = createSignal<string | null>(null);

  // Leaflet refs
  let mapEl: HTMLDivElement | undefined;
  let map: import("leaflet").Map | null = null;
  let L: typeof import("leaflet") | null = null;
  let markerLayer: import("leaflet").LayerGroup | null = null;
  const [mapReady, setMapReady] = createSignal(false);
  const nowMs = useWallClock(1000);

  useLiveRefresh(() => void refetch(), 35_000, { runImmediately: true });

  const data = () => payload.latest ?? payload() ?? EMPTY;
  const aircraft = () => data().aviation.aircraft;
  const stats = () => data().stats;

  const latestFeedTs = createMemo(() => parseTimestampMs(data().timestamp || ""));
  const freshness = useFeedFreshness({
    nowMs,
    latestTimestampMs: latestFeedTs,
    thresholds: feedThresholds,
    subject: "Air/Sea feed",
    labels: { noData: "Unknown" },
  });
  const aviationSnapshotAgeMs = createMemo(() => {
    const fetchedAtMs = data().aviation.fetchedAtMs;
    if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0) return null;
    return Math.max(0, nowMs() - fetchedAtMs);
  });
  const aviationSnapshotAgeLabel = createMemo(() => formatAgeCompactFromMs(aviationSnapshotAgeMs()));

  // Filtered intel feed
  const filteredFeed = createMemo(() => {
    const q = query().trim().toLowerCase();
    return data().intelFeed.filter((r) => {
      if (domainFilter() !== "all" && r.domain !== domainFilter()) return false;
      if (sevFilter() !== "all" && r.severity !== sevFilter()) return false;
      if (q && !r.text.toLowerCase().includes(q) && !r.channel.toLowerCase().includes(q) && !r.tags.some((t) => t.includes(q))) return false;
      return true;
    });
  });

  const visibleFeed = createMemo(() => filteredFeed().slice(0, showCount()));

  // Map setup
  onMount(async () => {
    const leaflet = await import("leaflet");
    L = leaflet;
    if (!mapEl) return;

    map = leaflet.map(mapEl, {
      center: [48, 14],
      zoom: 4,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: false,
    });

    leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    markerLayer = leaflet.layerGroup().addTo(map);

    window.setTimeout(() => map?.invalidateSize(), 0);
    setMapReady(true);

    onCleanup(() => {
      map?.remove();
      map = null;
      markerLayer = null;
      L = null;
      setMapReady(false);
    });
  });

  // Update map markers when aircraft change
  createEffect(() => {
    if (!mapReady() || !L || !map || !markerLayer) return;
    markerLayer.clearLayers();
    map.invalidateSize();

    const acList = aircraft();
    if (acList.length === 0) return;

    for (const ac of acList) {
      const isSelected = selectedAircraft() === ac.icao24;
      const color = sevMapColor(ac.severity);
      const radius = isSelected ? 9 : 6;

      // Glow ring for selected
      if (isSelected) {
        L.circleMarker([ac.latitude, ac.longitude], {
          radius: 14,
          color,
          weight: 0,
          fillColor: color,
          fillOpacity: 0.15,
        }).addTo(markerLayer!);
      }

      const marker = L.circleMarker([ac.latitude, ac.longitude], {
        radius,
        color: isSelected ? "#ffffff" : color,
        weight: isSelected ? 2.5 : 1.5,
        fillColor: color,
        fillOpacity: isSelected ? 0.95 : 0.85,
      });

      const tip = `<div style="font-weight:700;font-family:monospace;font-size:13px">${ac.callsign}</div>` +
        `<div style="opacity:0.7;font-size:11px">${ac.type}</div>` +
        `<div style="opacity:0.6;font-size:10px">FL${Math.round(ac.altitudeFt / 100)} &bull; ${Math.round(ac.speedKts)}kts &bull; ${Math.round(ac.heading)}&deg;</div>`;

      marker
        .bindTooltip(tip, { direction: "top", opacity: 0.95, className: "intel-map-tooltip" })
        .on("click", () => {
          setSelectedAircraft(ac.icao24);
          map?.panTo([ac.latitude, ac.longitude], { animate: true, duration: 0.35 });
        })
        .addTo(markerLayer!);

      // Heading indicator line
      if (ac.speedKts > 10 && !ac.onGround) {
        const radians = (ac.heading * Math.PI) / 180;
        const len = 0.3 + (ac.speedKts / 600) * 0.5;
        const endLat = ac.latitude + Math.cos(radians) * len;
        const endLon = ac.longitude + Math.sin(radians) * len;
        L.polyline([[ac.latitude, ac.longitude], [endLat, endLon]], {
          color,
          weight: 1.5,
          opacity: 0.5,
          dashArray: "4 3",
        }).addTo(markerLayer!);
      }
    }

    // Fit bounds if not manually panned
    if (!selectedAircraft() && acList.length > 1) {
      const bounds = L.latLngBounds(acList.map((ac) => [ac.latitude, ac.longitude]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
    }
  });

  return (
    <>
      <Title>{AIR_SEA_TITLE}</Title>
      <Meta name="description" content={AIR_SEA_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/air-sea")} />
      <Meta property="og:title" content={AIR_SEA_TITLE} />
      <Meta property="og:description" content={AIR_SEA_SOCIAL_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/air-sea")} />
      <Meta name="twitter:title" content={AIR_SEA_TITLE} />
      <Meta name="twitter:description" content={AIR_SEA_SOCIAL_DESCRIPTION} />
    <div class="intel-page">
      {/* ── Header ──────────────────────────────────────────────── */}
      <header class="intel-page-header">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="intel-badge">
              <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] animate-pulse" />
              Live Feed
            </div>
            <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(freshness.feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              {freshness.feedFreshness().label}
              <Show when={freshness.latestFeedAgeMs() !== null}> ({freshness.latestFeedAgeLabel()})</Show>
            </span>
          </div>
          <h1 class="intel-heading">Air / Sea Ops</h1>
          <p class="intel-subheading">Military aircraft tracking plus air/sea milblogger intelligence from a broad Telegram source network.</p>
        </div>

        <Show when={stats().totalIntel > 0 || stats().aircraftCount > 0}>
          <div class="intel-kpi-strip">
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-cyan-300">{stats().aircraftCount}</p>
              <p class="intel-kpi-label">Aircraft</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-blue-300">{stats().airIntelCount}</p>
              <p class="intel-kpi-label">Air Intel</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-emerald-300">{stats().seaIntelCount}</p>
              <p class="intel-kpi-label">Sea Intel</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-red-400">{stats().critical}</p>
              <p class="intel-kpi-label">Critical</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-amber-400">{stats().high}</p>
              <p class="intel-kpi-label">High</p>
            </div>
          </div>
        </Show>
      </header>

      {/* Freshness notice */}
      <Show when={freshness.freshnessNotice()}>
        {(notice) => (
          <section
            class={`rounded-2xl border px-4 py-3 text-xs ${freshnessBannerTone(notice().state)} ${notice().phase === "exit" ? "freshness-transition-banner--exit" : ""}`}
            role="status"
            aria-live="polite"
          >
            {notice().message}
          </section>
        )}
      </Show>

      <FeedAccessNotice surface="Air-Sea" />

      {/* ── Aircraft Tracker ────────────────────────────────────── */}
      <section class="surface-card overflow-hidden">
        <div class="flex items-center gap-2 px-4 pt-4 pb-2">
          <Plane size={15} class="text-cyan-400" />
          <h2 class="text-sm font-semibold text-white uppercase tracking-wider">Military Aircraft Tracker</h2>
          <span class="ml-auto text-[10px] text-zinc-600 font-mono-data">
            Source: {getAviationSourceLabel(data().aviation.source)}
            <Show when={aviationSnapshotAgeMs() !== null}> &bull; snapshot age {aviationSnapshotAgeLabel()}</Show>
            {" • "}
            {data().aviation.timestamp || "n/a"}
          </span>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[1fr_380px]">
          {/* Map */}
          <div class="relative">
            <div ref={mapEl} class="h-[350px] w-full" />
            <div class="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-zinc-400 font-mono-data">
              {aircraft().length} aircraft &bull; real ADS-B positions
            </div>
            <Show when={data().aviation.emergencies > 0}>
              <div class="pointer-events-none absolute top-3 right-3 z-[500] rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1.5 text-[11px] text-red-300 font-semibold animate-pulse">
                {data().aviation.emergencies} EMERGENCY SQUAWK
              </div>
            </Show>
          </div>

          {/* Aircraft list */}
          <div class="border-l border-white/[0.06] max-h-[350px] overflow-y-auto">
            <Show
              when={aircraft().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Plane size={28} class="text-zinc-700 mb-2" />
                  <p class="text-sm text-zinc-500">No military aircraft currently tracked</p>
                  <p class="text-xs text-zinc-700 mt-1">{getAviationSourceNote(data().aviation.source)}</p>
                </div>
              }
            >
              <For each={aircraft()}>
                {(ac) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAircraft(ac.icao24);
                      if (map) map.panTo([ac.latitude, ac.longitude], { animate: true, duration: 0.35 });
                    }}
                    class={`w-full text-left px-4 py-3 border-b border-white/[0.04] transition-colors ${selectedAircraft() === ac.icao24 ? "bg-cyan-500/[0.06]" : "hover:bg-white/[0.03]"}`}
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class={`h-2 w-2 rounded-full shrink-0 ${sevDot(ac.severity)}`} />
                        <span class="font-mono-data text-sm font-bold text-white truncate">{ac.callsign}</span>
                        <span class={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${sevBadge(ac.severity)}`}>{ac.type}</span>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <Show when={ac.links.adsbexchange}>
                          <a href={ac.links.adsbexchange} target="_blank" rel="noopener noreferrer" class="text-zinc-600 hover:text-cyan-400 transition" onClick={(e) => e.stopPropagation()} title="ADS-B Exchange">
                            <MapPin size={12} />
                          </a>
                        </Show>
                        <Show when={ac.links.flightradar24}>
                          <a href={ac.links.flightradar24} target="_blank" rel="noopener noreferrer" class="text-zinc-600 hover:text-cyan-400 transition" onClick={(e) => e.stopPropagation()} title="FlightRadar24">
                            <ExternalLink size={12} />
                          </a>
                        </Show>
                      </div>
                    </div>
                    <div class="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                      <Show when={!ac.onGround} fallback={<span class="text-amber-400/70">On Ground</span>}>
                        <span class="font-mono-data">FL{Math.round(ac.altitudeFt / 100).toString().padStart(3, "0")}</span>
                        <span class="font-mono-data">{Math.round(ac.speedKts)}kts</span>
                        <span class="font-mono-data">{Math.round(ac.heading)}°</span>
                        <Show when={ac.verticalRateFpm !== 0}>
                          <span class="inline-flex items-center gap-0.5">
                            {ac.verticalRateFpm > 0 ? <ChevronUp size={10} class="text-green-400" /> : <ChevronDown size={10} class="text-red-400" />}
                            <span class="font-mono-data">{Math.abs(ac.verticalRateFpm)}fpm</span>
                          </span>
                        </Show>
                      </Show>
                      <span class="ml-auto">{ac.country} &bull; {regionLabel(ac.region)}</span>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>
      </section>

      {/* ── Intel Feed ──────────────────────────────────────────── */}
      <section class="surface-card p-4 space-y-3">
        <div class="flex items-center gap-2 mb-1">
          <Radio size={14} class="text-blue-400" />
          <h2 class="text-sm font-semibold text-white uppercase tracking-wider">Air / Sea Intel Feed</h2>
          <span class="ml-auto text-[10px] text-zinc-600 font-mono-data">{filteredFeed().length} reports</span>
        </div>

        {/* Filters */}
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Air and sea filters">
          <button type="button" aria-label="All domain filter" aria-pressed={domainFilter() === "all"} onClick={() => setDomainFilter("all")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition ${domainFilter() === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>All</button>
          <button type="button" aria-label="Air domain filter" aria-pressed={domainFilter() === "air"} onClick={() => setDomainFilter("air")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition inline-flex items-center gap-1.5 ${domainFilter() === "air" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>
            <Plane size={12} /> Air
          </button>
          <button type="button" aria-label="Sea domain filter" aria-pressed={domainFilter() === "sea"} onClick={() => setDomainFilter("sea")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition inline-flex items-center gap-1.5 ${domainFilter() === "sea" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>
            <Ship size={12} /> Sea
          </button>

          <div class="mx-1 h-6 w-px bg-white/[0.08]" />

          <button type="button" aria-label="Any severity filter" aria-pressed={sevFilter() === "all"} onClick={() => setSevFilter("all")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition ${sevFilter() === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Any</button>
          <button type="button" aria-label="Critical severity filter" aria-pressed={sevFilter() === "critical"} onClick={() => setSevFilter("critical")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition ${sevFilter() === "critical" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Critical</button>
          <button type="button" aria-label="High severity filter" aria-pressed={sevFilter() === "high"} onClick={() => setSevFilter("high")} class={`min-h-10 px-3 py-1.5 text-xs rounded-xl border transition ${sevFilter() === "high" ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>High</button>

          <div class="relative ml-auto flex-1 min-w-[200px] max-w-sm">
            <Search size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search reports, channels, tags..."
              class="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-400/30 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Feed items */}
      <div class="space-y-2">
        <Show
          when={visibleFeed().length > 0}
          fallback={
            <div class="surface-card p-8 text-center">
              <p class="text-sm text-zinc-500">No air/sea intel reports match your filters</p>
            </div>
          }
        >
          <For each={visibleFeed()}>
            {(report) => {
              const cs = catStyle(report.category);
              return (
                <div class="surface-card p-4 hover:border-white/[0.12] transition-colors">
                  <div class="flex items-start gap-3">
                    {/* Severity indicator */}
                    <div class="pt-1 shrink-0">
                      <div class={`h-2.5 w-2.5 rounded-full ${sevDot(report.severity)}`} />
                    </div>

                    <div class="min-w-0 flex-1 space-y-2">
                      {/* Top row: domain + channel + time */}
                      <div class="flex items-center flex-wrap gap-2">
                        <span class={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold ${report.domain === "air" ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/25" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"}`}>
                          {report.domain === "air" ? "AIR" : "SEA"}
                        </span>
                        <span class={`rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wider font-medium ${cs.bg} ${cs.border} ${cs.text}`}>
                          {formatTitleLabel(report.category)}
                        </span>
                        <span class="text-xs font-medium text-zinc-300">{report.channel}</span>
                        <span data-e2e="air-sea-item-age" class="text-[10px] text-zinc-600 ml-auto shrink-0 flex items-center gap-1">
                          <Clock size={10} /> {formatRelativeTimeAt(report.datetime, nowMs())}
                        </span>
                      </div>

                      {/* Report text */}
                      <p class="text-sm text-zinc-300 leading-relaxed">{report.text.length > 500 ? report.text.slice(0, 500) + "..." : report.text}</p>

                      {/* Tags + meta */}
                      <div class="flex items-center flex-wrap gap-1.5">
                        <For each={report.tags.filter((t) => TAG_COLORS[t])}>
                          {(tag) => (
                            <span class={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium ${TAG_COLORS[tag]}`}>
                              {tag}
                            </span>
                          )}
                        </For>
                        <span class="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[9px] text-zinc-500 uppercase tracking-wider">
                          {regionLabel(report.region)}
                        </span>
                        <Show when={parseViews(report.views) > 0}>
                          <span class="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                            <Eye size={10} /> {formatNumber(parseViews(report.views))}
                          </span>
                        </Show>

                        <Show when={report.link}>
                          <a
                            href={report.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-500 hover:text-cyan-400 transition"
                          >
                            View on Telegram <ExternalLink size={10} />
                          </a>
                        </Show>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </Show>

        {/* Load more */}
        <Show when={filteredFeed().length > showCount()}>
          <button
            type="button"
            onClick={() => setShowCount((c) => c + 40)}
            class="w-full surface-card p-3 text-sm text-zinc-400 hover:text-white hover:border-white/[0.12] transition text-center"
          >
            Show more ({filteredFeed().length - showCount()} remaining)
          </button>
        </Show>
      </div>
    </div>
    </>
  );
}
