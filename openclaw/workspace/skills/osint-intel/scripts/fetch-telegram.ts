import { readFile } from "node:fs/promises";
import {
  jsonStdout,
  stderr,
  toIsoOrNow,
  truncate,
  cleanHtml,
  type IntelItem,
  type IntelRegion,
  type Severity,
} from "./utils/types";

const TELEGRAM_STATE_PATH =
  "/home/pyro1121/.openclaw/workspace/skills/telegram-intel/state/latest-telegram-intel.json";

const PRIORITY_CATEGORIES = new Set([
  "ru_milblog",
  "ua_frontline",
  "ua_intel",
  "ua_osint",
  "en_analysis",
  "en_osint",
  "mapping",
  "drone",
  "air_defense",
  "naval",
  "satellite",
  "israel_milblog",
  "iran_milblog",
  "global_osint",
]);

type TelegramMessage = {
  text_original?: string;
  text_en?: string;
  datetime?: string;
  link?: string;
  views?: string;
  language?: string;
};

type TelegramChannel = {
  username?: string;
  label?: string;
  category?: string;
  messages?: TelegramMessage[];
};

type TelegramIntelState = {
  channels?: TelegramChannel[];
};

function parseViews(views: string | undefined): number {
  if (!views) return 0;
  const normalized = views.replace(/,/g, "").trim().toUpperCase();
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);
  if (!match) {
    const parsed = Number.parseInt(normalized.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const value = Number.parseFloat(match[1]);
  const unit = match[2];
  if (!unit) return Math.round(value);
  if (unit === "K") return Math.round(value * 1_000);
  if (unit === "M") return Math.round(value * 1_000_000);
  return Math.round(value * 1_000_000_000);
}

function detectRegion(text: string): IntelRegion {
  const t = text.toLowerCase();
  if (/ukrain|kyiv|donbas|crimea|kherson|zaporizh|odessa|dnipro/.test(t)) return "ukraine";
  if (/israel|gaza|iran|syria|iraq|yemen|lebanon|houthi|hezbollah|hamas|idf|irgc|tehran|persian gulf|red sea|qassam|iron dome|true promise/.test(t)) return "middle_east";
  if (/taiwan|south china sea|pla|korea|japan|indo-pacific/.test(t)) return "east_asia";
  if (/sahel|sudan|ethiopia|somalia|niger|mali|congo/.test(t)) return "africa";
  if (/pentagon|centcom|eucom|nato|us military|raf|bundeswehr/.test(t)) return "military";
  if (/russia|moscow|kremlin|belgorod|kursk|rostov/.test(t)) return "europe";
  return "global";
}

function scoreSeverity(text: string, views: number, category: string): Severity {
  const t = text.toLowerCase();

  const critical = [
    "ballistic",
    "icbm",
    "nuclear",
    "strategic bomber",
    "mass casualty",
    "dam breach",
    "chemical",
    "killed",
    "dead",
    "strike on",
    "true promise",
    "iron dome intercept",
    "ground invasion",
    "full-scale war",
    "carrier strike",
  ];
  if (critical.some((k) => t.includes(k))) return "critical";

  const high = [
    "airstrike",
    "missile",
    "drone strike",
    "atacms",
    "iskander",
    "shahed",
    "frontline",
    "offensive",
    "counteroffensive",
    "mobilization",
    "artillery",
    "air defense",
    "iron dome",
    "qassam",
    "hezbollah",
    "irgc",
    "idf",
    "houthi",
    "retaliation",
    "interceptor",
    "bunker buster",
  ];
  let severity: Severity = high.some((k) => t.includes(k)) ? "high" : "medium";

  const isMilblogSignal = category === "ru_milblog" || category === "ua_frontline" || category === "ua_intel" || category === "israel_milblog" || category === "iran_milblog" || category === "global_osint";
  if (isMilblogSignal && views >= 50_000 && severity === "medium") severity = "high";
  if (isMilblogSignal && views >= 180_000 && severity === "high") severity = "critical";

  return severity;
}

function pickMessageText(message: TelegramMessage): string {
  return cleanHtml((message.text_en || message.text_original || "").trim());
}

function titleFromText(text: string): string {
  const firstSentence = text.split(/[.!?\n]/)[0] || text;
  return truncate(firstSentence, 180);
}

export async function run(): Promise<IntelItem[]> {
  const raw = await readFile(TELEGRAM_STATE_PATH, "utf8");
  const parsed = JSON.parse(raw) as TelegramIntelState;
  const channels = Array.isArray(parsed.channels) ? parsed.channels : [];

  const preferred = channels.filter((c) => PRIORITY_CATEGORIES.has(c.category ?? ""));
  const selected = (preferred.length > 0 ? preferred : channels).slice(0, 60);

  const items: IntelItem[] = [];
  for (const channel of selected) {
    const category = channel.category ?? "telegram";
    const sourceLabel = channel.label || channel.username || "Telegram";
    const messages = (channel.messages ?? []).slice(0, 6);

    for (const message of messages) {
      const text = pickMessageText(message);
      if (!text || text.length < 28) continue;

      const views = parseViews(message.views);
      items.push({
        title: titleFromText(text),
        summary: truncate(text, 420),
        source: `${sourceLabel} [tg:${category}]`,
        url: message.link || `https://t.me/${channel.username || ""}`,
        timestamp: toIsoOrNow(message.datetime),
        region: detectRegion(text),
        category: "news",
        severity: scoreSeverity(text, views, category),
        raw_data: {
          category,
          username: channel.username,
          views,
          language: message.language || "",
        },
      });
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, 220);
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in fetch-telegram", error);
      jsonStdout([]);
    });
}
