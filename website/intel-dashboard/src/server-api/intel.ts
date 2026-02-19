import type { APIEvent } from "@solidjs/start/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_PATH = join(homedir(), ".openclaw/workspace/skills/osint-intel/state/latest-events.json");
const UA = "PyRoBOT/0.1 (Intelligence Dashboard)";
const TIMEOUT = 15_000;
const CACHE_TTL = 5 * 60 * 1000;

let cache: { data: unknown[]; ts: number } | null = null;
let inFlight: Promise<unknown[]> | null = null;

type Severity = "critical" | "high" | "medium" | "low";

interface RawIntel {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: string;
  category: string;
  severity: Severity | "";
}

function cleanHtml(text: string): string {
  if (!text) return "";
  let s = text;
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Decode entities before stripping tags (MEE RSS uses &lt;article&gt; style encoding)
  s = s.replace(/&nbsp;/gi, " ");
  s = s.replace(/&lt;/gi, "<");
  s = s.replace(/&gt;/gi, ">");
  s = s.replace(/&amp;/gi, "&");
  s = s.replace(/&#39;/gi, "'");
  s = s.replace(/&quot;/gi, '"');
  s = s.replace(/&#\d+;/g, "");
  s = s.replace(/&\w+;/g, " ");
  s = s.replace(/<[^>]*>/g, " ");
  s = s.replace(/https?:\/\/[^\s"'<>]+/g, "");
  s = s.replace(/\b(class|rel|href|about|data-[\w-]+)\s*=\s*["'][^"']*["']/gi, "");
  s = s.replace(/Submitted by\s+[\w\s-]+\s+on\s+\w{3},\s+\d{2}\/\d{2}\/\d{4}\s+-\s+\d{2}:\d{2}/gi, "");
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  // If after cleaning, the result looks like garbage (too short or just a domain), return empty
  if (s.length < 10 && !s.includes(" ")) return "";
  return s;
}

function dedupTitle(summary: string, title: string): string {
  if (!summary || !title) return summary;
  const s = summary.trim();
  if (s.startsWith(title)) return s.slice(title.length).trim();
  return s;
}

function truncate(text: string, max = 400): string {
  if (!text) return "";
  const n = text.replace(/\s+/g, " ").trim();
  return n.length > max ? n.slice(0, max - 3) + "..." : n;
}

function scoreSeverity(text: string): Severity {
  const t = text.toLowerCase();
  const critical = ["killed", "airstrike", "missile", "explosion", "nuclear", "attack", "dead", "strike", "bomb", "icbm", "chemical weapon", "massacre", "genocide", "catastroph", "pandemic", "outbreak", "zero-day", "critical vulnerability", "ransomware attack"];
  const high = ["military", "forces", "troops", "weapon", "conflict", "escalat", "ceasefire", "invasion", "offensive", "sanctions", "coup", "assassination", "hostage", "blockade", "insurgent", "drone strike", "artillery", "mobiliz", "malware", "cyber attack", "data breach", "epidemic", "famine", "humanitarian crisis", "displacement", "refugee"];
  const medium = ["warn", "threat", "tension", "deploy", "exercise", "negotiate", "diplomat", "embargo", "surveillance", "espionage", "defect", "provocat", "postur", "drill", "vulnerability", "advisory", "phishing", "disease", "cholera", "measles", "polio", "contamination"];
  if (critical.some((k) => t.includes(k))) return "critical";
  if (high.some((k) => t.includes(k))) return "high";
  if (medium.some((k) => t.includes(k))) return "medium";
  return "low";
}

function detectRegion(text: string): string {
  const t = text.toLowerCase();
  if (/israel|palestin|gaza|iran|syria|iraq|yemen|lebanon|houthi|red sea|hezbollah|hamas/.test(t)) return "middle_east";
  if (/ukrain|kyiv|donbas|crimea|zaporizhzhia|russian forces|kherson|odesa/.test(t)) return "ukraine";
  if (/eu |europe|nato |germany|france|poland|uk |britain|balkans/.test(t)) return "europe";
  if (/china|taiwan|korea|japan|pacific|indo-pacific|south china sea|pla navy/.test(t)) return "pacific";
  if (/pentagon|us military|centcom|congress|white house|indopacom|eucom/.test(t)) return "us";
  if (/africa|sahel|sudan|ethiopia|somalia|nigeria|congo|niger|mali|wagner/.test(t)) return "africa";
  if (/nuclear|icbm|ballistic missile|nonproliferation|nuclear test|iaea|uranium|plutonium/.test(t)) return "nuclear";
  if (/cyber|malware|ransomware|cisa|vulnerability|cve-|zero.day|phishing|apt\d/.test(t)) return "global";
  return "global";
}

function parseGdeltDate(raw: string): string {
  // GDELT seendate format: "20260212T040000Z" or "2026-02-12T04:00:00Z"
  try {
    const s = String(raw);
    if (/^\d{8}T\d{6}Z?$/.test(s)) {
      const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8);
      const h = s.slice(9, 11), mi = s.slice(11, 13), sc = s.slice(13, 15);
      return new Date(`${y}-${m}-${d}T${h}:${mi}:${sc}Z`).toISOString();
    }
    return new Date(s).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function fetchGDELT(): Promise<RawIntel[]> {
  const queries: Record<string, string> = {
    middle_east: '("Middle East" OR Israel OR Gaza OR Iran OR Syria OR Yemen OR Houthi OR Hezbollah OR "Red Sea") sourcelang:eng',
    ukraine: '(Ukraine OR Kyiv OR Donbas OR Crimea OR "Russian forces" OR Zaporizhzhia OR Kherson) sourcelang:eng',
    military: '("US military" OR Pentagon OR CENTCOM OR NATO OR "aircraft carrier" OR EUCOM OR INDOPACOM OR "military exercise") sourcelang:eng',
    east_asia: '(Taiwan OR "South China Sea" OR "Chinese military" OR "North Korea" OR "Korean peninsula" OR "PLA Navy") sourcelang:eng',
    africa: '(Africa OR "Wagner group" OR Sahel OR Sudan OR Ethiopia OR Somalia OR "Boko Haram" OR "al-Shabaab") sourcelang:eng',
    nuclear: '(nuclear OR ICBM OR "ballistic missile" OR "nuclear test" OR "nuclear deal" OR nonproliferation) sourcelang:eng',
  };

  const results: RawIntel[] = [];
  const fetches = Object.entries(queries).map(async ([region, query]) => {
    try {
      // GDELT requires + for spaces and no double-wrapping of parentheses
      const encoded = encodeURIComponent(query).replace(/%20/g, "+");
      const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}&mode=ArtList&format=json&sort=DateDesc&timespan=24h`;
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT) });
      if (!res.ok) return;
      const text = await res.text();
      // GDELT sometimes returns HTML error pages or empty bodies
      if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) return;
      const data = JSON.parse(text) as { articles?: Record<string, unknown>[] };
      for (const art of (data.articles ?? []).slice(0, 15)) {
        const title = String(art.title ?? "");
        if (!title) continue;
        results.push({
          title,
          summary: truncate(title),
          source: "GDELT",
          url: String(art.url ?? ""),
          timestamp: art.seendate ? parseGdeltDate(String(art.seendate)) : new Date().toISOString(),
          region: region === "middle_east" || region === "ukraine" ? region : detectRegion(title),
          category: "conflict",
          severity: scoreSeverity(title),
        });
      }
    } catch { /* skip failed region */ }
  });
  await Promise.allSettled(fetches);
  return results;
}

const RSS_FEEDS: { name: string; url: string; region: string }[] = [
  { name: "BBC Middle East", url: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", region: "middle_east" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", region: "middle_east" },
  { name: "BBC Europe", url: "https://feeds.bbci.co.uk/news/world/europe/rss.xml", region: "europe" },
  { name: "Breaking Defense", url: "https://breakingdefense.com/feed/", region: "global" },
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", region: "global" },
  { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", region: "global" },
  { name: "The Guardian", url: "https://www.theguardian.com/world/rss", region: "global" },
  { name: "AP News", url: "https://rsshub.app/apnews/topics/world-news", region: "global" },
  { name: "BBC Asia", url: "https://feeds.bbci.co.uk/news/world/asia/rss.xml", region: "pacific" },
  { name: "BBC Africa", url: "https://feeds.bbci.co.uk/news/world/africa/rss.xml", region: "africa" },
  { name: "CENTCOM", url: "https://www.centcom.mil/RSS/", region: "middle_east" },
  { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml", region: "global" },
  { name: "Stars & Stripes", url: "https://www.stripes.com/rss", region: "global" },
  { name: "Liveuamap", url: "https://liveuamap.com/rss", region: "ukraine" },
  { name: "Middle East Eye", url: "https://www.middleeasteye.net/rss", region: "middle_east" },
  { name: "Reuters World", url: "https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best", region: "global" },
  { name: "War on the Rocks", url: "https://warontherocks.com/feed/", region: "global" },
  { name: "BBC Latin America", url: "https://feeds.bbci.co.uk/news/world/latin_america/rss.xml", region: "global" },
  { name: "NK News", url: "https://www.nknews.org/feed/", region: "pacific" },
  { name: "The Diplomat", url: "https://thediplomat.com/feed/", region: "pacific" },
  { name: "Janes Defence", url: "https://www.janes.com/feeds/news", region: "global" },
  { name: "SIPRI News", url: "https://www.sipri.org/rss.xml", region: "global" },
  { name: "CISA Advisories", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", region: "global" },
  { name: "WHO Outbreaks", url: "https://www.who.int/feeds/entity/don/en/rss.xml", region: "global" },
  { name: "Crisis Group", url: "https://www.crisisgroup.org/rss-0", region: "global" },
  { name: "Bellingcat", url: "https://www.bellingcat.com/feed/", region: "global" },
  { name: "IAEA News", url: "https://www.iaea.org/feeds", region: "nuclear" },
];

function parseRssItems(xml: string): Array<{ title: string; summary: string; url: string; timestamp: string }> {
  const blocks = [...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []), ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [])];
  return blocks.map((block) => {
    const tag = (t: string) => {
      const m = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i").exec(block);
      return cleanHtml(m?.[1] ?? "");
    };
    const link = () => {
      const rss = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block);
      if (rss) return cleanHtml(rss[1]);
      const atom = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block);
      return cleanHtml(atom?.[1] ?? "");
    };
    return {
      title: tag("title"),
      summary: tag("description") || tag("summary") || tag("content"),
      url: link(),
      timestamp: tag("pubDate") || tag("updated") || tag("published") || new Date().toISOString(),
    };
  });
}

async function fetchRSS(): Promise<RawIntel[]> {
  const results: RawIntel[] = [];
  const fetches = RSS_FEEDS.map(async (feed) => {
    try {
      const res = await fetch(feed.url, {
        headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": UA },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (!res.ok) return;
      const xml = await res.text();
      for (const item of parseRssItems(xml).slice(0, 12)) {
        if (!item.title) continue;
        const combined = `${item.title} ${item.summary}`;
        const detectedRegion = detectRegion(combined);
        results.push({
          title: item.title,
          summary: truncate(dedupTitle(item.summary, item.title) || item.title),
          source: feed.name,
          url: item.url || feed.url,
          timestamp: (() => { try { return new Date(item.timestamp).toISOString(); } catch { return new Date().toISOString(); } })(),
          region: detectedRegion !== "global" ? detectedRegion : feed.region,
          category: "news",
          severity: scoreSeverity(combined),
        });
      }
    } catch { /* skip failed feed */ }
  });
  await Promise.allSettled(fetches);
  return results;
}

function dedup(items: RawIntel[]): RawIntel[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchUCDP(): Promise<RawIntel[]> {
  try {
    const res = await fetch("https://ucdpapi.pcr.uu.se/api/gedevents/26.1?pagesize=20&page=0", {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { Result?: Array<{ id: number; date_start: string; country: string; region: string; source_article: string; best: number; high: number; type_of_violence: number; side_a: string; side_b: string; where_description: string }> };
    return (data.Result ?? []).map((e) => {
      const title = `${e.side_a} vs ${e.side_b} in ${e.where_description || e.country}`;
      const fatalities = e.best || e.high || 0;
      const summary = `Conflict event: ${title}. Fatalities: ${fatalities}. Type: ${e.type_of_violence === 1 ? "state-based" : e.type_of_violence === 2 ? "non-state" : "one-sided"}. Region: ${e.region}.`;
      return {
        title: truncate(title, 200),
        summary: truncate(summary),
        source: "UCDP",
        url: e.source_article || `https://ucdp.uu.se/event/${e.id}`,
        timestamp: (() => { try { return new Date(e.date_start).toISOString(); } catch { return new Date().toISOString(); } })(),
        region: detectRegion(title + " " + (e.country ?? "") + " " + (e.region ?? "")),
        category: "conflict",
        severity: fatalities >= 10 ? "critical" as Severity : fatalities >= 3 ? "high" as Severity : "medium" as Severity,
      };
    });
  } catch { return []; }
}

async function fetchReliefWeb(): Promise<RawIntel[]> {
  try {
    const res = await fetch("https://api.reliefweb.int/v1/reports?appname=pyrobot&limit=20&sort[]=date:desc&fields[include][]=title&fields[include][]=date.original&fields[include][]=source&fields[include][]=url_alias&fields[include][]=body", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ fields: { title: string; date?: { original: string }; source?: Array<{ name: string }>; url_alias?: string; body?: string } }> };
    return (data.data ?? []).map((r) => {
      const f = r.fields;
      const title = f.title || "";
      const body = f.body ? cleanHtml(f.body).slice(0, 300) : "";
      return {
        title: truncate(title, 200),
        summary: truncate(body || title),
        source: "ReliefWeb",
        url: f.url_alias ? `https://reliefweb.int${f.url_alias}` : "https://reliefweb.int",
        timestamp: (() => { try { return new Date(f.date?.original ?? "").toISOString(); } catch { return new Date().toISOString(); } })(),
        region: detectRegion(title + " " + body),
        category: "humanitarian",
        severity: scoreSeverity(title + " " + body),
      };
    });
  } catch { return []; }
}

async function fetchLiveIntel(): Promise<unknown[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  
  // In-flight dedupe: if refresh already running, wait for it
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const [gdelt, rss, ucdp, reliefweb] = await Promise.allSettled([fetchGDELT(), fetchRSS(), fetchUCDP(), fetchReliefWeb()]);
    const all: RawIntel[] = [];
    if (gdelt.status === "fulfilled") all.push(...gdelt.value);
    if (rss.status === "fulfilled") all.push(...rss.value);
    if (ucdp.status === "fulfilled") all.push(...ucdp.value);
    if (reliefweb.status === "fulfilled") all.push(...reliefweb.value);

    const unique = dedup(all);
    unique.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, "": 4 };
      const sev = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (sev !== 0) return sev;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    cache = { data: unique, ts: Date.now() };

    // Atomic write: write to temp file then rename
    try {
      const { writeFile, rename, mkdir } = await import("node:fs/promises");
      const dir = join(homedir(), ".openclaw/workspace/skills/osint-intel/state");
      await mkdir(dir, { recursive: true });
      const tempPath = join(dir, "latest-events.json.tmp");
      const finalPath = join(dir, "latest-events.json");
      await writeFile(tempPath, JSON.stringify(unique, null, 2));
      await rename(tempPath, finalPath);
    } catch (e) { console.error("[intel] atomic write failed:", e); }

    return unique;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export async function GET(_event: APIEvent) {
  try {
    const data = await fetchLiveIntel();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch {
    try {
      const fallback = await readFile(STATE_PATH, "utf-8");
      return new Response(fallback, { headers: { "Content-Type": "application/json" } });
    } catch {
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    }
  }
}
