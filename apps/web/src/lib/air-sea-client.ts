import { fetchPublicJson } from "./client-json.ts";
import type { Severity } from "./types.ts";

export interface Aircraft {
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

export interface AirSeaIntelReport {
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

export interface AirSeaPayload {
  timestamp: string;
  aviation: {
    timestamp: string;
    source: string;
    fetchedAtMs: number;
    emergencies: number;
    aircraft: Aircraft[];
  };
  intelFeed: AirSeaIntelReport[];
  stats: {
    aircraftCount: number;
    airIntelCount: number;
    seaIntelCount: number;
    totalIntel: number;
    critical: number;
    high: number;
  };
}

export const EMPTY_AIR_SEA_PAYLOAD: AirSeaPayload = {
  timestamp: "",
  aviation: { timestamp: "", source: "", fetchedAtMs: 0, emergencies: 0, aircraft: [] },
  intelFeed: [],
  stats: { aircraftCount: 0, airIntelCount: 0, seaIntelCount: 0, totalIntel: 0, critical: 0, high: 0 },
};

export async function fetchAirSeaPayload(): Promise<AirSeaPayload> {
  const result = await fetchPublicJson<AirSeaPayload>("/api/air-sea");
  return result.ok ? result.data : EMPTY_AIR_SEA_PAYLOAD;
}
