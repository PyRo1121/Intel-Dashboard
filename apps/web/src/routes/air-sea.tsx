import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { Plane, Ship, ExternalLink, Clock, Eye, Navigation, Search, Radio, ChevronUp, ChevronDown, MapPin } from "lucide-solid";
import {
  EMPTY_AIR_SEA_PAYLOAD,
  fetchAirSeaPayload,
  resolveAirSeaPayload,
  type AirSeaIntelReport as IntelReport,
  type Aircraft,
} from "~/lib/air-sea-client";
import { getAviationSourceLabel, getAviationSourceNote } from "~/lib/air-sea-aviation";
import { formatTitleLabel } from "~/lib/event-label";
import { getIntelCategoryStyle } from "~/lib/intel-category-style";
import { getIntelTagStyle } from "~/lib/intel-tag-style";
import {
  freshnessPillTone,
  freshnessTooltip,
  freshnessBannerTone,
  useFeedFreshness,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import {
  formatAgeCompactFromMs,
  formatNumber,
  formatRelativeTimeAt,
  parseCompactNumber,
  parseTimestampMs,
  severityBg,
  severityDot,
  severityHexColor,
} from "~/lib/utils";
import type { Severity } from "~/lib/types";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { AIR_SEA_DESCRIPTION, AIR_SEA_SOCIAL_DESCRIPTION, AIR_SEA_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import "leaflet/dist/leaflet.css";

export default function AirSeaOps() {
  const [payload, { refetch }] = createResource(fetchAirSeaPayload, { initialValue: EMPTY_AIR_SEA_PAYLOAD });
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

  const airSea = () => resolveAirSeaPayload(payload.latest, payload());

  const latestFeedTs = createMemo(() => parseTimestampMs(airSea().timestamp || ""));
  const freshness = useFeedFreshness({
    nowMs,
    latestTimestampMs: latestFeedTs,
    thresholds: feedThresholds,
    subject: "Air/Sea feed",
    labels: { noData: "Unknown" },
  });
  const aviationSnapshotAgeMs = createMemo(() => {
    const fetchedAtMs = airSea().aviation.fetchedAtMs;
    if (!Number.isFinite(fetchedAtMs) || fetchedAtMs <= 0) return null;
    return Math.max(0, nowMs() - fetchedAtMs);
  });
  const aviationSnapshotAgeLabel = createMemo(() => formatAgeCompactFromMs(aviationSnapshotAgeMs()));

  // Filtered intel feed
  const filteredFeed = createMemo(() => {
    const q = query().trim().toLowerCase();
    return airSea().intelFeed.filter((r) => {
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

    const acList = airSea().aviation.aircraft;
    if (acList.length === 0) return;

    for (const ac of acList) {
      const isSelected = selectedAircraft() === ac.icao24;
      const color = severityHexColor(ac.severity);
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

        <Show when={airSea().stats.totalIntel > 0 || airSea().stats.aircraftCount > 0}>
          <div class="intel-kpi-strip">
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-cyan-300">{airSea().stats.aircraftCount}</p>
              <p class="intel-kpi-label">Aircraft</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-blue-300">{airSea().stats.airIntelCount}</p>
              <p class="intel-kpi-label">Air Intel</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-emerald-300">{airSea().stats.seaIntelCount}</p>
              <p class="intel-kpi-label">Sea Intel</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-red-400">{airSea().stats.critical}</p>
              <p class="intel-kpi-label">Critical</p>
            </div>
            <div class="intel-kpi-segment">
              <p class="intel-kpi-value text-amber-400">{airSea().stats.high}</p>
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
            Source: {getAviationSourceLabel(airSea().aviation.source)}
            <Show when={aviationSnapshotAgeMs() !== null}> &bull; snapshot age {aviationSnapshotAgeLabel()}</Show>
            {" • "}
            {airSea().aviation.timestamp || "n/a"}
          </span>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[1fr_380px]">
          {/* Map */}
          <div class="relative">
            <div ref={mapEl} class="h-[350px] w-full" />
            <div class="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm px-2.5 py-1.5 text-[10px] text-zinc-400 font-mono-data">
                {airSea().aviation.aircraft.length} aircraft &bull; real ADS-B positions
            </div>
            <Show when={airSea().aviation.emergencies > 0}>
              <div class="pointer-events-none absolute top-3 right-3 z-[500] rounded-lg border border-red-500/30 bg-red-500/15 px-2.5 py-1.5 text-[11px] text-red-300 font-semibold animate-pulse">
                {airSea().aviation.emergencies} EMERGENCY SQUAWK
              </div>
            </Show>
          </div>

          {/* Aircraft list */}
          <div class="border-l border-white/[0.06] max-h-[350px] overflow-y-auto">
            <Show
              when={airSea().aviation.aircraft.length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Plane size={28} class="text-zinc-700 mb-2" />
                  <p class="text-sm text-zinc-500">No military aircraft currently tracked</p>
                  <p class="text-xs text-zinc-700 mt-1">{getAviationSourceNote(airSea().aviation.source)}</p>
                </div>
              }
            >
              <For each={airSea().aviation.aircraft}>
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
                        <span class={`h-2 w-2 rounded-full shrink-0 ${severityDot(ac.severity)}`} />
                        <span class="font-mono-data text-sm font-bold text-white truncate">{ac.callsign}</span>
                        <span class={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium ${severityBg(ac.severity).replace("ring-", "border-")}`}>{ac.type}</span>
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
                      <span class="ml-auto">{ac.country} &bull; {formatTitleLabel(ac.region, "—")}</span>
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
              const cs = getIntelCategoryStyle(report.category);
              return (
                <div class="surface-card p-4 hover:border-white/[0.12] transition-colors">
                  <div class="flex items-start gap-3">
                    {/* Severity indicator */}
                    <div class="pt-1 shrink-0">
                      <div class={`h-2.5 w-2.5 rounded-full ${severityDot(report.severity)}`} />
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
                        <For each={report.tags.filter((tag) => getIntelTagStyle(tag))}>
                          {(tag) => (
                            <span class={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-wider font-medium ${getIntelTagStyle(tag)}`}>
                              {tag}
                            </span>
                          )}
                        </For>
                        <span class="rounded-full bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 text-[9px] text-zinc-500 uppercase tracking-wider">
                          {formatTitleLabel(report.region, "—")}
                        </span>
                        <Show when={parseCompactNumber(report.views) > 0}>
                          <span class="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                            <Eye size={10} /> {formatNumber(parseCompactNumber(report.views))}
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
