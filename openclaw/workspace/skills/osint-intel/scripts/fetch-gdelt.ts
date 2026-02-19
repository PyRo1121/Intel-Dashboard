import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { scoreGdeltTone } from "./utils/scorer";
import {
  cleanHtml,
  HTTP_TIMEOUT_MS,
  jsonStdout,
  nowIso,
  stderr,
  toIsoOrNow,
  truncate,
  USER_AGENT,
  type IntelItem,
  type IntelRegion,
} from "./utils/types";

const GDELT_ENDPOINT = "https://api.gdeltproject.org/api/v2/doc/doc";
const SOURCE_COUNTRY_FILTER = "(sourcecountry:US OR sourcecountry:GB)";
const CACHE_DIR = "/home/pyro1121/.openclaw/workspace/skills/osint-intel/cache";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (response.status === 429 && attempt < retries - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        stderr(`GDELT 429, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt < retries - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        stderr(`GDELT network error, retrying in ${delay}ms`, err);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("GDELT: max retries exhausted");
}

async function getCachedOrFetch(regionKey: string, url: string): Promise<string | null> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cachePath = `${CACHE_DIR}/gdelt-${regionKey}.json`;

  if (existsSync(cachePath)) {
    try {
      const stat = Bun.file(cachePath);
      const age = Date.now() - stat.lastModified;
      if (age < CACHE_TTL_MS) {
        return await readFile(cachePath, "utf8");
      }
    } catch { }
  }

  const response = await fetchWithRetry(url);
  if (response.status === 429) {
    stderr(`GDELT ${regionKey} rate limited after retries, using stale cache if available`);
    if (existsSync(cachePath)) {
      return await readFile(cachePath, "utf8");
    }
    return null;
  }
  if (!response.ok) {
    throw new Error(`GDELT ${regionKey} returned ${response.status}`);
  }

  const body = await response.text();
  try {
    JSON.parse(body);
    await writeFile(cachePath, body, "utf8");
  } catch {
    stderr(`GDELT ${regionKey} returned non-JSON, not caching: ${body.slice(0, 80)}`);
    return null;
  }
  return body;
}

const REGION_QUERIES: Record<string, string> = {
  middle_east:
    '("Middle East" OR Israel OR Palestine OR Gaza OR Iran OR Syria OR Iraq OR Yemen OR Lebanon OR "Red Sea" OR Houthi)',
  ukraine: '(Ukraine OR Kyiv OR Donbas OR Crimea OR "Russian forces" OR Zaporizhzhia)',
  military:
    '("US military" OR Pentagon OR CENTCOM OR "aircraft carrier" OR "B-52" OR NATO OR "military exercise")',
};

function buildUrl(query: string): string {
  const scopedQuery = `${query} ${SOURCE_COUNTRY_FILTER}`;
  const params = new URLSearchParams({
    query: scopedQuery,
    mode: "ArtList",
    format: "json",
    sort: "DateDesc",
    timespan: "24h",
  });
  return `${GDELT_ENDPOINT}?${params.toString()}`;
}

function regionFromKey(key: string): IntelRegion {
  if (key === "middle_east" || key === "ukraine") return key;
  return "global";
}

async function fetchRegion(regionKey: string, query: string): Promise<IntelItem[]> {
  const url = buildUrl(query);

  let body: string | null;
  try {
    body = await getCachedOrFetch(regionKey, url);
  } catch (err) {
    stderr(`GDELT ${regionKey} fetch failed`, err);
    return [];
  }

  if (!body) return [];

  let payload: { articles?: Array<Record<string, unknown>> };
  try {
    payload = JSON.parse(body);
  } catch {
    stderr(`GDELT ${regionKey} returned non-JSON: ${body.slice(0, 100)}`);
    return [];
  }

  const articles = payload.articles ?? [];
  return articles.slice(0, 20).map((article) => {
    const title = String(article.title ?? "GDELT event");
    const summary = cleanHtml(String(article.seendate ?? article.title ?? ""));
    const tone = article.tone;

    return {
      title,
      summary: truncate(summary || title),
      source: "GDELT",
      url: String(article.url ?? article.socialimage ?? ""),
      timestamp: toIsoOrNow(article.seendate ?? article.seendateutc ?? article.date),
      region: regionFromKey(regionKey),
      category: "conflict",
      severity: scoreGdeltTone(tone),
      raw_data: article,
    } satisfies IntelItem;
  });
}

export async function run(): Promise<IntelItem[]> {
  const entries = Object.entries(REGION_QUERIES);
  const items: IntelItem[] = [];

  for (const [region, query] of entries) {
    try {
      const regionItems = await fetchRegion(region, query);
      items.push(...regionItems);
    } catch (err) {
      stderr("GDELT fetch failed", err);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return items.map((item) => ({ ...item, timestamp: item.timestamp || nowIso() }));
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-gdelt", error);
      jsonStdout([]);
    });
}
