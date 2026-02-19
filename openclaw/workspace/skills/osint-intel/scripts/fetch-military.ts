import { scoreMilitaryAircraft } from "./utils/scorer";
import {
  HTTP_TIMEOUT_MS,
  jsonStdout,
  stderr,
  toIsoOrNow,
  truncate,
  USER_AGENT,
  type IntelItem,
  type IntelRegion,
} from "./utils/types";

const OPENSKY_ENDPOINT = "https://opensky-network.org/api/states/all";

const REGION_BOUNDS = {
  middle_east: { lat_min: 12, lat_max: 42, lon_min: 25, lon_max: 65 },
  ukraine: { lat_min: 44, lat_max: 55, lon_min: 22, lon_max: 42 },
  pacific: { lat_min: 10, lat_max: 45, lon_min: 100, lon_max: 155 },
  europe: { lat_min: 45, lat_max: 72, lon_min: -10, lon_max: 40 },
} as const;

const CALLSIGN_PATTERNS = ["RCH", "REACH", "DOOM", "DEATH", "JAKE", "NUKE", "EPIC", "IRON", "NATO", "FORTE"];

function urlForRegion(bounds: (typeof REGION_BOUNDS)[keyof typeof REGION_BOUNDS]): string {
  const params = new URLSearchParams({
    lamin: String(bounds.lat_min),
    lomin: String(bounds.lon_min),
    lamax: String(bounds.lat_max),
    lomax: String(bounds.lon_max),
  });
  return `${OPENSKY_ENDPOINT}?${params.toString()}`;
}

function isMilitarySignal(callsign: string): boolean {
  const upper = callsign.trim().toUpperCase();
  return CALLSIGN_PATTERNS.some((prefix) => upper.startsWith(prefix));
}

async function fetchRegion(region: IntelRegion, bounds: (typeof REGION_BOUNDS)[keyof typeof REGION_BOUNDS]): Promise<IntelItem[]> {
  const response = await fetch(urlForRegion(bounds), {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenSky ${region} returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    time?: number;
    states?: unknown[][];
  };

  const states = payload.states ?? [];
  const timestamp = toIsoOrNow((payload.time ?? Date.now() / 1000) * 1000);

  const items: IntelItem[] = [];

  for (const state of states) {
    if (!Array.isArray(state)) {
      continue;
    }

      const callsign = String(state[1] ?? "").trim();
      const icao24 = String(state[0] ?? "").trim();
      const country = String(state[2] ?? "").trim();
      const longitude = Number(state[5] ?? 0);
      const latitude = Number(state[6] ?? 0);
      const velocity = Number(state[9] ?? 0);
      const heading = Number(state[10] ?? 0);
      const altitude = Number(state[13] ?? state[7] ?? 0);

      if (!callsign || !isMilitarySignal(callsign)) {
        continue;
      }

      const descriptor = `${callsign} ${country} ${icao24}`;
      items.push({
        title: `Military aircraft detected: ${callsign}`,
        summary: truncate(
          `${callsign} (${icao24}) observed in ${region}. Altitude ${Math.round(altitude)}m, heading ${Math.round(heading)} deg, speed ${Math.round(velocity)} m/s.`,
        ),
        source: "OpenSky Network",
        url: OPENSKY_ENDPOINT,
        timestamp,
        region,
        category: "military_movement",
        severity: scoreMilitaryAircraft(descriptor),
        raw_data: {
          callsign,
          icao24,
          country,
          latitude,
          longitude,
          velocity,
          heading,
          altitude,
          state,
        },
      });
  }

  return items;
}

export async function run(): Promise<IntelItem[]> {
  const jobs = (Object.entries(REGION_BOUNDS) as Array<
    [keyof typeof REGION_BOUNDS, (typeof REGION_BOUNDS)[keyof typeof REGION_BOUNDS]]
  >).map(([region, bounds]) => fetchRegion(region as IntelRegion, bounds));

  const settled = await Promise.allSettled(jobs);
  const items: IntelItem[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      stderr("Military tracking source failed", result.reason);
    }
  }

  return items;
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-military", error);
      jsonStdout([]);
    });
}
