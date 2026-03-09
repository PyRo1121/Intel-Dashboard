import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { fetchIntelFeed } from "~/lib/intel-feed";
import { REGION_ACCENT, REGION_CENTROIDS } from "~/lib/region-map-config";
import { getRegionThreatLevel } from "~/lib/region-threat";
import { buildRegionSummaries, findRegionSummary, sumRegionSeverity } from "~/lib/region-summary";
import { readLatestArray } from "~/lib/resource-latest";
import { REGION_LABELS, type IntelRegion, type IntelItem } from "~/lib/types";
import {
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  maxIsoTimestampBy,
  STANDARD_FEED_FRESHNESS_THRESHOLDS,
  useFeedFreshness,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import SeverityBadge from "~/components/ui/SeverityBadge";
import { formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";
import { Globe, X as XIcon, MapPin } from "lucide-solid";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { MAP_DESCRIPTION, MAP_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import "leaflet/dist/leaflet.css";

/* ── Component ─────────────────────────────────────────────────────── */

export default function ThreatMap() {
  const [intel, { refetch }] = createResource(fetchIntelFeed, { initialValue: [] as IntelItem[] });
  const [selectedRegion, setSelectedRegion] = createSignal<IntelRegion | null>(null);
  const feedThresholds = STANDARD_FEED_FRESHNESS_THRESHOLDS;
  const nowMs = useWallClock(1000);

  // Leaflet refs
  let mapEl: HTMLDivElement | undefined;
  let map: import("leaflet").Map | null = null;
  let L: typeof import("leaflet") | null = null;
  let markerLayer: import("leaflet").LayerGroup | null = null;
  const [mapReady, setMapReady] = createSignal(false);

  useLiveRefresh(() => { void refetch(); }, 45_000, { runImmediately: true });

  const intelItems = () => readLatestArray(intel.latest, intel());
  const loadingInitial = () => isInitialResourceLoading(intel.state, intelItems().length);
  const regions = () => buildRegionSummaries(intelItems());
  const activeRegions = createMemo(() => regions().filter((r) => r.eventCount > 0));
  const totalEvents = () => intelItems().length;
  const totalCritical = () => sumRegionSeverity(regions(), "critical");
  const totalHigh = () => sumRegionSeverity(regions(), "high");
  const latestIntelTs = createMemo(() => maxIsoTimestampBy(intelItems(), (item) => item.timestamp));
  const freshness = useFeedFreshness({
    nowMs,
    latestTimestampMs: latestIntelTs,
    thresholds: feedThresholds,
    subject: "Threat map feed",
  });

  const selectedSummary = () => findRegionSummary(regions(), selectedRegion());

  // ── Map setup ────────────────────────────────────────────────────
  onMount(async () => {
    const leaflet = await import("leaflet");
    L = leaflet;
    if (!mapEl) return;

    map = leaflet.map(mapEl, {
      center: [25, 30],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
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

  // ── Update map markers when regions change ───────────────────────
  createEffect(() => {
    if (!mapReady() || !L || !map || !markerLayer) return;
    markerLayer.clearLayers();
    map.invalidateSize();

    const regionList = regions();
    const selected = selectedRegion();

    for (const r of regionList) {
      if (r.eventCount === 0) continue;
      const coords = REGION_CENTROIDS[r.region];
      if (!coords) continue;

      const threat = getRegionThreatLevel(r);
      const isSelected = selected === r.region;
      const baseRadius = Math.max(8, Math.min(28, 6 + Math.sqrt(r.eventCount) * 3));
      const radius = isSelected ? baseRadius + 4 : baseRadius;

      // Outer pulse ring for critical/high regions
      if (r.critical > 0 || r.high > 0) {
        const pulseColor = r.critical > 0 ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.2)";
        L.circleMarker(coords, {
          radius: radius + 12,
          color: "transparent",
          weight: 0,
          fillColor: pulseColor,
          fillOpacity: 1,
          className: "animate-pulse",
        }).addTo(markerLayer!);

        L.circleMarker(coords, {
          radius: radius + 6,
          color: threat.mapColor,
          weight: 0.5,
          fillColor: "transparent",
          fillOpacity: 0,
          opacity: 0.3,
          dashArray: "4 4",
        }).addTo(markerLayer!);
      }

      // Selected glow ring
      if (isSelected) {
        L.circleMarker(coords, {
          radius: radius + 8,
          color: "#ffffff",
          weight: 0,
          fillColor: threat.mapColor,
          fillOpacity: 0.12,
        }).addTo(markerLayer!);
      }

      // Main region marker
      const marker = L.circleMarker(coords, {
        radius,
        color: isSelected ? "#ffffff" : threat.mapColor,
        weight: isSelected ? 2.5 : 1.5,
        fillColor: threat.mapColor,
        fillOpacity: isSelected ? 0.9 : 0.75,
      });

      // Tooltip HTML
      const sevParts: string[] = [];
      if (r.critical > 0) sevParts.push('<span style="color:#ef4444">' + r.critical + ' critical</span>');
      if (r.high > 0) sevParts.push('<span style="color:#f59e0b">' + r.high + ' high</span>');
      if (r.medium > 0) sevParts.push('<span style="color:#3b82f6">' + r.medium + ' med</span>');
      if (r.low > 0) sevParts.push('<span style="color:#71717a">' + r.low + ' low</span>');

      const tip =
        '<div style="font-weight:700;font-size:13px;margin-bottom:2px">' + REGION_LABELS[r.region] + '</div>' +
        '<div style="font-family:monospace;font-size:12px;font-weight:600;color:' + threat.mapColor + ';margin-bottom:3px">' + r.eventCount + ' events &bull; ' + threat.label + '</div>' +
        '<div style="font-size:10px;opacity:0.8">' + sevParts.join(' &bull; ') + '</div>';

      marker
        .bindTooltip(tip, { direction: "top", opacity: 0.95, className: "intel-map-tooltip", offset: [0, -radius] })
        .on("click", () => {
          setSelectedRegion(isSelected ? null : r.region);
          map?.flyTo(coords, isSelected ? 2 : 4, { animate: true, duration: 0.5 });
        })
        .addTo(markerLayer!);

      // Event count label inside marker (for larger markers)
      if (baseRadius >= 12) {
        const countIcon = L.divIcon({
          html: '<span style="color:white;font-size:11px;font-weight:700;font-family:monospace;text-shadow:0 1px 3px rgba(0,0,0,0.6)">' + r.eventCount + '</span>',
          className: "flex items-center justify-center",
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius],
        });
        L.marker(coords, { icon: countIcon, interactive: false }).addTo(markerLayer!);
      }
    }
  });

  return (
    <>
      <Title>{MAP_TITLE}</Title>
      <Meta name="description" content={MAP_DESCRIPTION} />
      <Meta property="og:title" content={MAP_TITLE} />
      <Meta property="og:description" content={MAP_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/map")} />
      <Meta property="og:type" content="website" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={MAP_TITLE} />
      <Meta name="twitter:description" content={MAP_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/map")} />
      <div class="intel-page">

      {/* ── Header ──────────────────────────────────────────────── */}
      <header class="intel-page-header">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <div class="intel-badge">
              <div class="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)] animate-pulse" />
              Live Map
            </div>
            <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(freshness.feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              {freshness.feedFreshness().label}
              <Show when={freshness.latestFeedAgeMs() !== null}> ({freshness.latestFeedAgeLabel()})</Show>
            </span>
          </div>
          <h1 class="intel-heading">Threat Map</h1>
          <p class="intel-subheading">Regional threat assessment — {activeRegions().length} active regions from live OSINT data.</p>
        </div>

        <Show when={totalEvents() > 0}>
          <div class="intel-kpi-strip">
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value">{totalEvents()}</p>
              <p class="intel-kpi-label">Events</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-red-400">{totalCritical()}</p>
              <p class="intel-kpi-label">Critical</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-amber-400">{totalHigh()}</p>
              <p class="intel-kpi-label">High</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-cyan-400">{activeRegions().length}</p>
              <p class="intel-kpi-label">Regions</p>
            </div>
          </div>
        </Show>
      </header>

      {/* Freshness notice */}
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

      <Show
        when={!loadingInitial()}
        fallback={
          <div class="space-y-4">
            <div class="surface-card overflow-hidden"><div class="h-[450px] bg-white/[0.02] animate-shimmer" /></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <For each={[1, 2, 3, 4, 5]}>
                {() => <div class="surface-card p-4"><div class="h-5 w-24 bg-white/[0.04] rounded mb-2 animate-shimmer" /><div class="h-2 w-full bg-white/[0.04] rounded-full mb-2 animate-shimmer" /><div class="h-4 w-16 bg-white/[0.04] rounded animate-shimmer" /></div>}
              </For>
            </div>
          </div>
        }
      >
        {/* ── Leaflet Map ──────────────────────────────────────────── */}
        <section class="surface-card overflow-hidden">
          <div class="flex items-center gap-2 px-4 pt-4 pb-2">
            <Globe size={15} class="text-cyan-400" />
            <h2 class="text-sm font-semibold text-white uppercase tracking-wider">Global Threat Overview</h2>
            <span class="ml-auto text-[10px] text-zinc-600 font-mono-data">
              {activeRegions().length} active regions &bull; {totalEvents()} events
            </span>
          </div>

          <div class="relative">
            <div ref={mapEl} class="h-[450px] w-full" />
            <div class="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-zinc-400 font-mono-data">
              Click a region to inspect &bull; {activeRegions().length} regions tracked
            </div>
          </div>
        </section>

        {/* ── Selected Region Detail ──────────────────────────────── */}
        <Show when={selectedSummary()}>
          {(summary) => {
            const threat = () => getRegionThreatLevel(summary());
            return (
              <div class="surface-card p-5 ring-1 ring-white/[0.08] animate-scale-in relative overflow-hidden">
                <div class={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  summary().critical > 0 ? "bg-red-500" : summary().high > 0 ? "bg-amber-500" : "bg-blue-500"
                }`} />

                <div class="flex items-center justify-between mb-4 pl-3">
                  <div class="flex items-center gap-3">
                    <MapPin size={16} class={threat().color} />
                    <h3 class="text-lg font-semibold text-white">{REGION_LABELS[summary().region]}</h3>
                    <span class={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${threat().bgColor} ${threat().color}`}>
                      {threat().label}
                    </span>
                    <span class="text-xs text-zinc-500 font-mono-data">{summary().eventCount} events</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Close region detail"
                    onClick={() => {
                      setSelectedRegion(null);
                      map?.flyTo([25, 30], 2, { animate: true, duration: 0.5 });
                    }}
                    class="flex items-center justify-center w-7 h-7 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all"
                  >
                    <XIcon size={14} />
                  </button>
                </div>

                {/* Severity breakdown bar */}
                <div class="flex gap-0.5 h-2 rounded-full overflow-hidden mb-4 ml-3">
                  <Show when={summary().critical > 0}><div class="bg-red-500 rounded-l-full" style={`flex: ${summary().critical}`} /></Show>
                  <Show when={summary().high > 0}><div class="bg-amber-500" style={`flex: ${summary().high}`} /></Show>
                  <Show when={summary().medium > 0}><div class="bg-blue-500" style={`flex: ${summary().medium}`} /></Show>
                  <Show when={summary().low > 0}><div class="bg-zinc-600 rounded-r-full" style={`flex: ${summary().low}`} /></Show>
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
                          <p class="text-[11px] text-zinc-600 mt-0.5">
                            {item.source} &middot; <span data-e2e="map-item-age">{formatRelativeTimeAt(item.timestamp, nowMs())}</span>
                          </p>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            );
          }}
        </Show>

        {/* ── Region Grid ──────────────────────────────────────────── */}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <For each={regions().filter((r) => r.eventCount > 0).sort((a, b) => b.eventCount - a.eventCount)}>
            {(r, idx) => {
              const threat = getRegionThreatLevel(r);
              const accent = REGION_ACCENT[r.region] || "#71717a";
              return (
                <button
                  type="button"
                  aria-pressed={selectedRegion() === r.region}
                  aria-label={`Inspect ${REGION_LABELS[r.region]} region`}
                  class={`surface-card surface-card-hover w-full p-4 text-left transition-all duration-300 cursor-pointer relative overflow-hidden ${selectedRegion() === r.region ? "ring-1 ring-white/[0.12]" : ""}`}
                  onClick={() => {
                    const wasSelected = selectedRegion() === r.region;
                    setSelectedRegion(wasSelected ? null : r.region);
                    if (!wasSelected && map) {
                      map.flyTo(REGION_CENTROIDS[r.region], 4, { animate: true, duration: 0.5 });
                    } else if (wasSelected && map) {
                      map.flyTo([25, 30], 2, { animate: true, duration: 0.5 });
                    }
                  }}
                  style={`animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${idx() * 40}ms`}
                >
                  {/* Top accent line */}
                  <div class="absolute top-0 left-0 right-0 h-px" style={`background: linear-gradient(90deg, transparent, ${accent}40, transparent)`} />

                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <div class="w-2.5 h-2.5 rounded-full shrink-0" style={`background: ${accent}; box-shadow: 0 0 6px ${accent}60`} />
                      <h3 class="text-sm font-semibold text-white truncate">{REGION_LABELS[r.region]}</h3>
                    </div>
                    <span class="text-xl font-bold font-mono-data text-white/90 shrink-0 ml-2">{r.eventCount}</span>
                  </div>

                  <span class={`text-[10px] font-bold uppercase tracking-wider ${threat.color}`}>{threat.label}</span>

                  {/* Severity bar */}
                  <div class="flex gap-0.5 h-1.5 rounded-full overflow-hidden my-2">
                    <Show when={r.critical > 0}><div class="bg-red-500 rounded-l-full" style={`flex: ${r.critical}`} /></Show>
                    <Show when={r.high > 0}><div class="bg-amber-500" style={`flex: ${r.high}`} /></Show>
                    <Show when={r.medium > 0}><div class="bg-blue-500" style={`flex: ${r.medium}`} /></Show>
                    <Show when={r.low > 0}><div class="bg-zinc-600 rounded-r-full" style={`flex: ${r.low}`} /></Show>
                  </div>

                  {/* Severity counts */}
                  <div class="flex items-center gap-2 text-[10px]">
                    <Show when={r.critical > 0}><span class="text-red-400 font-medium">{r.critical}c</span></Show>
                    <Show when={r.high > 0}><span class="text-amber-400 font-medium">{r.high}h</span></Show>
                    <Show when={r.medium > 0}><span class="text-blue-400">{r.medium}m</span></Show>
                    <Show when={r.low > 0}><span class="text-zinc-500">{r.low}l</span></Show>
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </Show>
      </div>
    </>
  );
}
