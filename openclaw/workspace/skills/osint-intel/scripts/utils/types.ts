export type Severity = "critical" | "high" | "medium" | "low";
export type IntelRegion =
  | "middle_east"
  | "ukraine"
  | "europe"
  | "pacific"
  | "africa"
  | "east_asia"
  | "military"
  | "global"
  | "us";
export type IntelCategory = "news" | "conflict" | "notam" | "military_movement";

export interface IntelItem {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: IntelRegion | "";
  category: IntelCategory | "";
  severity: Severity | "";
  raw_data: unknown;
}

export interface FetchResult {
  items: IntelItem[];
  source: string;
}

export const USER_AGENT = "PyRoBOT/0.1 (Intelligence Aggregator)";
export const HTTP_TIMEOUT_MS = 30_000;
export const SUMMARY_MAX_LENGTH = 500;

export function nowIso(): string {
  return new Date().toISOString();
}

export function truncate(text: string, maxLength = SUMMARY_MAX_LENGTH): string {
  if (!text) return "";
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
}

export function cleanHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function toIsoOrNow(input: unknown): string {
  if (typeof input === "string" || typeof input === "number") {
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return nowIso();
}

export function jsonStdout(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function stderr(message: string, error?: unknown): void {
  const detail = error instanceof Error ? `: ${error.message}` : "";
  process.stderr.write(`[osint-intel] ${message}${detail}\n`);
}
