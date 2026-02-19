import { scoreRssText } from "./utils/scorer";
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

type FeedDef = { name: string; url: string; fallbackUrls?: string[] };

const FEEDS: Record<string, FeedDef[]> = {
  middle_east: [
    { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
    { name: "Times of Israel", url: "https://www.timesofisrael.com/feed/" },
    { name: "NYT Middle East", url: "https://rss.nytimes.com/services/xml/rss/nyt/MiddleEast.xml" },
    { name: "Guardian Middle East", url: "https://www.theguardian.com/world/middleeast/rss" },
    { name: "Jerusalem Post", url: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx" },
    { name: "Google News Middle East", url: "https://news.google.com/rss/search?q=middle+east+conflict+war&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News Reuters ME", url: "https://news.google.com/rss/search?q=site:reuters.com+middle+east&hl=en-US&gl=US&ceid=US:en" },
    { name: "Foreign Policy", url: "https://foreignpolicy.com/feed/" },
  ],
  ukraine: [
    { name: "Ukrinform", url: "https://www.ukrinform.net/rss/block-lastnews" },
    { name: "Ukrainska Pravda", url: "https://www.pravda.com.ua/eng/rss/" },
    { name: "Guardian Ukraine", url: "https://www.theguardian.com/world/ukraine/rss" },
    { name: "Google News Ukraine", url: "https://news.google.com/rss/search?q=ukraine+war+frontline&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News Kyiv Independent", url: "https://news.google.com/rss/search?q=site:kyivindependent.com&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News Reuters Ukraine", url: "https://news.google.com/rss/search?q=site:reuters.com+ukraine+russia&hl=en-US&gl=US&ceid=US:en" },
    { name: "War on the Rocks", url: "https://warontherocks.com/feed/" },
  ],
  military: [
    { name: "Defense One", url: "https://www.defenseone.com/rss/all/" },
    { name: "Breaking Defense", url: "https://breakingdefense.com/feed/" },
    { name: "Defense News", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "USNI News", url: "https://news.usni.org/feed" },
    { name: "Military Times", url: "https://www.militarytimes.com/arc/outboundfeeds/rss/?outputType=xml" },
    { name: "EUCOM", url: "https://www.eucom.mil/rss" },
    { name: "AFRICOM", url: "https://www.africom.mil/rss" },
    { name: "DoD News", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=1&Site=945&max=10" },
    { name: "Google News CENTCOM", url: "https://news.google.com/rss/search?q=CENTCOM+military+operations&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News US Military", url: "https://news.google.com/rss/search?q=US+military+deployment+posturing&hl=en-US&gl=US&ceid=US:en" },
    { name: "The War Zone", url: "https://www.thedrive.com/the-war-zone/feed" },
    { name: "CSIS", url: "https://www.csis.org/rss.xml" },
    { name: "RAND", url: "https://www.rand.org/blog.xml" },
  ],
  africa: [
    { name: "AFRICOM", url: "https://www.africom.mil/rss" },
    { name: "Google News Africa Security", url: "https://news.google.com/rss/search?q=africa+conflict+security+military&hl=en-US&gl=US&ceid=US:en" },
    { name: "Google News Reuters Africa", url: "https://news.google.com/rss/search?q=site:reuters.com+africa+conflict&hl=en-US&gl=US&ceid=US:en" },
  ],
  east_asia: [
    { name: "Google News East Asia", url: "https://news.google.com/rss/search?q=east+asia+military+tensions+china+taiwan&hl=en-US&gl=US&ceid=US:en" },
    { name: "The Diplomat", url: "https://thediplomat.com/feed/" },
    { name: "SCMP", url: "https://www.scmp.com/rss/91/feed" },
  ],
  nuclear: [
    { name: "Arms Control Wonk", url: "https://www.armscontrolwonk.com/feed/" },
    { name: "38 North", url: "https://www.38north.org/feed/" },
  ],
  milblog: [
    { name: "Defence Blog", url: "https://defence-blog.com/feed/" },
    { name: "Militarnyi", url: "https://mil.in.ua/en/feed/" },
    { name: "Long War Journal", url: "https://www.longwarjournal.org/feed" },
    {
      name: "ISW",
      url: "https://www.understandingwar.org/backgrounder/ukraine-conflict-updates/rss.xml",
      fallbackUrls: [
        "https://www.understandingwar.org/rss.xml",
        "https://r.jina.ai/http://www.understandingwar.org/backgrounder/ukraine-conflict-updates/rss.xml",
      ],
    },
    { name: "The War Zone", url: "https://www.twz.com/feed" },
    { name: "Oryx", url: "https://www.oryxspioenkop.com/feeds/posts/default" },
  ],
  global: [
    { name: "BBC World", url: "http://feeds.bbci.co.uk/news/world/rss.xml" },
    { name: "NYT World", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
    { name: "Washington Post World", url: "https://feeds.washingtonpost.com/rss/world" },
    { name: "Google News Reuters World", url: "https://news.google.com/rss/search?q=site:reuters.com+world+news&hl=en-US&gl=US&ceid=US:en" },
    { name: "Financial Times", url: "https://www.ft.com/rss/home" },
    { name: "Bellingcat", url: "https://www.bellingcat.com/feed/" },
  ],
};

function mapRegion(group: string): IntelRegion {
  if (group === "middle_east" || group === "ukraine" || group === "global") {
    return group;
  }
  if (group === "africa") return "africa";
  if (group === "east_asia") return "east_asia";
  if (group === "military") return "military";
  if (group === "nuclear") return "military";
  if (group === "milblog") return "ukraine";
  return "global";
}

function matchTag(block: string, tag: string): string {
  const direct = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(block)?.[1] ?? "";
  if (direct) return cleanHtml(direct);

  const atom = new RegExp(`<${tag}[^>]*/>`, "i").exec(block)?.[0] ?? "";
  return cleanHtml(atom);
}

function matchLink(block: string): string {
  const rssLink = /<link[^>]*>([\s\S]*?)<\/link>/i.exec(block)?.[1];
  if (rssLink) return cleanHtml(rssLink);

  const atomLink = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i.exec(block)?.[1];
  return cleanHtml(atomLink ?? "");
}

function parseItems(xml: string): Array<Record<string, string>> {
  const blocks = [
    ...(xml.match(/<item[\s\S]*?<\/item>/gi) ?? []),
    ...(xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? []),
  ];

  return blocks.map((block) => ({
    title: matchTag(block, "title"),
    summary: matchTag(block, "description") || matchTag(block, "summary") || matchTag(block, "content"),
    url: matchLink(block),
    timestamp:
      matchTag(block, "pubDate") ||
      matchTag(block, "updated") ||
      matchTag(block, "published") ||
      new Date().toISOString(),
  }));
}

function scoreFeedItem(group: string, text: string): IntelItem["severity"] {
  const base = scoreRssText(text);
  if (group !== "milblog") return base;
  if (base === "critical") return base;

  const lower = text.toLowerCase();
  if (/frontline|drone|missile|artillery|brigade|battalion|air defense|strike/.test(lower)) {
    return base === "medium" ? "high" : base;
  }

  return base;
}

async function fetchFeed(group: string, feed: FeedDef): Promise<IntelItem[]> {
  const candidates = [feed.url, ...(feed.fallbackUrls ?? [])];
  let xml = "";
  let lastError = "";

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        headers: {
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": USER_AGENT,
        },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!response.ok) {
        lastError = `${candidate} -> ${response.status}`;
        continue;
      }

      const body = await response.text();
      if (!body.includes("<item") && !body.includes("<entry")) {
        lastError = `${candidate} -> non-rss payload`;
        continue;
      }

      xml = body;
      break;
    } catch (err) {
      lastError = `${candidate} -> ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  if (!xml) {
    throw new Error(`${feed.name} unavailable (${lastError || "no candidate succeeded"})`);
  }

  const parsed = parseItems(xml).slice(0, 10);

  return parsed.map((entry) => {
    const summary = truncate(entry.summary || entry.title);
    const combined = `${entry.title} ${summary}`;
    return {
      title: entry.title || `${feed.name} item`,
      summary,
      source: feed.name,
      url: entry.url || feed.url,
      timestamp: toIsoOrNow(entry.timestamp),
      region: mapRegion(group),
      category: "news",
      severity: scoreFeedItem(group, combined),
      raw_data: entry,
    } satisfies IntelItem;
  });
}

export async function run(): Promise<IntelItem[]> {
  const jobs = Object.entries(FEEDS).flatMap(([group, feeds]) =>
    feeds.map((feed) => fetchFeed(group, feed)),
  );
  const settled = await Promise.allSettled(jobs);

  const items: IntelItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      stderr("RSS fetch failed", result.reason);
    }
  }
  return items;
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-rss", error);
      jsonStdout([]);
    });
}
