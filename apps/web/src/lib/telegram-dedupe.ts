export type TelegramMediaLike = {
  url: string;
};

export type TelegramMessageLike = {
  link: string;
  datetime: string;
  text_en: string;
  text_original: string;
  image_text_en?: string;
  views: string;
  media: TelegramMediaLike[];
};

const DEDUPE_STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "have", "has", "are", "was", "were", "will",
  "about", "after", "into", "over", "under", "their", "there", "they", "them", "said", "says", "more",
  "intel", "news", "update", "breaking", "report", "reports",
]);

export function fastHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeDedupeText(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][a-z0-9_]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\b(?:follow|subscribe|join|source|via|breaking|update|reportedly)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.slice(0, 1200);
}

export function tokenizeDedupeText(value: string): string[] {
  if (!value) return [];
  const tokens = value
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !DEDUPE_STOPWORDS.has(token));
  return Array.from(new Set(tokens)).slice(0, 96);
}

export function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function messageMediaSignature(message: TelegramMessageLike): string {
  if (!Array.isArray(message.media) || message.media.length === 0) return "";
  const mediaKeys = message.media
    .map((media) => {
      const parts = media.url.split("/").filter(Boolean);
      return parts.at(-1) ?? media.url;
    })
    .sort();
  return mediaKeys.join("|").slice(0, 260);
}

export function isSameTelegramMessage(a: TelegramMessageLike, b: TelegramMessageLike): boolean {
  return (
    a.link === b.link &&
    a.datetime === b.datetime &&
    a.text_original === b.text_original &&
    a.text_en === b.text_en &&
    a.image_text_en === b.image_text_en &&
    a.views === b.views &&
    a.media.length === b.media.length &&
    a.media.every((media, index) => media.url === b.media[index]?.url)
  );
}
