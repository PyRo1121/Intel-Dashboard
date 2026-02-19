import { scoreAcledEvent } from "./utils/scorer";
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

const ACLED_ENDPOINT = "https://api.acleddata.com/acled/read";

const REGIONS = {
  middle_east: {
    region_code: 11,
    countries: "Syria|Iraq|Iran|Israel|Palestine|Lebanon|Yemen|Jordan|Saudi Arabia",
  },
  ukraine: {
    region_code: 12,
    countries: "Ukraine|Russia",
  },
} as const;

function isoDateDaysBack(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchRegion(region: IntelRegion, key: string, email: string): Promise<IntelItem[]> {
  const params = new URLSearchParams({
    key,
    email,
    event_date: isoDateDaysBack(3),
    event_date_where: ">",
    limit: "100",
    region: String(REGIONS[region as keyof typeof REGIONS].region_code),
    country: REGIONS[region as keyof typeof REGIONS].countries,
  });

  const response = await fetch(`${ACLED_ENDPOINT}?${params.toString()}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`ACLED ${region} returned ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown>>;
  };

  return (payload.data ?? []).map((event) => {
    const eventType = String(event.event_type ?? "Strategic developments");
    const fatalities = Number(event.fatalities ?? 0);
    const location = String(event.admin1 ?? event.location ?? event.country ?? "unknown area");
    const actorA = String(event.actor1 ?? "Unknown actor");
    const actorB = String(event.actor2 ?? "");
    const notes = String(event.notes ?? "");

    return {
      title: `${eventType} in ${location}`,
      summary: truncate(`${actorA}${actorB ? ` vs ${actorB}` : ""}. ${notes}`),
      source: "ACLED",
      url: "https://acleddata.com/data-export-tool/",
      timestamp: toIsoOrNow(event.event_date),
      region,
      category: "conflict",
      severity: scoreAcledEvent(eventType, fatalities),
      raw_data: event,
    } satisfies IntelItem;
  });
}

export async function run(): Promise<IntelItem[]> {
  const key = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!key || !email) {
    stderr("ACLED_API_KEY and/or ACLED_EMAIL missing; returning empty list");
    return [];
  }

  const settled = await Promise.allSettled([
    fetchRegion("middle_east", key, email),
    fetchRegion("ukraine", key, email),
  ]);

  const items: IntelItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      stderr("ACLED region fetch failed", result.reason);
    }
  }
  return items;
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-acled", error);
      jsonStdout([]);
    });
}
