import { scoreNotamText } from "./utils/scorer";
import {
  cleanHtml,
  HTTP_TIMEOUT_MS,
  jsonStdout,
  stderr,
  toIsoOrNow,
  truncate,
  USER_AGENT,
  type IntelItem,
  type IntelRegion,
} from "./utils/types";

/**
 * NOTAM/Airspace Intelligence Fetcher
 *
 * Sources:
 * 1. AviationWeather.gov SIGMET/AIRMET (free, no key needed)
 * 2. Google News RSS for NOTAM/TFR/airspace alerts (free)
 *
 * NOTE: FAA NOTAM API (v1) now requires an API key.
 *       ICAO NOTAM API now requires an API key.
 *       If you get a key later, re-enable those sources.
 */

const AVIATION_WX_SIGMET = "https://aviationweather.gov/api/data/airsigmet?format=json";

const NOTAM_NEWS_FEEDS = [
  {
    name: "NOTAM/Airspace News",
    url: "https://news.google.com/rss/search?q=NOTAM+airspace+restriction+military+TFR&hl=en-US&gl=US&ceid=US:en",
  },
  {
    name: "TFR/Airspace Closure News",
    url: "https://news.google.com/rss/search?q=%22temporary+flight+restriction%22+OR+%22airspace+closure%22&hl=en-US&gl=US&ceid=US:en",
  },
];

const REGION_KEYWORDS: Record<string, string[]> = {
  middle_east: ["israel", "iran", "syria", "iraq", "yemen", "lebanon", "gaza", "jordan", "saudi", "red sea", "persian gulf"],
  ukraine: ["ukraine", "kyiv", "crimea", "donbas", "russia", "black sea", "zaporizhzhia"],
  europe: ["europe", "nato", "germany", "poland", "romania", "baltic", "north sea"],
  pacific: ["pacific", "taiwan", "china", "japan", "korea", "south china sea", "guam"],
};

function regionFromText(text: string): IntelRegion {
  const lower = text.toLowerCase();
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return region as IntelRegion;
    }
  }
  return "global";
}

function matchTag(block: string, tag: string): string {
  const direct = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";
  if (direct) return cleanHtml(direct);
  return "";
}

function matchLink(block: string): string {
  const rssLink = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1];
  if (rssLink) return cleanHtml(rssLink);
  const atomLink = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block)?.[1];
  return cleanHtml(atomLink ?? "");
}

async function fetchSigmets(): Promise<IntelItem[]> {
  const response = await fetch(AVIATION_WX_SIGMET, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  // 204 = no active SIGMETs (normal)
  if (response.status === 204) return [];

  if (!response.ok) {
    throw new Error(`AviationWeather SIGMET returned ${response.status}`);
  }

  const text = await response.text();
  if (!text.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    stderr("SIGMET response was not JSON");
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return (parsed as Array<Record<string, unknown>>).slice(0, 30).map((sigmet) => {
    const rawText = String(sigmet.rawAirSigmet ?? sigmet.rawSigmet ?? "");
    const hazard = String(sigmet.hazard ?? "UNKNOWN");
    const severity = String(sigmet.severity ?? "");

    return {
      title: `SIGMET: ${hazard} ${severity}`.trim(),
      summary: truncate(rawText || `${hazard} advisory`),
      source: "AviationWeather SIGMET",
      url: "https://aviationweather.gov/",
      timestamp: toIsoOrNow(sigmet.validTimeFrom ?? sigmet.issueTime),
      region: regionFromText(rawText),
      category: "notam",
      severity: scoreNotamText(rawText),
      raw_data: sigmet,
    } satisfies IntelItem;
  });
}

async function fetchNotamNews(feed: { name: string; url: string }): Promise<IntelItem[]> {
  const response = await fetch(feed.url, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${feed.name} returned ${response.status}`);
  }

  const xml = await response.text();
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ];

  return blocks.slice(0, 10).map((block) => {
    const title = matchTag(block, "title");
    const description = matchTag(block, "description") || matchTag(block, "summary");
    const url = matchLink(block);
    const timestamp = matchTag(block, "pubDate") || matchTag(block, "updated") || matchTag(block, "published");
    const combined = `${title} ${description}`;

    return {
      title: title || `${feed.name} item`,
      summary: truncate(description || title),
      source: feed.name,
      url: url || feed.url,
      timestamp: toIsoOrNow(timestamp),
      region: regionFromText(combined),
      category: "notam",
      severity: scoreNotamText(combined),
      raw_data: { title, description, url },
    } satisfies IntelItem;
  });
}

export async function run(): Promise<IntelItem[]> {
  const jobs = [
    fetchSigmets(),
    ...NOTAM_NEWS_FEEDS.map((feed) => fetchNotamNews(feed)),
  ];

  const settled = await Promise.allSettled(jobs);
  const items: IntelItem[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      stderr("NOTAM source failed", result.reason);
    }
  }

  return items;
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-notams", error);
      jsonStdout([]);
    });
}
