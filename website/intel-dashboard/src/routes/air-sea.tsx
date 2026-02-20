import { For, Show, createEffect, createMemo, createResource, createSignal, onCleanup, onMount } from "solid-js";
import { Activity, Anchor, Crosshair, ExternalLink, Info, Pause, Plane, Play, ShieldAlert, Ship, Signal } from "lucide-solid";
import {
  buildFreshnessStatus,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { useLiveRefresh } from "~/lib/live-refresh";
import { formatRelativeTime } from "~/lib/utils";
import type { IntelItem } from "~/lib/types";
import "leaflet/dist/leaflet.css";

type Severity = "critical" | "high" | "medium" | "low";

interface AirSeaTrack {
  id: string;
  type: "air" | "sea";
  label: string;
  class: string;
  severity: Severity;
  confidence: number;
  timestamp: string;
  source: string;
  region: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speedKts?: number;
  altitudeFt?: number;
  tags: string[];
  links: { primary?: string; secondary?: string };
  summary: string;
  evidence: Array<{ source: string; timestamp: string; text: string; url?: string }>;
  placement?: {
    mode: "reported" | "region-estimate";
    anchorRegion?: string;
    note: string;
  };
}

interface AirSeaPayload {
  timestamp: string;
  sourceSummary: {
    aviationTimestamp?: string;
    telegramTimestamp?: string;
    telegramChannels?: number;
    telegramMessages?: number;
  };
  stats: {
    totalTracks: number;
    airTracks: number;
    seaTracks: number;
    critical: number;
    high: number;
  };
  tracks: AirSeaTrack[];
}

const EMPTY_AIR_SEA: AirSeaPayload = {
  timestamp: "",
  sourceSummary: {},
  stats: { totalTracks: 0, airTracks: 0, seaTracks: 0, critical: 0, high: 0 },
  tracks: [],
};

const FALLBACK_REGION_CENTER: Record<string, { lat: number; lon: number }> = {
  middle_east: { lat: 30.2, lon: 42.5 },
  ukraine: { lat: 49.0, lon: 31.3 },
  europe: { lat: 50.3, lon: 11.0 },
  pacific: { lat: 23.0, lon: 132.0 },
  us: { lat: 38.0, lon: -97.0 },
  global: { lat: 23.0, lon: 20.0 },
};

function hashOffset(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return ((Math.abs(hash) % 1000) / 1000) * 2 - 1;
}

function fallbackTracksFromIntel(items: IntelItem[]): AirSeaTrack[] {
  return items.slice(0, 120).map((item, idx) => {
    const region = item.region || "global";
    const center = FALLBACK_REGION_CENTER[region] || FALLBACK_REGION_CENTER.global;
    const idSeed = `${item.timestamp}:${item.source}:${item.title}:${idx}`;
    const latitude = center.lat + hashOffset(`${idSeed}:lat`) * 2.4;
    const longitude = center.lon + hashOffset(`${idSeed}:lon`) * 3.6;
    const lower = `${item.title} ${item.summary}`.toLowerCase();
    const type: "air" | "sea" = /ship|fleet|naval|submarine|frigate|carrier|maritime/.test(lower) ? "sea" : "air";
    const severity = (item.severity || "medium") as Severity;

    return {
      id: `fallback-${idx}-${Math.abs(Math.round(hashOffset(idSeed) * 1_000_000))}`,
      type,
      label: item.source || "OSINT",
      class: type === "sea" ? "Intel Maritime Event" : "Intel Air Event",
      severity,
      confidence: severity === "critical" ? 84 : severity === "high" ? 78 : severity === "medium" ? 71 : 64,
      timestamp: item.timestamp,
      source: item.source || "OSINT Feed",
      region,
      latitude,
      longitude,
      tags: ["osint-fallback", item.category || "news"],
      links: { primary: item.url },
      summary: item.summary || item.title,
      evidence: [{ source: item.source || "OSINT", timestamp: item.timestamp, text: item.title, url: item.url }],
      placement: {
        mode: "region-estimate",
        anchorRegion: region,
        note: "Position estimated from OSINT region tag while dedicated air/sea feed is unavailable.",
      },
    };
  });
}

function seedFallbackTracks(): AirSeaTrack[] {
  const now = Date.now();
  const seeds: Array<{ label: string; type: "air" | "sea"; cls: string; region: string; severity: Severity; lat: number; lon: number }> = [
    { label: "NATO AWACS", type: "air", cls: "Strategic C2", region: "europe", severity: "high", lat: 52.2, lon: 14.3 },
    { label: "Black Sea Patrol", type: "sea", cls: "Surface Combatant", region: "ukraine", severity: "high", lat: 44.8, lon: 34.1 },
    { label: "Gulf ISR", type: "air", cls: "ISR", region: "middle_east", severity: "medium", lat: 27.8, lon: 50.4 },
    { label: "Carrier Group Report", type: "sea", cls: "Carrier Report", region: "middle_east", severity: "critical", lat: 15.4, lon: 42.3 },
    { label: "Pacific Recon", type: "air", cls: "Maritime Patrol", region: "pacific", severity: "medium", lat: 24.6, lon: 137.9 },
    { label: "Atlantic Transit", type: "sea", cls: "Naval Activity", region: "global", severity: "low", lat: 34.2, lon: -36.1 },
  ];

  return seeds.map((seed, idx) => {
    const stamp = new Date(now - idx * 22 * 60 * 1000).toISOString();
    return {
      id: `seed-${idx}`,
      type: seed.type,
      label: seed.label,
      class: seed.cls,
      severity: seed.severity,
      confidence: seed.severity === "critical" ? 86 : seed.severity === "high" ? 79 : seed.severity === "medium" ? 72 : 64,
      timestamp: stamp,
      source: "Fallback Ops Feed",
      region: seed.region,
      latitude: seed.lat,
      longitude: seed.lon,
      tags: ["fallback-seed"],
      links: {},
      summary: "Operational placeholder track while live intel feed is unavailable.",
      evidence: [{ source: "Fallback Ops Feed", timestamp: stamp, text: "Live feed unavailable; displaying seeded operational markers." }],
      placement: {
        mode: "region-estimate",
        anchorRegion: seed.region,
        note: "Seeded fallback marker shown when no live tracks are currently available.",
      },
    };
  });
}

async function loadIntelFallbackTracks(): Promise<AirSeaTrack[]> {
  try {
    const res = await fetch("/api/intel", {
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return fallbackTracksFromIntel(data as IntelItem[]);
  } catch {
    return [];
  }
}

async function loadAirSea(): Promise<AirSeaPayload> {
  try {
    const res = await fetch("/api/air-sea", {
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("request failed");
    const payload = (await res.json()) as AirSeaPayload;
    if (Array.isArray(payload.tracks) && payload.tracks.length > 0) {
      return payload;
    }
    const fallbackTracks = await loadIntelFallbackTracks();
    if (fallbackTracks.length > 0) {
      return {
        ...payload,
        tracks: fallbackTracks,
        stats: {
          totalTracks: fallbackTracks.length,
          airTracks: fallbackTracks.filter((track) => track.type === "air").length,
          seaTracks: fallbackTracks.filter((track) => track.type === "sea").length,
          critical: fallbackTracks.filter((track) => track.severity === "critical").length,
          high: fallbackTracks.filter((track) => track.severity === "high").length,
        },
      };
    }

    const seeded = seedFallbackTracks();
    return {
      ...payload,
      tracks: seeded,
      stats: {
        totalTracks: seeded.length,
        airTracks: seeded.filter((track) => track.type === "air").length,
        seaTracks: seeded.filter((track) => track.type === "sea").length,
        critical: seeded.filter((track) => track.severity === "critical").length,
        high: seeded.filter((track) => track.severity === "high").length,
      },
    };
  } catch {
    return {
      timestamp: new Date().toISOString(),
      sourceSummary: {},
      stats: { totalTracks: 0, airTracks: 0, seaTracks: 0, critical: 0, high: 0 },
      tracks: [],
    };
  }
}

function severityColor(s: Severity): string {
  if (s === "critical") return "#ef4444";
  if (s === "high") return "#f59e0b";
  if (s === "medium") return "#3b82f6";
  return "#71717a";
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function trackTime(track: AirSeaTrack): number {
  return new Date(track.timestamp).getTime();
}

function trailKey(track: AirSeaTrack): string {
  return `${track.type}::${track.label}::${track.class}::${track.source}`;
}

function payloadSignature(payload: AirSeaPayload): string {
  const source = payload.sourceSummary;
  const sourceKey = [
    source.aviationTimestamp || "",
    source.telegramTimestamp || "",
    String(source.telegramChannels || 0),
    String(source.telegramMessages || 0),
  ].join("|");
  const trackKey = payload.tracks
    .map((track) => `${track.id}:${track.timestamp}:${track.latitude.toFixed(3)}:${track.longitude.toFixed(3)}:${track.severity}`)
    .join(";");
  return `${sourceKey}#${trackKey}`;
}

export default function AirSeaOps() {
  const [payload, { refetch }] = createResource(loadAirSea, { initialValue: EMPTY_AIR_SEA });
  const feedThresholds = { liveMaxMinutes: 15, delayedMaxMinutes: 60 } as const;
  const [mode, setMode] = createSignal<"all" | "air" | "sea">("all");
  const [severityFilter, setSeverityFilter] = createSignal<"all" | Severity>("all");
  const [majorOnly, setMajorOnly] = createSignal(false);
  const [query, setQuery] = createSignal("");
  const [selectedId, setSelectedId] = createSignal<string | null>(null);
  const [basemap, setBasemap] = createSignal<"dark" | "satellite">("dark");

  let mapEl: HTMLDivElement | undefined;
  let map: import("leaflet").Map | null = null;
  let L: typeof import("leaflet") | null = null;
  let markerLayer: import("leaflet").LayerGroup | null = null;
  let trailLayer: import("leaflet").LayerGroup | null = null;
  let heatLayer: import("leaflet").LayerGroup | null = null;
  let baseLayer: import("leaflet").TileLayer | null = null;

  const [playbackEnabled, setPlaybackEnabled] = createSignal(false);
  const [playbackOn, setPlaybackOn] = createSignal(false);
  const [playbackIndex, setPlaybackIndex] = createSignal(0);
  const [windowMinutes, setWindowMinutes] = createSignal(360);
  const [playbackPrimed, setPlaybackPrimed] = createSignal(false);
  const [mapReady, setMapReady] = createSignal(false);
  const [renderPayload, setRenderPayload] = createSignal<AirSeaPayload>(EMPTY_AIR_SEA);
  const [renderSignature, setRenderSignature] = createSignal(payloadSignature(EMPTY_AIR_SEA));

  const payloadData = () => payload.latest ?? payload() ?? EMPTY_AIR_SEA;

  createEffect(() => {
    const next = payloadData();
    const nextSignature = payloadSignature(next);
    if (nextSignature !== renderSignature()) {
      setRenderPayload(next);
      setRenderSignature(nextSignature);
    }
  });

  useLiveRefresh(async () => {
    const beforeSignature = renderSignature();
    const next = await refetch();
    if (!next) return false;
    const nextSignature = payloadSignature(next);
    if (nextSignature === beforeSignature) {
      return false;
    }
    setRenderPayload(next);
    setRenderSignature(nextSignature);
    return true;
  }, 35_000, { runImmediately: false });

  const tracks = () => renderPayload().tracks;
  const stats = () => renderPayload().stats;

  const baseFiltered = createMemo(() => {
    const q = query().trim().toLowerCase();
    return tracks().filter((track) => {
      if (mode() !== "all" && track.type !== mode()) return false;
      if (severityFilter() !== "all" && track.severity !== severityFilter()) return false;
      if (majorOnly()) {
        const majorTag =
          track.severity === "critical" ||
          track.severity === "high" ||
          track.class.includes("Carrier") ||
          track.class.includes("Strategic") ||
          track.class.includes("Bomber") ||
          track.class.includes("Air Defense");
        if (!majorTag) return false;
      }
      if (!q) return true;
      return (
        track.label.toLowerCase().includes(q) ||
        track.class.toLowerCase().includes(q) ||
        track.source.toLowerCase().includes(q) ||
        track.summary.toLowerCase().includes(q)
      );
    });
  });

  const timelinePoints = createMemo(() => {
    const times = Array.from(new Set(baseFiltered().map((track) => track.timestamp))).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );
    return times;
  });

  createEffect(() => {
    const points = timelinePoints();
    if (points.length === 0) {
      setPlaybackIndex(0);
      setPlaybackPrimed(false);
      return;
    }
    if (!playbackPrimed()) {
      setPlaybackIndex(points.length - 1);
      setPlaybackPrimed(true);
      return;
    }
    if (playbackIndex() >= points.length) {
      setPlaybackIndex(points.length - 1);
    }
  });

  createEffect(() => {
    if (!playbackEnabled() || !playbackOn()) return;
    const points = timelinePoints();
    if (points.length <= 1) return;
    const timer = setInterval(() => {
      setPlaybackIndex((prev) => {
        const next = prev + 1;
        if (next >= points.length) return 0;
        return next;
      });
    }, 900);
    onCleanup(() => clearInterval(timer));
  });

  const visibleTracks = createMemo(() => {
    const all = baseFiltered().slice().sort((a, b) => trackTime(b) - trackTime(a));
    if (!playbackEnabled() || timelinePoints().length === 0) return all;
    const pivot = timelinePoints()[playbackIndex()] || timelinePoints()[timelinePoints().length - 1];
    const pivotMs = new Date(pivot).getTime();
    const lower = pivotMs - windowMinutes() * 60 * 1000;
    const windowed = all.filter((track) => {
      const t = trackTime(track);
      return t <= pivotMs && t >= lower;
    });
    return windowed.length > 0 ? windowed : all;
  });

  const selected = createMemo(() => {
    const id = selectedId();
    if (!id) return null;
    return visibleTracks().find((track) => track.id === id) || null;
  });

  createEffect(() => {
    const list = visibleTracks();
    if (list.length === 0) {
      setSelectedId(null);
      return;
    }
    const current = selectedId();
    if (!current || !list.some((t) => t.id === current)) {
      setSelectedId(list[0].id);
    }
  });

  const topTracks = createMemo(() => visibleTracks().slice(0, 180));

  const selectedTimeline = createMemo(() => {
    const item = selected();
    if (!item) return [] as AirSeaTrack[];
    const key = trailKey(item);
    return tracks()
      .filter((track) => trailKey(track) === key)
      .sort((a, b) => trackTime(b) - trackTime(a))
      .slice(0, 8);
  });

  const heatRegions = createMemo(() => {
    const regions = new Map<string, { lat: number; lon: number; weight: number; count: number }>();
    for (const track of visibleTracks()) {
      const weight = track.severity === "critical" ? 5 : track.severity === "high" ? 3 : track.severity === "medium" ? 2 : 1;
      const existing = regions.get(track.region);
      if (existing) {
        existing.count += 1;
        existing.weight += weight;
      } else {
        regions.set(track.region, { lat: track.latitude, lon: track.longitude, weight, count: 1 });
      }
    }
    return [...regions.entries()].map(([region, value]) => ({ region, ...value }));
  });

  onMount(async () => {
    const leaflet = await import("leaflet");
    L = leaflet;
    if (!mapEl) return;

    map = leaflet.map(mapEl, {
      center: [26, 18],
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      zoomControl: true,
      worldCopyJump: true,
      attributionControl: false,
    });

    baseLayer = leaflet.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    trailLayer = leaflet.layerGroup().addTo(map);
    heatLayer = leaflet.layerGroup().addTo(map);
    markerLayer = leaflet.layerGroup().addTo(map);
    setMapReady(true);

    window.setTimeout(() => {
      map?.invalidateSize();
    }, 0);

    onCleanup(() => {
      setMapReady(false);
      map?.remove();
      map = null;
      markerLayer = null;
      trailLayer = null;
      heatLayer = null;
      baseLayer = null;
      L = null;
    });
  });

  createEffect(() => {
    if (!mapReady()) return;
    if (!L || !map) return;

    baseLayer?.remove();
    if (basemap() === "satellite") {
      baseLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri',
      }).addTo(map);
    } else {
      baseLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      }).addTo(map);
    }
  });

  createEffect(() => {
    if (!mapReady()) return;
    if (!L || !map || !markerLayer || !trailLayer || !heatLayer) return;

    map.invalidateSize();

    markerLayer.clearLayers();
    trailLayer.clearLayers();
    heatLayer.clearLayers();

    for (const zone of heatRegions()) {
      const radius = Math.min(300000, 50000 + zone.weight * 14000);
      const isHot = zone.weight >= 10;
      const isCritical = zone.weight >= 20;
      const color = isCritical ? "#ef4444" : isHot ? "#f59e0b" : "#22d3ee";

      L.circle([zone.lat, zone.lon], {
        radius: radius * 1.3,
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.03,
      }).addTo(heatLayer);

      L.circle([zone.lat, zone.lon], {
        radius,
        color,
        weight: isCritical ? 1.2 : 0.8,
        opacity: isCritical ? 0.5 : 0.25,
        fillColor: color,
        fillOpacity: isCritical ? 0.1 : 0.05,
        dashArray: "4 6",
      })
        .bindTooltip(`<div style="font-weight:600">${zone.region.replace(/_/g, " ").toUpperCase()}</div><div style="opacity:0.7">${zone.count} tracks &bull; threat weight ${zone.weight}</div>`, {
          direction: "center",
          className: "intel-map-tooltip",
          opacity: 0.9,
        })
        .addTo(heatLayer);
    }

    const grouped = new Map<string, AirSeaTrack[]>();
    for (const track of visibleTracks()) {
      const key = trailKey(track);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(track);
    }

    for (const group of grouped.values()) {
      if (group.length < 2) continue;
      const ordered = group.slice().sort((a, b) => trackTime(a) - trackTime(b)).slice(-8);
      const current = ordered[ordered.length - 1];
      const coords = ordered.map((track) => [track.latitude, track.longitude] as [number, number]);

      L.polyline(coords, {
        color: severityColor(current.severity),
        weight: current.type === "air" ? 1.5 : 2,
        opacity: 0.15,
        dashArray: current.type === "air" ? "6 4" : undefined,
      }).addTo(trailLayer);

      L.polyline(coords, {
        color: severityColor(current.severity),
        weight: current.type === "air" ? 2.5 : 3,
        opacity: current.type === "air" ? 0.45 : 0.55,
        dashArray: current.type === "air" ? "8 3" : undefined,
      }).addTo(trailLayer);
    }

    for (const track of topTracks()) {
      const selectedNow = selectedId() === track.id;
      const isCritical = track.severity === "critical";
      const isHigh = track.severity === "high";
      const estimated = track.placement?.mode === "region-estimate";
      const baseRadius = isCritical ? 7 : isHigh ? 6 : track.severity === "medium" ? 5 : 4;
      const radius = selectedNow ? baseRadius + 3 : baseRadius;

      if (isCritical || isHigh) {
        L.circleMarker([track.latitude, track.longitude], {
          radius: radius + 6,
          color: severityColor(track.severity),
          weight: 0,
          fillColor: severityColor(track.severity),
          fillOpacity: 0.08,
        }).addTo(markerLayer);
      }

      const marker = L.circleMarker([track.latitude, track.longitude], {
        radius,
        color: selectedNow ? "#ffffff" : severityColor(track.severity),
        weight: selectedNow ? 2.5 : isCritical ? 2 : 1.4,
        fillColor: severityColor(track.severity),
        fillOpacity: estimated ? 0.42 : selectedNow ? 0.95 : isCritical ? 0.9 : 0.78,
        dashArray: estimated ? "4 3" : undefined,
      });

      const tooltipContent = `<div style="font-weight:600">${track.label}</div><div style="opacity:0.7;font-size:10px">${track.class} &bull; ${track.severity.toUpperCase()}</div><div style="opacity:0.65;font-size:10px">${estimated ? "Estimated region position" : "Reported coordinates"}</div>`;
      marker
        .on("click", () => {
          setSelectedId(track.id);
          map?.panTo([track.latitude, track.longitude], { animate: true, duration: 0.4 });
        })
        .bindTooltip(tooltipContent, {
          direction: "top",
          opacity: 0.94,
          className: "intel-map-tooltip",
        })
        .addTo(markerLayer);
    }
  });

  const visibleStats = createMemo(() => {
    const list = visibleTracks();
    return {
      total: list.length,
      air: list.filter((track) => track.type === "air").length,
      sea: list.filter((track) => track.type === "sea").length,
      critical: list.filter((track) => track.severity === "critical").length,
      high: list.filter((track) => track.severity === "high").length,
    };
  });

  const dataTier = createMemo<"live" | "osint-fallback" | "seeded-fallback" | "empty">(() => {
    const list = renderPayload().tracks;
    if (list.length === 0) return "empty";
    const seeded = list.every((track) => track.tags.includes("fallback-seed"));
    if (seeded) return "seeded-fallback";
    const osint = list.every((track) => track.tags.includes("osint-fallback"));
    if (osint) return "osint-fallback";
    return "live";
  });

  const estimatedVisibleCount = createMemo(() => visibleTracks().filter((track) => track.placement?.mode === "region-estimate").length);

  const dataTierLabel = () => {
    if (dataTier() === "live") return "Live fused feeds";
    if (dataTier() === "osint-fallback") return "OSINT fallback";
    if (dataTier() === "seeded-fallback") return "Seeded placeholder markers";
    return "No active tracks";
  };

  const opsFreshness = createMemo(() =>
    buildFreshnessStatus(Date.parse(renderPayload().timestamp || ""), feedThresholds, { noData: "Unknown" }),
  );
  const freshnessNotice = useFreshnessTransitionNotice(opsFreshness, "Air/Sea feed");

  return (
    <div class="space-y-6 animate-fade-in">
      <section class="relative overflow-hidden rounded-3xl border border-cyan-500/15 bg-gradient-to-br from-[#030a12] via-[#061420] to-[#0a101c] p-6 sm:p-8">
        <div class="absolute -left-24 -top-12 h-72 w-72 rounded-full bg-cyan-500/[0.07] blur-[80px]" />
        <div class="absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-500/[0.05] blur-[60px]" />
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent" />
        <div class="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div class="mb-3 inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-500/[0.08] px-3 py-1.5 shadow-[0_0_12px_rgba(34,211,238,0.08)]">
              <div class="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)] animate-pulse" />
              <span class="text-[11px] font-semibold text-cyan-300 uppercase tracking-widest">Command Surface</span>
            </div>
            <h1 class="text-3xl font-bold text-white tracking-tight">Air / Sea Ops</h1>
            <p class="mt-2 text-sm text-zinc-400/80 max-w-lg">Real-time air and maritime surveillance. Threat-weighted tracks with timeline playback, source fusion, and region heatmaps.</p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
            <div class="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-center min-w-[72px]">
              <p class="font-mono-data text-xl font-bold text-white">{visibleStats().total}</p>
              <p class="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">Tracks</p>
            </div>
            <div class="rounded-xl border border-cyan-400/10 bg-cyan-500/[0.04] px-3 py-2.5 text-center min-w-[72px]">
              <p class="font-mono-data text-xl font-bold text-cyan-300">{visibleStats().air}</p>
              <p class="text-[9px] uppercase tracking-widest text-cyan-400/50 mt-0.5">Air</p>
            </div>
            <div class="rounded-xl border border-emerald-400/10 bg-emerald-500/[0.04] px-3 py-2.5 text-center min-w-[72px]">
              <p class="font-mono-data text-xl font-bold text-emerald-300">{visibleStats().sea}</p>
              <p class="text-[9px] uppercase tracking-widest text-emerald-400/50 mt-0.5">Sea</p>
            </div>
            <div class="rounded-xl border border-red-400/10 bg-red-500/[0.04] px-3 py-2.5 text-center min-w-[72px]">
              <p class="font-mono-data text-xl font-bold text-red-400">{visibleStats().critical}</p>
              <p class="text-[9px] uppercase tracking-widest text-red-400/50 mt-0.5">Critical</p>
            </div>
            <div class="rounded-xl border border-amber-400/10 bg-amber-500/[0.04] px-3 py-2.5 text-center min-w-[72px]">
              <p class="font-mono-data text-xl font-bold text-amber-300">{visibleStats().high}</p>
              <p class="text-[9px] uppercase tracking-widest text-amber-400/50 mt-0.5">High</p>
            </div>
          </div>
        </div>
      </section>

      <section class="surface-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1.5">
            <p class="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300">
              <Info size={13} class="text-cyan-300" /> How to read this board
            </p>
            <p class="max-w-3xl text-xs text-zinc-400">
              Solid markers are reported coordinates. Dashed markers are region-estimated positions from text reports. Confidence scores reflect source reliability and corroboration, not exact geo precision.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${freshnessPillTone(opsFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              Feed: {opsFreshness().label}
              <Show when={opsFreshness().minutes !== null}> ({opsFreshness().minutes}m)</Show>
            </span>
            <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 font-medium">
              Data mode: {dataTierLabel()}
            </span>
          </div>
        </div>
      </section>

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

      <section class="surface-card p-4 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setMode("all")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${mode() === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>All Tracks</button>
          <button type="button" onClick={() => setMode("air")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${mode() === "air" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Air</button>
          <button type="button" onClick={() => setMode("sea")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${mode() === "sea" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Sea</button>

          <div class="mx-1 h-6 w-px bg-white/[0.08]" />

          <button type="button" onClick={() => setSeverityFilter("all")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${severityFilter() === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Any Severity</button>
          <button type="button" onClick={() => setSeverityFilter("critical")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${severityFilter() === "critical" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>Critical</button>
          <button type="button" onClick={() => setSeverityFilter("high")} class={`min-h-11 px-3.5 py-1.5 text-xs rounded-xl border transition ${severityFilter() === "high" ? "border-amber-400/30 bg-amber-500/10 text-amber-200" : "border-white/10 text-zinc-500 hover:text-zinc-300"}`}>High</button>

          <label class="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-zinc-300" title="Keeps critical/high tracks and strategic classes like Carrier, Bomber, Air Defense.">
            <input type="checkbox" checked={majorOnly()} onInput={(e) => setMajorOnly(e.currentTarget.checked)} />
            Major assets only
          </label>
        </div>

        <div class="grid grid-cols-1 items-center gap-2 xl:grid-cols-[1fr_auto]">
          <input
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            placeholder="Search callsign, vessel class, source, or summary..."
            class="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-cyan-400/30 focus:outline-none"
          />

          <div class="flex items-center gap-2 text-xs">
            <label class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 text-zinc-300">
              <input type="checkbox" checked={playbackEnabled()} onInput={(e) => setPlaybackEnabled(e.currentTarget.checked)} />
              Timeline
            </label>
            <button
              type="button"
              onClick={() => setPlaybackOn((v) => !v)}
              disabled={!playbackEnabled() || timelinePoints().length <= 1}
              class="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-zinc-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            >
              <Show when={playbackOn()} fallback={<Play size={12} />}>
                <Pause size={12} />
              </Show>
              {playbackOn() ? "Pause" : "Play"}
            </button>
          </div>
        </div>

        <Show when={playbackEnabled() && timelinePoints().length > 0}>
          <div class="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div class="flex items-center justify-between text-[11px] text-zinc-500">
              <span>Temporal window: {Math.round(windowMinutes() / 60)}h</span>
              <span>{timelinePoints()[playbackIndex()] ? new Date(timelinePoints()[playbackIndex()]).toLocaleString() : "n/a"}</span>
            </div>
            <p class="text-[11px] text-zinc-500">Showing tracks reported between pivot time and {Math.round(windowMinutes() / 60)} hours earlier.</p>
            <input
              type="range"
              min="0"
              max={Math.max(0, timelinePoints().length - 1)}
              value={playbackIndex()}
              onInput={(e) => setPlaybackIndex(Number(e.currentTarget.value))}
              class="intel-range"
            />
            <input
              type="range"
              min="120"
              max="1440"
              step="60"
              value={windowMinutes()}
              onInput={(e) => setWindowMinutes(Number(e.currentTarget.value))}
              class="intel-range intel-range--secondary"
            />
          </div>
        </Show>
      </section>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_390px]">
        <section class="surface-card map-container relative overflow-hidden p-0">
          <div ref={mapEl} class="relative z-10 h-[500px] w-full rounded-xl sm:h-[640px]" />
          <div class="map-scanline rounded-xl" />

          <div class="absolute right-4 top-4 z-[500] inline-flex rounded-lg border border-white/15 bg-black/70 backdrop-blur-sm p-0.5">
            <button
              type="button"
              onClick={() => setBasemap("dark")}
              class={`rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-medium transition ${basemap() === "dark" ? "bg-cyan-500/20 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.15)]" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => setBasemap("satellite")}
              class={`rounded-md px-2.5 py-1.5 text-[10px] uppercase tracking-wider font-medium transition ${basemap() === "satellite" ? "bg-cyan-500/20 text-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.15)]" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              Satellite
            </button>
          </div>

          <div class="pointer-events-none absolute left-4 top-4 z-[500] flex items-center gap-2">
            <svg class="radar-sweep" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(34,211,238,0.15)" stroke-width="1" />
              <circle cx="20" cy="20" r="10" fill="none" stroke="rgba(34,211,238,0.1)" stroke-width="0.5" />
              <line class="radar-sweep-arc" x1="20" y1="20" x2="20" y2="3" stroke="rgba(34,211,238,0.5)" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <div class="rounded-lg border border-cyan-400/25 bg-black/70 backdrop-blur-sm px-2.5 py-1 text-[10px] uppercase tracking-wider text-cyan-200 font-semibold">
              Global Operational Picture
            </div>
          </div>

          <div class="pointer-events-none absolute bottom-4 left-4 z-[500] inline-flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm px-3 py-1.5 text-[10px] text-zinc-300 font-medium">
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]" /> Critical</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]" /> High</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-400" /> Medium</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-zinc-500" /> Low</span>
            <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full border border-zinc-300/80 bg-transparent" /> Estimated geo</span>
          </div>

          <div class="pointer-events-none absolute bottom-4 right-4 z-[500] rounded-lg border border-white/10 bg-black/70 backdrop-blur-sm px-3 py-1.5 text-[10px] text-zinc-400 font-mono-data">
            {visibleStats().total} tracks &bull; {estimatedVisibleCount()} estimated &bull; {renderPayload().sourceSummary?.telegramChannels || 0} sources
          </div>
        </section>

        <div class="space-y-4">
          <Show
            when={selected()}
            fallback={
              <div class="surface-card p-4 space-y-2">
                <p class="text-sm text-zinc-300 font-medium">Select a track for deep intel details</p>
                <p class="text-xs text-zinc-600">Click any marker to inspect confidence, evidence, kinetics, and source links.</p>
              </div>
            }
          >
            {(itemAccessor) => {
              const item = itemAccessor();
              if (!item) return null;
              return (
              <div class="surface-card p-4 ring-1 ring-white/[0.08] space-y-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2 mb-1">
                      <Show when={item.type === "air"} fallback={<Ship size={15} class="text-emerald-300" />}>
                        <Plane size={15} class="text-cyan-300" />
                      </Show>
                      <span class="text-[10px] uppercase tracking-wider text-zinc-500">{item.type.toUpperCase()} Track</span>
                    </div>
                    <h3 class="text-base font-semibold text-white leading-snug">{item.label}</h3>
                    <p class="text-xs text-zinc-500 mt-0.5">{item.class} • {item.source}</p>
                  </div>
                  <div class="text-right">
                    <p class="text-[11px] uppercase tracking-wider font-bold" style={{ color: severityColor(item.severity) }}>{item.severity}</p>
                    <p class="text-sm font-mono-data text-zinc-300" title="Confidence reflects source credibility and corroboration, not exact map precision.">{item.confidence}%</p>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2 text-xs">
                  <div class="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                    <p class="text-zinc-600">Last Seen</p>
                    <p class="text-zinc-300 font-medium">{formatRelativeTime(item.timestamp)}</p>
                  </div>
                  <div class="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                    <p class="text-zinc-600">Region</p>
                    <p class="text-zinc-300 font-medium">{item.region}</p>
                  </div>
                  <div class="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                    <p class="text-zinc-600">Coordinates</p>
                    <p class="text-zinc-300 font-mono-data">{item.placement?.mode === "region-estimate" ? "~" : ""}{item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}</p>
                  </div>
                  <div class="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                    <p class="text-zinc-600">Kinetics</p>
                    <p class="text-zinc-300 font-mono-data">
                      {typeof item.speedKts === "number" ? `${compact(item.speedKts)} kts` : "n/a"}
                      {typeof item.altitudeFt === "number" ? ` • FL${Math.round(item.altitudeFt / 100)}` : ""}
                    </p>
                  </div>
                  <div class="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5 col-span-2">
                    <p class="text-zinc-600">Geolocation Method</p>
                    <p class="text-zinc-300 font-medium">{item.placement?.note || "Position source not specified"}</p>
                    <Show when={item.placement?.anchorRegion}>
                      <p class="text-[11px] text-zinc-500 mt-1">Anchor region: {item.placement?.anchorRegion}</p>
                    </Show>
                  </div>
                </div>

                <div>
                  <p class="text-xs uppercase tracking-wider text-zinc-500 mb-1.5">Assessment</p>
                  <p class="text-sm text-zinc-300 leading-relaxed">{item.summary}</p>
                </div>

                <div class="space-y-2">
                  <p class="text-xs uppercase tracking-wider text-zinc-500">Evidence</p>
                  <For each={item.evidence.slice(0, 4)}>
                    {(e) => (
                      <div class="rounded-xl bg-black/20 border border-white/[0.06] p-2.5">
                        <div class="flex items-center justify-between gap-2">
                          <p class="text-xs text-zinc-400">{e.source}</p>
                          <p class="text-[11px] text-zinc-600">{formatRelativeTime(e.timestamp)}</p>
                        </div>
                        <p class="text-xs text-zinc-300 mt-1 leading-relaxed">{e.text}</p>
                      </div>
                    )}
                  </For>
                </div>

                <Show when={selectedTimeline().length > 1}>
                  <div class="space-y-2">
                    <p class="text-xs uppercase tracking-wider text-zinc-500">Track Timeline</p>
                    <div class="space-y-1.5 rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
                      <For each={selectedTimeline()}>
                        {(node) => (
                          <div class="flex items-center justify-between text-[11px]">
                            <span class="truncate text-zinc-300">{node.summary.slice(0, 80)}</span>
                            <span class="ml-2 shrink-0 text-zinc-500">{formatRelativeTime(node.timestamp)}</span>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </Show>

                <div class="flex items-center gap-2">
                  <Show when={item.links.primary}>
                    <a href={item.links.primary} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.1] transition">
                      Primary Link <ExternalLink size={12} />
                    </a>
                  </Show>
                  <Show when={item.links.secondary}>
                    <a href={item.links.secondary} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.06] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.1] transition">
                      Secondary <ExternalLink size={12} />
                    </a>
                  </Show>
                </div>
              </div>
            );}}
          </Show>

          <div class="surface-card p-4">
            <div class="flex items-center justify-between mb-3">
              <p class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Priority Tracks</p>
              <span class="text-[10px] text-zinc-600 font-mono-data">{visibleTracks().length} total</span>
            </div>
            <div class="max-h-[300px] space-y-1 overflow-auto pr-1">
              <For each={visibleTracks().slice(0, 18)}>
                {(track) => (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(track.id);
                      if (map) map.panTo([track.latitude, track.longitude], { animate: true, duration: 0.4 });
                    }}
                    class={`w-full rounded-xl border px-3 py-2.5 text-left text-xs transition-all ${selectedId() === track.id ? "track-card-active border-cyan-400/20 bg-cyan-500/[0.06]" : "border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]"}`}
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2 min-w-0">
                        <Show when={track.type === "air"} fallback={<Ship size={12} class="text-emerald-400 shrink-0" />}>
                          <Plane size={12} class="text-cyan-400 shrink-0" />
                        </Show>
                        <p class="truncate font-medium text-zinc-100">{track.label}</p>
                      </div>
                      <div class="flex items-center gap-1.5 shrink-0">
                        <span class="h-1.5 w-1.5 rounded-full" style={{ background: severityColor(track.severity) }} />
                        <span class="font-mono-data text-[10px] uppercase" style={{ color: severityColor(track.severity) }}>{track.severity}</span>
                      </div>
                    </div>
                    <div class="mt-1 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                      <span class="truncate">{track.class}</span>
                      <span class="font-mono-data shrink-0">{formatRelativeTime(track.timestamp)}</span>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>

          <div class="surface-card p-4">
            <div class="mb-3 flex items-center justify-between gap-2">
              <p class="text-xs uppercase tracking-widest text-zinc-500 font-semibold">Source Health</p>
              <span class="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-300">{dataTierLabel()}</span>
            </div>
            <div class="space-y-0 text-xs text-zinc-400">
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><Activity size={12} class="text-cyan-400" /> Aviation</span><span class="font-mono-data text-zinc-300">{renderPayload().sourceSummary?.aviationTimestamp ? formatRelativeTime(renderPayload().sourceSummary.aviationTimestamp!) : "n/a"}</span></div>
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><Anchor size={12} class="text-emerald-400" /> Telegram</span><span class="font-mono-data text-zinc-300">{renderPayload().sourceSummary?.telegramTimestamp ? formatRelativeTime(renderPayload().sourceSummary.telegramTimestamp!) : "n/a"}</span></div>
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><Crosshair size={12} class="text-zinc-500" /> Channels</span><span class="font-mono-data text-zinc-300">{renderPayload().sourceSummary?.telegramChannels || 0}</span></div>
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><ShieldAlert size={12} class="text-zinc-500" /> Messages</span><span class="font-mono-data text-zinc-300">{renderPayload().sourceSummary?.telegramMessages || 0}</span></div>
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><Signal size={12} class="text-zinc-500" /> Payload age</span><span class="font-mono-data text-zinc-300">{opsFreshness().minutes === null ? "n/a" : `${opsFreshness().minutes}m`}</span></div>
              <div class="source-health-row"><span class="inline-flex items-center gap-2"><Signal size={12} class="text-zinc-500" /> Feed</span><span class="font-mono-data text-zinc-300">{stats().totalTracks} tracks ({estimatedVisibleCount()} estimated)</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
