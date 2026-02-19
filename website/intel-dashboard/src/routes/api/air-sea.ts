import type { APIEvent } from "@solidjs/start/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

type Severity = "critical" | "high" | "medium" | "low";

interface AviationState {
  timestamp?: string;
  source?: string;
  total_notable?: number;
  emergencies?: number;
  military?: number;
  aircraft?: Array<{
    icao24?: string;
    callsign?: string;
    country?: string;
    region?: string;
    squawk?: string;
    latitude?: number;
    longitude?: number;
    altitude_ft?: number;
    speed_kts?: number;
    heading?: number;
    tags?: string[];
    severity?: Severity;
    description?: string;
    links?: { adsbexchange?: string; flightradar24?: string };
  }>;
}

interface TelegramState {
  timestamp?: string;
  total_channels?: number;
  channels_fetched?: number;
  total_messages?: number;
  channels?: Array<{
    username?: string;
    label?: string;
    category?: string;
    messages?: Array<{
      text_original?: string;
      text_en?: string;
      datetime?: string;
      link?: string;
      views?: string;
      media?: Array<{ type?: string; url?: string; thumbnail?: string }>;
    }>;
  }>;
}

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
  evidence: Array<{
    source: string;
    timestamp: string;
    text: string;
    url?: string;
  }>;
  placement?: {
    mode: "reported" | "region-estimate";
    anchorRegion?: string;
    note: string;
  };
}

const AVIATION_PATH = join(homedir(), ".openclaw/workspace/skills/aviation-intel/state/latest-aviation.json");
const TELEGRAM_PATH = join(homedir(), ".openclaw/workspace/skills/telegram-intel/state/latest-telegram-intel.json");

const REGION_CENTERS: Record<string, { lat: number; lon: number }> = {
  middle_east: { lat: 30.2, lon: 42.5 },
  ukraine_blacksea: { lat: 46.4, lon: 32.8 },
  ukraine: { lat: 49.0, lon: 31.3 },
  europe: { lat: 50.3, lon: 11.0 },
  pacific: { lat: 23.0, lon: 132.0 },
  global: { lat: 23.0, lon: 20.0 },
};

const NAVAL_CATEGORIES = new Set([
  "naval",
  "ru_milblog",
  "ua_frontline",
  "ua_intel",
  "en_analysis",
  "mapping",
  "satellite",
  "en_osint",
  "israel_milblog",
  "iran_milblog",
  "global_osint",
]);

const AIR_CATEGORIES = new Set([
  "air_defense",
  "drone",
  "ua_frontline",
  "ua_intel",
  "ua_osint",
  "ru_milblog",
  "en_analysis",
  "en_osint",
  "satellite",
  "mapping",
  "israel_milblog",
  "iran_milblog",
  "global_osint",
]);

const NAVAL_KEYWORDS = [
  "carrier",
  "fleet",
  "frigate",
  "destroyer",
  "warship",
  "submarine",
  "black sea",
  "corvette",
  "missile boat",
  "amphibious",
  "admiral",
  "task force",
  "strike group",
  "naval",
  "patrol ship",
  "red sea",
  "houthi",
  "persian gulf",
  "strait of hormuz",
  "maritime",
  "blockade",
  "gunboat",
  "landing ship",
];

const AIR_KEYWORDS = [
  "air force",
  "air defense",
  "airstrike",
  "air strike",
  "fighter",
  "bomber",
  "awacs",
  "tanker",
  "sortie",
  "uav",
  "drone",
  "shahed",
  "missile",
  "helicopter",
  "aviation",
  "intercept",
  "s-300",
  "patriot",
  "iskander",
  "iron dome",
  "ballistic",
  "cruise missile",
  "f-35",
  "f-16",
  "iaf",
  "qassam",
  "rocket",
  "interception",
  "true promise",
  "retaliation",
  "strike",
];

function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function parseViews(raw: string | undefined): number {
  if (!raw) return 0;
  const v = raw.replace(/,/g, "").trim().toUpperCase();
  const match = v.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);
  if (!match) {
    const parsed = Number.parseInt(v.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const base = Number.parseFloat(match[1]);
  const unit = match[2];
  if (!unit) return Math.round(base);
  if (unit === "K") return Math.round(base * 1_000);
  if (unit === "M") return Math.round(base * 1_000_000);
  return Math.round(base * 1_000_000_000);
}

function severityRank(severity: Severity): number {
  if (severity === "critical") return 0;
  if (severity === "high") return 1;
  if (severity === "medium") return 2;
  return 3;
}

function scoreTextSeverity(text: string): Severity {
  const lower = text.toLowerCase();
  if (/carrier strike|ballistic|major strike|sunk|destroyed|explosion|missile strike/.test(lower)) return "critical";
  if (/carrier|fleet|frigate|destroyer|warship|submarine|drone strike|air defense/.test(lower)) return "high";
  if (/naval|ship|patrol|recon|surveillance/.test(lower)) return "medium";
  return "low";
}

function hashOffset(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const normalized = (Math.abs(h) % 1000) / 1000;
  return normalized * 2 - 1;
}

function inferRegion(text: string): string {
  const lower = text.toLowerCase();
  if (/black sea|crimea|sevastopol|odessa|dnipro|ukraine|donbas|kharkiv|zapori/.test(lower)) return "ukraine_blacksea";
  if (/red sea|houthi|iran|israel|syria|iraq|yemen|lebanon|hezbollah|gaza|hamas|tehran|idf|irgc|persian gulf/.test(lower)) return "middle_east";
  if (/taiwan|south china sea|philippines|japan sea|pacific/.test(lower)) return "pacific";
  if (/baltic|north sea|mediterranean|nato/.test(lower)) return "europe";
  return "global";
}

function toIsoOrNow(ts: string | undefined): string {
  if (!ts) return new Date().toISOString();
  try {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function classifyAircraft(tags: string[]): string {
  if (tags.some((t) => t.includes("SQUAWK_"))) return "Emergency";
  if (tags.some((t) => t.includes("AIRCRAFT_E-6B") || t.includes("AIRCRAFT_E-4B"))) return "Strategic C2";
  if (tags.some((t) => t.includes("AIRCRAFT_B-"))) return "Bomber";
  if (tags.some((t) => t.includes("AIRCRAFT_RQ-4") || t.includes("AIRCRAFT_RC-135"))) return "ISR";
  if (tags.some((t) => t.includes("AIRCRAFT_P-8A"))) return "Maritime Patrol";
  if (tags.some((t) => t.includes("MIL_"))) return "Military Flight";
  return "Aircraft";
}

function toAirTracks(aviation: AviationState): AirSeaTrack[] {
  const aircraft = Array.isArray(aviation.aircraft) ? aviation.aircraft : [];
  const tracks: AirSeaTrack[] = [];

  for (const item of aircraft) {
    if (typeof item.latitude !== "number" || typeof item.longitude !== "number") continue;
    const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
    const severity = (item.severity || "low") as Severity;
    const cls = classifyAircraft(tags);
    const label = (item.callsign && item.callsign !== "(no callsign)") ? item.callsign : (item.icao24 || "Unknown");
    const confidence = Math.min(97, 58 + (severity === "critical" ? 30 : severity === "high" ? 20 : severity === "medium" ? 10 : 5) + (tags.includes("MILITARY") ? 6 : 0));

    tracks.push({
      id: `air-${item.icao24 || crypto.randomUUID()}`,
      type: "air",
      label,
      class: cls,
      severity,
      confidence,
      timestamp: toIsoOrNow(aviation.timestamp),
      source: aviation.source || "OpenSky Network",
      region: item.region || "global",
      latitude: item.latitude,
      longitude: item.longitude,
      heading: typeof item.heading === "number" ? item.heading : undefined,
      speedKts: typeof item.speed_kts === "number" ? item.speed_kts : undefined,
      altitudeFt: typeof item.altitude_ft === "number" ? item.altitude_ft : undefined,
      tags,
      links: {
        primary: item.links?.adsbexchange,
        secondary: item.links?.flightradar24,
      },
      summary: item.description || `${cls} activity detected`,
      evidence: [
        {
          source: aviation.source || "OpenSky Network",
          timestamp: toIsoOrNow(aviation.timestamp),
          text: item.description || "Air activity",
          url: item.links?.adsbexchange,
        },
      ],
      placement: {
        mode: "reported",
        anchorRegion: item.region || "global",
        note: "Position sourced from aviation telemetry coordinates.",
      },
    });
  }

  return tracks;
}

function toSeaTracks(telegram: TelegramState): AirSeaTrack[] {
  const channels = Array.isArray(telegram.channels) ? telegram.channels : [];
  const tracks: AirSeaTrack[] = [];

  for (const channel of channels) {
    const category = channel.category || "";
    if (!NAVAL_CATEGORIES.has(category)) continue;

    const messages = Array.isArray(channel.messages) ? channel.messages.slice(0, 8) : [];
    for (const message of messages) {
      const text = cleanText(message.text_en || message.text_original || "");
      if (!text || text.length < 40) continue;
      const lower = text.toLowerCase();
      if (!NAVAL_KEYWORDS.some((k) => lower.includes(k))) continue;

      const region = inferRegion(text);
      const center = REGION_CENTERS[region] || REGION_CENTERS.global;
      const idSeed = message.link || `${channel.username || "chan"}-${message.datetime || ""}-${text.slice(0, 32)}`;
      const lat = center.lat + hashOffset(`${idSeed}:lat`) * 2.7;
      const lon = center.lon + hashOffset(`${idSeed}:lon`) * 3.8;
      const severity = scoreTextSeverity(text);
      const views = parseViews(message.views);
      const confidence = Math.max(40, Math.min(93, 42 + (severity === "critical" ? 28 : severity === "high" ? 20 : severity === "medium" ? 10 : 3) + Math.min(18, Math.floor(views / 25_000))));
      const sourceLabel = channel.label || channel.username || "Telegram source";
      const label = `${sourceLabel}`;
      const snippet = text.length > 280 ? `${text.slice(0, 280)}...` : text;

      tracks.push({
        id: `sea-${idSeed}`,
        type: "sea",
        label,
        class: /carrier/.test(lower) ? "Carrier Report" : /submarine/.test(lower) ? "Submarine Report" : /destroyer|frigate|corvette|warship/.test(lower) ? "Surface Combatant" : "Naval Activity",
        severity,
        confidence,
        timestamp: toIsoOrNow(message.datetime || telegram.timestamp),
        source: `${sourceLabel} [${category}]`,
        region,
        latitude: lat,
        longitude: lon,
        tags: ["telegram", category, ...(views > 100_000 ? ["high-engagement"] : [])],
        links: {
          primary: message.link,
          secondary: message.media?.[0]?.url,
        },
        summary: snippet,
        evidence: [
          {
            source: sourceLabel,
            timestamp: toIsoOrNow(message.datetime || telegram.timestamp),
            text: snippet,
            url: message.link,
          },
        ],
        placement: {
          mode: "region-estimate",
          anchorRegion: region,
          note: "Position estimated from mention region and deterministic source-based dispersion.",
        },
      });
    }
  }

  tracks.sort((a, b) => {
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return tracks.slice(0, 220);
}

function toAirTracksFromTelegram(telegram: TelegramState): AirSeaTrack[] {
  const channels = Array.isArray(telegram.channels) ? telegram.channels : [];
  const tracks: AirSeaTrack[] = [];

  for (const channel of channels) {
    const category = channel.category || "";
    if (!AIR_CATEGORIES.has(category)) continue;

    const messages = Array.isArray(channel.messages) ? channel.messages.slice(0, 8) : [];
    for (const message of messages) {
      const text = cleanText(message.text_en || message.text_original || "");
      if (!text || text.length < 40) continue;
      const lower = text.toLowerCase();
      if (!AIR_KEYWORDS.some((k) => lower.includes(k))) continue;

      const region = inferRegion(text);
      const center = REGION_CENTERS[region] || REGION_CENTERS.global;
      const idSeed = message.link || `${channel.username || "chan"}-${message.datetime || ""}-${text.slice(0, 32)}`;
      const lat = center.lat + hashOffset(`${idSeed}:air:lat`) * 2.2;
      const lon = center.lon + hashOffset(`${idSeed}:air:lon`) * 3.2;
      const severity = scoreTextSeverity(text);
      const views = parseViews(message.views);
      const confidence = Math.max(42, Math.min(95, 45 + (severity === "critical" ? 28 : severity === "high" ? 20 : severity === "medium" ? 10 : 3) + Math.min(16, Math.floor(views / 30_000))));
      const sourceLabel = channel.label || channel.username || "Telegram source";
      const summary = text.length > 280 ? `${text.slice(0, 280)}...` : text;

      let cls = "Air Activity";
      if (/air defense|patriot|s-300/.test(lower)) cls = "Air Defense Event";
      else if (/drone|uav|shahed/.test(lower)) cls = "Drone Activity";
      else if (/fighter|bomber|awacs|tanker|sortie|helicopter/.test(lower)) cls = "Manned Air Ops";
      else if (/missile|iskander/.test(lower)) cls = "Missile Air Threat";

      tracks.push({
        id: `air-tg-${idSeed}`,
        type: "air",
        label: sourceLabel,
        class: cls,
        severity,
        confidence,
        timestamp: toIsoOrNow(message.datetime || telegram.timestamp),
        source: `${sourceLabel} [${category}]`,
        region,
        latitude: lat,
        longitude: lon,
        tags: ["telegram", category, ...(views > 100_000 ? ["high-engagement"] : [])],
        links: {
          primary: message.link,
          secondary: message.media?.[0]?.url,
        },
        summary,
        evidence: [
          {
            source: sourceLabel,
            timestamp: toIsoOrNow(message.datetime || telegram.timestamp),
            text: summary,
            url: message.link,
          },
        ],
        placement: {
          mode: "region-estimate",
          anchorRegion: region,
          note: "Position estimated from mention region and deterministic source-based dispersion.",
        },
      });
    }
  }

  tracks.sort((a, b) => {
    const sev = severityRank(a.severity) - severityRank(b.severity);
    if (sev !== 0) return sev;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return tracks.slice(0, 220);
}

export async function GET(_event: APIEvent) {
  try {
    const [aviationRaw, telegramRaw] = await Promise.all([
      readFile(AVIATION_PATH, "utf-8").catch(() => "{}"),
      readFile(TELEGRAM_PATH, "utf-8").catch(() => "{}"),
    ]);

    const aviation = JSON.parse(aviationRaw) as AviationState;
    const telegram = JSON.parse(telegramRaw) as TelegramState;
    const airAviation = toAirTracks(aviation);
    const airTelegram = toAirTracksFromTelegram(telegram);
    const air = [...airAviation, ...airTelegram].sort((a, b) => {
      const sev = severityRank(a.severity) - severityRank(b.severity);
      if (sev !== 0) return sev;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).slice(0, 240);
    const sea = toSeaTracks(telegram);
    const tracks = [...air, ...sea].sort((a, b) => {
      const sev = severityRank(a.severity) - severityRank(b.severity);
      if (sev !== 0) return sev;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    const payload = {
      timestamp: new Date().toISOString(),
      sourceSummary: {
        aviationTimestamp: aviation.timestamp || "",
        telegramTimestamp: telegram.timestamp || "",
        telegramChannels: telegram.channels_fetched || telegram.total_channels || 0,
        telegramMessages: telegram.total_messages || 0,
      },
      stats: {
        totalTracks: tracks.length,
        airTracks: air.length,
        seaTracks: sea.length,
        critical: tracks.filter((t) => t.severity === "critical").length,
        high: tracks.filter((t) => t.severity === "high").length,
      },
      tracks,
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return new Response(JSON.stringify({ timestamp: new Date().toISOString(), sourceSummary: {}, stats: { totalTracks: 0, airTracks: 0, seaTracks: 0, critical: 0, high: 0 }, tracks: [] }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
