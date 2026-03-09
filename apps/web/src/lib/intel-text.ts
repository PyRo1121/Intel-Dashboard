import type { IntelItem } from "./types.ts";

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " ",
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_match, entity) => {
    const normalized = String(entity).toLowerCase();
    if (normalized.startsWith("#x")) {
      const code = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    if (normalized.startsWith("#")) {
      const code = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }
    return NAMED_HTML_ENTITIES[normalized] ?? `&${entity};`;
  });
}

export function sanitizeIntelText(value: string | undefined): string {
  if (!value) return "";
  let next = value;
  for (let pass = 0; pass < 3; pass += 1) {
    const decoded = decodeHtmlEntities(next);
    if (decoded === next) break;
    next = decoded;
  }
  return next
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function trimSmart(value: string, maxChars = 360): string {
  if (value.length <= maxChars) return value;
  const sliced = value.slice(0, maxChars);
  const boundary = sliced.lastIndexOf(" ");
  const base = boundary > Math.floor(maxChars * 0.65) ? sliced.slice(0, boundary) : sliced;
  return `${base.trim()}...`;
}

export function normalizeIntelSummary(summaryRaw: string, title: string): string {
  let summary = sanitizeIntelText(summaryRaw)
    .replace(/\bThe post .*? appeared first on .*?\.?/gi, "")
    .replace(/\bLatest Updates\b[\s\S]*$/i, "")
    .replace(/\bFollow(?:ing)? .*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (title && summary.toLowerCase().startsWith(title.toLowerCase())) {
    summary = summary.slice(title.length).replace(/^[-:;,.–—\s]+/, "").trim();
  }
  return trimSmart(summary || title, 340);
}

export function normalizeIntelItem(item: IntelItem): IntelItem {
  const title = trimSmart(sanitizeIntelText(item.title), 180);
  const source = trimSmart(sanitizeIntelText(item.source), 64);
  const summary = normalizeIntelSummary(item.summary, title);
  return { ...item, title, source, summary };
}
