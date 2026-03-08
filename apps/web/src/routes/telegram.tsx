import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { ChevronLeft, ChevronRight, Clock, Copy, Eye, Image, LoaderCircle, MessageSquare, Radio, RefreshCw, Share2, Video, X } from "lucide-solid";
import {
  buildFreshnessStatusAt,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import { formatAgeCompactFromMs } from "~/lib/utils";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { TELEGRAM_DESCRIPTION, TELEGRAM_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";

interface TelegramMedia {
  type: "video" | "photo";
  url: string;
  thumbnail?: string;
}

interface TelegramMessage {
  text_original: string;
  text_en: string;
  image_text_en?: string;
  datetime: string;
  link: string;
  views: string;
  media: TelegramMedia[];
  has_video: boolean;
  has_photo: boolean;
  language: string;
}

interface TelegramChannel {
  username: string;
  label: string;
  category: string;
  language: string;
  message_count: number;
  messages: TelegramMessage[];
}

interface TelegramData {
  timestamp: string;
  total_channels: number;
  channels_fetched: number;
  total_messages: number;
  canonical_total_messages?: number;
  canonical_events?: TelegramCanonicalEvent[];
  dedupe_stats?: {
    raw_messages: number;
    canonical_messages: number;
    duplicates_collapsed: number;
    feedback_overrides: number;
  };
  categories: Record<string, string>;
  channels: TelegramChannel[];
}

interface TelegramCanonicalEventSource {
  signature: string;
  channel: string;
  label: string;
  category: string;
  trust_tier?: "core" | "verified" | "watch";
  latency_tier?: "instant" | "fast" | "monitor";
  source_type?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisition_method?: "telegram_public";
  domain_tags?: string[];
  subscriber_value_score?: number;
  message_id: string;
  link: string;
  datetime: string;
  views: string;
}

interface TelegramCanonicalEvent {
  event_id: string;
  event_key: string;
  datetime: string;
  category: string;
  categories: string[];
  domain_tags?: string[];
  trust_tier?: "core" | "verified" | "watch";
  latency_tier?: "instant" | "fast" | "monitor";
  source_type?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisition_method?: "telegram_public";
  subscriber_value_score?: number;
  freshness_tier?: "breaking" | "fresh" | "watch";
  verification_state?: "verified" | "corroborated" | "single_source";
  rank_score?: number;
  source_count: number;
  duplicate_count: number;
  source_labels: string[];
  source_channels: string[];
  text_original: string;
  text_en: string;
  image_text_en?: string;
  language: string;
  media: TelegramMedia[];
  has_video: boolean;
  has_photo: boolean;
  sources: TelegramCanonicalEventSource[];
}

interface TelegramEntry {
  category: string;
  channelLabel: string;
  channelUsername: string;
  message: TelegramMessage;
  dedupe?: TelegramDedupeMeta;
}

interface TelegramDedupeMeta {
  clusterKey: string;
  sourceCount: number;
  duplicateCount: number;
  sourceLabels: string[];
  categorySet: string[];
  sourceSignatures?: string[];
  domainTags?: string[];
  trustTier?: "core" | "verified" | "watch";
  latencyTier?: "instant" | "fast" | "monitor";
  sourceType?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisitionMethod?: "telegram_public";
  subscriberValueScore?: number;
  freshnessTier?: "breaking" | "fresh" | "watch";
  verificationState?: "verified" | "corroborated" | "single_source";
  rankScore?: number;
  sources?: TelegramCanonicalEventSource[];
}

type AgeWindow = "all" | "24h";
type FeedMode = "deduped" | "raw" | "verified";

type TelegramFilterGroup = {
  id: string;
  label: string;
  categories?: string[];
  predicate?: (entry: TelegramEntry) => boolean;
};

const TELEGRAM_FILTER_GROUPS: TelegramFilterGroup[] = [
  { id: "all", label: "Show all" },
  { id: "ukraine", label: "Ukraine", categories: ["ua_official", "ua_osint", "ua_intel", "ua_frontline", "ua_journalism"] },
  { id: "russia", label: "Russia", categories: ["ru_official", "ru_milblog"] },
  { id: "middle-east", label: "Middle East", categories: ["israel_milblog", "iran_milblog", "syria_osint", "middle_east_osint"] },
  { id: "africa", label: "Africa", categories: ["sudan_conflict", "africa_osint"] },
  { id: "asia-pacific", label: "Asia-Pacific", categories: ["asia_pacific_osint", "south_asia_osint", "weibo_satellite"] },
  { id: "americas", label: "Americas", categories: ["latam_security", "cartel_osint", "south_america_osint"] },
  {
    id: "osint-cyber",
    label: "OSINT Cyber",
    categories: ["cyber", "global_osint", "en_osint", "nuclear_monitoring"],
  },
  {
    id: "official",
    label: "Official",
    categories: ["ua_official", "ru_official"],
  },
  { id: "analysis", label: "Analysis & OSINT", categories: ["global_osint", "en_analysis", "en_osint", "think_tank", "nato_tracking"] },
  {
    id: "media-heavy",
    label: "Media-heavy",
    predicate: (entry) => entry.message.media.length > 0 || hasUsefulImageText(entry.message.image_text_en),
  },
  {
    id: "strategic",
    label: "Air / Sea / Strategic",
    categories: ["naval", "air_defense", "satellite", "weapons", "mapping", "drone", "nuclear_monitoring"],
  },
  {
    id: "military",
    label: "Military Ops",
    categories: ["weapons", "mapping", "cyber", "naval", "air_defense", "casualties", "satellite", "drone", "foreign_vol", "nuclear_monitoring"],
  },
];

const FILTER_GROUP_BY_ID = new Map(
  TELEGRAM_FILTER_GROUPS.map((group) => [group.id, group] as const),
);

const FILTER_GROUP_CATEGORY_SET = new Map(
  TELEGRAM_FILTER_GROUPS.map((group) => [group.id, new Set(group.categories ?? [])] as const),
);

const CATEGORY_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  ua_official: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-300" },
  ua_osint: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-300" },
  ua_intel: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-300" },
  ua_frontline: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-300" },
  ua_journalism: { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-300" },
  ru_official: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-300" },
  ru_milblog: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-300" },
  en_analysis: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  en_osint: { bg: "bg-lime-500/10", border: "border-lime-500/20", text: "text-lime-300" },
  weapons: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-300" },
  mapping: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300" },
  cyber: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-300" },
  naval: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-300" },
  air_defense: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-300" },
  casualties: { bg: "bg-stone-500/10", border: "border-stone-500/20", text: "text-stone-300" },
  satellite: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-300" },
  drone: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300" },
  foreign_vol: { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-300" },
  think_tank: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-300" },
  israel_milblog: { bg: "bg-blue-400/10", border: "border-blue-400/20", text: "text-blue-200" },
  iran_milblog: { bg: "bg-emerald-600/10", border: "border-emerald-600/20", text: "text-emerald-200" },
  global_osint: { bg: "bg-zinc-400/10", border: "border-zinc-400/20", text: "text-zinc-200" },
  middle_east_osint: { bg: "bg-amber-600/10", border: "border-amber-600/20", text: "text-amber-200" },
  africa_osint: { bg: "bg-yellow-600/10", border: "border-yellow-600/20", text: "text-yellow-200" },
  asia_pacific_osint: { bg: "bg-sky-600/10", border: "border-sky-600/20", text: "text-sky-200" },
  latam_security: { bg: "bg-lime-600/10", border: "border-lime-600/20", text: "text-lime-200" },
  nato_tracking: { bg: "bg-blue-600/10", border: "border-blue-600/20", text: "text-blue-200" },
  nuclear_monitoring: { bg: "bg-red-600/10", border: "border-red-600/20", text: "text-red-200" },
  weibo_satellite: { bg: "bg-rose-600/10", border: "border-rose-600/20", text: "text-rose-200" },
  syria_osint: { bg: "bg-orange-600/10", border: "border-orange-600/20", text: "text-orange-200" },
  sudan_conflict: { bg: "bg-red-700/10", border: "border-red-700/20", text: "text-red-200" },
  south_asia_osint: { bg: "bg-teal-600/10", border: "border-teal-600/20", text: "text-teal-200" },
  cartel_osint: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-200" },
  south_america_osint: { bg: "bg-lime-700/10", border: "border-lime-700/20", text: "text-lime-200" },
};

const DEFAULT_STYLE = { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-300" };

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}

function parseTs(input: string) {
  const ts = new Date(input).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function formatRelativeTimeLive(input: string, nowMs: number): string {
  const ts = parseTs(input);
  if (!ts) return "unknown";
  const delta = Math.max(0, nowMs - ts);
  const totalSeconds = Math.floor(delta / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s ago`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s ago`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${String(remMinutes).padStart(2, "0")}m ago`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${String(remHours).padStart(2, "0")}h ago`;
}

function messageText(msg: TelegramMessage) {
  return (msg.text_en || msg.text_original || "").trim();
}

function hasUsefulImageText(value: string | undefined) {
  const text = (value || "").trim();
  if (!text) return false;
  return text.toLowerCase() !== "no readable text detected in image.";
}

function mediaUrl(url: string): string {
  const normalized = (url || "").trim();
  if (!normalized) return "";
  if (normalized.startsWith("/")) return normalized;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return `/media/${normalized}`;
}

function entryMediaCount(entry: TelegramEntry) {
  return entry.message.media.length;
}

function isVerifiedEntry(entry: TelegramEntry) {
  if (entry.dedupe?.verificationState === "verified" || entry.dedupe?.verificationState === "corroborated") {
    return true;
  }
  return (
    (entry.dedupe?.sourceCount ?? 1) >= 2 ||
    entry.message.media.length > 0 ||
    hasUsefulImageText(entry.message.image_text_en)
  );
}

function freshnessStateForEntry(entry: TelegramEntry, nowMs: number): "hot" | "warm" | "cool" | "cold" {
  const ageMs = Math.max(0, nowMs - parseTs(entry.message.datetime));
  if (ageMs <= 10 * 60 * 1000) return "hot";
  if (ageMs <= 60 * 60 * 1000) return "warm";
  if (ageMs <= 6 * 60 * 60 * 1000) return "cool";
  return "cold";
}

function freshnessBadgeClass(state: "hot" | "warm" | "cool" | "cold") {
  if (state === "hot") return "border-rose-400/30 bg-rose-500/10 text-rose-200";
  if (state === "warm") return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  if (state === "cool") return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

function trustTierForEntry(entry: TelegramEntry): "High" | "Medium" | "Watch" {
  if (entry.dedupe?.trustTier === "core") return "High";
  if (entry.dedupe?.trustTier === "verified") return "Medium";
  if (entry.dedupe?.trustTier === "watch") return "Watch";
  const sourceCount = entry.dedupe?.sourceCount ?? 1;
  if (sourceCount >= 3) return "Medium";
  return "Watch";
}

function trustBadgeClass(tier: "High" | "Medium" | "Watch") {
  if (tier === "High") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (tier === "Medium") return "border-blue-400/30 bg-blue-500/10 text-blue-200";
  return "border-zinc-500/20 bg-zinc-500/10 text-zinc-300";
}

function verificationLabel(entry: TelegramEntry) {
  if (entry.dedupe?.verificationState === "verified") return "Cross-confirmed";
  if (entry.dedupe?.verificationState === "corroborated") return "Multi-source";
  if (entry.dedupe?.verificationState === "single_source") return "Single-source";
  const sourceCount = entry.dedupe?.sourceCount ?? 1;
  if (sourceCount >= 3) return "Cross-confirmed";
  if (sourceCount >= 2) return "Multi-source";
  if (entry.message.media.length > 0) return "Media-backed";
  if (hasUsefulImageText(entry.message.image_text_en)) return "OCR-backed";
  return "Single-source";
}

function rankReasonsForEntry(entry: TelegramEntry, nowMs: number): string[] {
  const reasons: string[] = [];
  if (entry.dedupe?.freshnessTier === "breaking") reasons.push("breaking");
  else if (entry.dedupe?.freshnessTier === "fresh") reasons.push("fresh");
  const sourceCount = entry.dedupe?.sourceCount ?? 1;
  if (sourceCount >= 2) reasons.push(`${sourceCount} sources`);
  if (entry.message.media.length > 0) reasons.push("visual");
  if (hasUsefulImageText(entry.message.image_text_en) && entry.message.media.length === 0) reasons.push("ocr");
  if (entry.dedupe?.domainTags?.includes("osint_cyber")) reasons.push("cyber");
  if (
    entry.dedupe?.domainTags?.includes("strategic") ||
    entry.dedupe?.domainTags?.includes("satellite") ||
    entry.dedupe?.domainTags?.includes("air") ||
    entry.dedupe?.domainTags?.includes("maritime")
  ) {
    reasons.push("strategic");
  }
  return reasons.slice(0, 4);
}

function groupMatchesEntry(group: TelegramFilterGroup, entry: TelegramEntry): boolean {
  if (group.id === "all") return true;
  if (group.predicate?.(entry)) return true;
  const categorySet = FILTER_GROUP_CATEGORY_SET.get(group.id);
  if (!categorySet || categorySet.size === 0) return false;
  if (categorySet.has(entry.category)) return true;
  return entry.dedupe?.categorySet?.some((category) => categorySet.has(category)) ?? false;
}

const AVATAR_BG_BY_TEXT_CLASS: Record<string, string> = {
  "text-blue-300": "#93c5fd",
  "text-cyan-300": "#67e8f9",
  "text-sky-300": "#7dd3fc",
  "text-yellow-300": "#fde047",
  "text-teal-300": "#5eead4",
  "text-rose-300": "#fda4af",
  "text-red-300": "#fca5a5",
  "text-emerald-300": "#6ee7b7",
  "text-lime-300": "#bef264",
  "text-orange-300": "#fdba74",
  "text-violet-300": "#c4b5fd",
  "text-green-300": "#86efac",
  "text-indigo-300": "#a5b4fc",
  "text-purple-300": "#d8b4fe",
  "text-stone-300": "#d6d3d1",
  "text-fuchsia-300": "#f0abfc",
  "text-amber-300": "#fcd34d",
  "text-pink-300": "#f9a8d4",
  "text-slate-300": "#cbd5e1",
  "text-blue-200": "#bfdbfe",
  "text-emerald-200": "#a7f3d0",
  "text-zinc-200": "#e4e4e7",
  "text-amber-200": "#fde68a",
  "text-yellow-200": "#fef08a",
  "text-sky-200": "#bae6fd",
  "text-lime-200": "#d9f99d",
  "text-red-200": "#fecaca",
  "text-rose-200": "#fecdd3",
  "text-orange-200": "#fed7aa",
  "text-teal-200": "#99f6e4",
};

function avatarBgColor(category: string): string {
  const style = getCategoryStyle(category);
  return AVATAR_BG_BY_TEXT_CLASS[style.text] ?? "#a1a1aa";
}

function entryKey(entry: TelegramEntry) {
  if (entry.dedupe?.clusterKey) return entry.dedupe.clusterKey;
  return entry.message.link || `${entry.category}:${entry.message.datetime}:${entry.message.text_original.slice(0, 48)}`;
}

function entrySourceSignatures(entry: TelegramEntry): string[] {
  return entry.dedupe?.sourceSignatures?.filter((value) => typeof value === "string" && value.trim().length > 0) ?? [];
}

function safeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

function fastHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function normalizeDedupeText(value: string): string {
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

const DEDUPE_STOPWORDS = new Set([
  "the", "and", "for", "that", "with", "this", "from", "have", "has", "are", "was", "were", "will",
  "about", "after", "into", "over", "under", "their", "there", "they", "them", "said", "says", "more",
  "intel", "news", "update", "breaking", "report", "reports",
]);

function tokenizeDedupeText(value: string): string[] {
  if (!value) return [];
  const tokens = value
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !DEDUPE_STOPWORDS.has(token));
  return Array.from(new Set(tokens)).slice(0, 96);
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function messageMediaSignature(message: TelegramMessage): string {
  if (!Array.isArray(message.media) || message.media.length === 0) return "";
  const mediaKeys = message.media
    .map((media) => {
      const parts = media.url.split("/").filter(Boolean);
      return parts.at(-1) ?? media.url;
    })
    .sort();
  return mediaKeys.join("|").slice(0, 260);
}

function isSameMessage(a: TelegramMessage, b: TelegramMessage) {
  return (
    a.link === b.link &&
    a.datetime === b.datetime &&
    a.text_en === b.text_en &&
    a.image_text_en === b.image_text_en &&
    a.views === b.views &&
    a.media.length === b.media.length
  );
}

function reconcileData(prev: TelegramData, next: TelegramData): TelegramData {
  const prevByKey = new Map<string, TelegramMessage>();
  for (const channel of prev.channels) {
    for (const msg of channel.messages) {
      const key = msg.link || `${channel.category}:${msg.datetime}:${msg.text_original.slice(0, 48)}`;
      prevByKey.set(key, msg);
    }
  }

  return {
    ...next,
    channels: next.channels.map((channel) => ({
      ...channel,
      messages: channel.messages.map((msg) => {
        const key = msg.link || `${channel.category}:${msg.datetime}:${msg.text_original.slice(0, 48)}`;
        const existing = prevByKey.get(key);
        return existing && isSameMessage(existing, msg) ? existing : msg;
      }),
    })),
  };
}

const DEDUPE_TIME_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEDUPE_MEDIA_WINDOW_MS = 6 * 60 * 60 * 1000;

type TelegramDedupeCluster = {
  key: string;
  primary: TelegramEntry;
  canonicalText: string;
  tokenSet: Set<string>;
  mediaSignature: string;
  latestTs: number;
  sourceLabels: Set<string>;
  sourceUsers: Set<string>;
  categories: Map<string, number>;
  aliases: Set<string>;
};

function legacyEntryKey(entry: TelegramEntry): string {
  return entry.message.link || `${entry.category}:${entry.message.datetime}:${entry.message.text_original.slice(0, 48)}`;
}

function registerClusterIndex(map: Map<string, number[]>, key: string, index: number): void {
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    if (existing[existing.length - 1] !== index) existing.push(index);
    return;
  }
  map.set(key, [index]);
}

function dominantCategory(categories: Map<string, number>, fallback: string): string {
  let selected = fallback;
  let best = -1;
  for (const [category, count] of categories.entries()) {
    if (count > best) {
      selected = category;
      best = count;
    }
  }
  return selected;
}

function dedupeScoreForCluster(args: {
  msgTs: number;
  msgCanonical: string;
  msgTokens: Set<string>;
  msgMediaSignature: string;
  cluster: TelegramDedupeCluster;
}): number {
  const tsDelta = Math.abs(args.msgTs - args.cluster.latestTs);

  if (
    args.msgMediaSignature &&
    args.cluster.mediaSignature &&
    args.msgMediaSignature === args.cluster.mediaSignature &&
    tsDelta <= DEDUPE_MEDIA_WINDOW_MS
  ) {
    return 1;
  }

  if (!args.msgCanonical || !args.cluster.canonicalText || tsDelta > DEDUPE_TIME_WINDOW_MS) {
    return 0;
  }

  if (args.msgCanonical === args.cluster.canonicalText) {
    return 0.98;
  }

  const leftLength = args.msgCanonical.length;
  const rightLength = args.cluster.canonicalText.length;
  const shorter = Math.min(leftLength, rightLength);
  const longer = Math.max(leftLength, rightLength);
  const lengthRatio = longer > 0 ? shorter / longer : 0;
  const contains =
    args.msgCanonical.includes(args.cluster.canonicalText) ||
    args.cluster.canonicalText.includes(args.msgCanonical);

  if (shorter >= 90 && lengthRatio >= 0.72 && contains) {
    return 0.93;
  }

  const similarity = jaccardSimilarity(args.msgTokens, args.cluster.tokenSet);
  if (similarity >= 0.84) return similarity;
  if (similarity >= 0.74 && shorter >= 180) return similarity - 0.01;
  return 0;
}

function buildDedupeClusterKey(entry: TelegramEntry, canonicalText: string, msgTs: number, mediaSignature: string): string {
  const seed = canonicalText || mediaSignature || legacyEntryKey(entry);
  const bucket = Math.floor((msgTs || Date.now()) / (30 * 60 * 1000));
  return `cluster_${bucket}_${fastHash(seed.slice(0, 400))}`;
}

function dedupeTelegramEntries(entries: TelegramEntry[]): TelegramEntry[] {
  if (entries.length <= 1) return entries;
  const sorted = [...entries].sort((left, right) => parseTs(right.message.datetime) - parseTs(left.message.datetime));
  const clusters: TelegramDedupeCluster[] = [];
  const canonicalIndex = new Map<string, number[]>();
  const mediaIndex = new Map<string, number[]>();
  const tokenIndex = new Map<string, number[]>();

  for (const entry of sorted) {
    const msgTs = parseTs(entry.message.datetime);
    const canonical = normalizeDedupeText(messageText(entry.message));
    const tokens = tokenizeDedupeText(canonical);
    const tokenSet = new Set(tokens);
    const mediaSignature = messageMediaSignature(entry.message);
    const candidateIndexes = new Set<number>();

    for (const index of canonicalIndex.get(canonical) ?? []) candidateIndexes.add(index);
    if (mediaSignature) {
      for (const index of mediaIndex.get(mediaSignature) ?? []) candidateIndexes.add(index);
    }
    for (const token of tokens.slice(0, 8)) {
      if (token.length < 5) continue;
      for (const index of tokenIndex.get(token) ?? []) candidateIndexes.add(index);
    }

    let bestIndex = -1;
    let bestScore = 0;
    for (const candidateIndex of candidateIndexes) {
      const cluster = clusters[candidateIndex];
      if (!cluster) continue;
      const score = dedupeScoreForCluster({
        msgTs,
        msgCanonical: canonical,
        msgTokens: tokenSet,
        msgMediaSignature: mediaSignature,
        cluster,
      });
      if (score > bestScore) {
        bestScore = score;
        bestIndex = candidateIndex;
      }
    }

    if (bestIndex >= 0 && bestScore >= 0.82) {
      const cluster = clusters[bestIndex]!;
      cluster.sourceLabels.add(entry.channelLabel);
      if (entry.channelUsername) cluster.sourceUsers.add(entry.channelUsername);
      cluster.categories.set(entry.category, (cluster.categories.get(entry.category) ?? 0) + 1);
      cluster.aliases.add(legacyEntryKey(entry));
      if (msgTs >= cluster.latestTs) {
        cluster.latestTs = msgTs;
        cluster.primary = entry;
      }
      if (canonical.length > cluster.canonicalText.length) {
        cluster.canonicalText = canonical;
      }
      if (!cluster.mediaSignature && mediaSignature) {
        cluster.mediaSignature = mediaSignature;
      }
      for (const token of tokenSet) {
        if (cluster.tokenSet.size >= 120) break;
        cluster.tokenSet.add(token);
      }
      registerClusterIndex(canonicalIndex, canonical, bestIndex);
      if (mediaSignature) registerClusterIndex(mediaIndex, mediaSignature, bestIndex);
      for (const token of tokens.slice(0, 8)) {
        if (token.length >= 5) registerClusterIndex(tokenIndex, token, bestIndex);
      }
      continue;
    }

    const clusterIndex = clusters.length;
    const cluster: TelegramDedupeCluster = {
      key: buildDedupeClusterKey(entry, canonical, msgTs, mediaSignature),
      primary: entry,
      canonicalText: canonical,
      tokenSet,
      mediaSignature,
      latestTs: msgTs,
      sourceLabels: new Set([entry.channelLabel]),
      sourceUsers: new Set(entry.channelUsername ? [entry.channelUsername] : []),
      categories: new Map([[entry.category, 1]]),
      aliases: new Set([legacyEntryKey(entry)]),
    };
    clusters.push(cluster);
    registerClusterIndex(canonicalIndex, canonical, clusterIndex);
    if (mediaSignature) registerClusterIndex(mediaIndex, mediaSignature, clusterIndex);
    for (const token of tokens.slice(0, 8)) {
      if (token.length >= 5) registerClusterIndex(tokenIndex, token, clusterIndex);
    }
  }

  return clusters
    .sort((left, right) => right.latestTs - left.latestTs)
    .map((cluster) => {
      const sourceLabels = Array.from(cluster.sourceLabels).sort((left, right) => left.localeCompare(right));
      const sourceUsers = cluster.sourceUsers.size > 0 ? cluster.sourceUsers : cluster.sourceLabels;
      const sourceCount = sourceUsers.size;
      const clusterCategories = Array.from(cluster.categories.keys());
      const primary = cluster.primary;
      return {
        ...primary,
        category: dominantCategory(cluster.categories, primary.category),
        dedupe: {
          clusterKey: cluster.key,
          sourceCount,
          duplicateCount: Math.max(0, cluster.aliases.size - 1),
          sourceLabels: sourceLabels.slice(0, 24),
          categorySet: clusterCategories,
        },
      };
    });
}

function VideoPlayer(props: { media: TelegramMedia }) {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);
  const [retryKey, setRetryKey] = createSignal(0);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  return (
    <div class="relative min-h-[220px] overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
      <Show when={!error()}>
        <video
          src={`${mediaUrl(props.media.url)}${retryKey() ? `#r${retryKey()}` : ""}`}
          controls
          preload="none"
          poster={props.media.thumbnail ? mediaUrl(props.media.thumbnail) : undefined}
          playsinline
          class="block min-h-[220px] max-h-[420px] w-full rounded-xl bg-black object-contain"
          onCanPlay={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onPlaying={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      </Show>
      <Show when={loading() && !error()}>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
          <LoaderCircle class="h-8 w-8 animate-spin text-white/60" />
        </div>
      </Show>
      <Show when={error()}>
        <div class="flex min-h-[200px] flex-col items-center justify-center gap-3 p-8">
          <Video class="h-10 w-10 text-white/20" />
          <p class="text-sm text-white/40">Video failed to load</p>
          <button type="button" onClick={handleRetry} class="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white/90">
            <RefreshCw class="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </Show>
    </div>
  );
}

function collageLayoutClass(count: number) {
  if (count <= 1) return "telegram-photo-collage--single";
  if (count === 2) return "telegram-photo-collage--double";
  if (count === 3) return "telegram-photo-collage--triple";
  return "telegram-photo-collage--quad";
}

function collageCellClass(count: number, index: number) {
  if (count === 3) {
    if (index === 0) return "telegram-photo-cell telegram-photo-cell--hero";
    if (index === 1) return "telegram-photo-cell telegram-photo-cell--side-top";
    if (index === 2) return "telegram-photo-cell telegram-photo-cell--side-bottom";
  }
  return "telegram-photo-cell";
}

function PhotoViewer(props: { media: TelegramMedia; count: number; index: number; overflowCount: number; onOpen: (index: number) => void }) {
  const [loaded, setLoaded] = createSignal(false);
  return (
    <div class={collageCellClass(props.count, props.index)}>
      <button type="button" class="telegram-photo-button" onClick={() => props.onOpen(props.index)} aria-label={`Open image ${props.index + 1}`}>
        <Show when={!loaded()}>
          <div class="telegram-photo-skeleton" />
        </Show>
        <img
          src={mediaUrl(props.media.url)}
          alt=""
          loading="lazy"
          class="telegram-photo-img"
          classList={{ "opacity-0": !loaded(), "opacity-100": loaded() }}
          onLoad={() => setLoaded(true)}
        />
      </button>
      <Show when={props.overflowCount > 0 && props.index === 3}>
        <div class="telegram-photo-overflow">+{props.overflowCount}</div>
      </Show>
    </div>
  );
}

function MessageCard(props: {
  entry: TelegramEntry;
  categoryLabel: string;
  showCategory: boolean;
  nowMs: number;
  focusKey?: string;
  onShare: (entry: TelegramEntry) => void;
  ownerToolsEnabled?: boolean;
  selectedForMerge?: boolean;
  adminBusy?: boolean;
  onToggleMergeSelect?: (entry: TelegramEntry) => void;
  onSplitEvent?: (entry: TelegramEntry) => void;
  onClearRule?: (entry: TelegramEntry) => void;
}) {
  const [showOriginal, setShowOriginal] = createSignal(false);
  const [activePhotoIndex, setActivePhotoIndex] = createSignal<number | null>(null);
  const hasTranslation = () =>
    props.entry.message.text_en.trim() !== props.entry.message.text_original.trim();
  const videos = () => props.entry.message.media.filter((m) => m.type === "video");
  const photos = () => props.entry.message.media.filter((m) => m.type === "photo");
  const visiblePhotos = () => photos().slice(0, 4);
  const hiddenPhotoCount = () => Math.max(0, photos().length - 4);
  const activePhoto = () => {
    const idx = activePhotoIndex();
    if (idx === null) return null;
    return photos()[idx] ?? null;
  };
  const closeLightbox = () => setActivePhotoIndex(null);
  const showPrev = () => {
    const idx = activePhotoIndex();
    if (idx === null || idx <= 0) return;
    setActivePhotoIndex(idx - 1);
  };
  const showNext = () => {
    const idx = activePhotoIndex();
    if (idx === null || idx >= photos().length - 1) return;
    setActivePhotoIndex(idx + 1);
  };
  const style = () => getCategoryStyle(props.entry.category);
  const trustTier = () => trustTierForEntry(props.entry);
  const freshnessState = () => freshnessStateForEntry(props.entry, props.nowMs);
  const rankReasons = () => rankReasonsForEntry(props.entry, props.nowMs);
  const sourceLabels = () => props.entry.dedupe?.sourceLabels ?? [];
  const isFocused = () => props.focusKey === entryKey(props.entry);
  const itemId = () => `msg-${safeDomId(entryKey(props.entry))}`;
  const channelName = () => props.entry.channelLabel || props.entry.channelUsername || "Telegram source";
  const avatarLetter = () => channelName().charAt(0).toUpperCase() || "T";
  const sourceSignatureCount = () => entrySourceSignatures(props.entry).length;
  const copyShareLink = async () => {
    const target = new URL(window.location.href);
    target.searchParams.set("focus", entryKey(props.entry));
    try {
      await navigator.clipboard.writeText(target.toString());
    } catch {
    }
  };

  createEffect(() => {
    const idx = activePhotoIndex();
    if (idx === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowLeft") {
        showPrev();
      } else if (event.key === "ArrowRight") {
        showNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));
  });

  return (
    <article id={itemId()} class={`telegram-tweet ${isFocused() ? "telegram-tweet--focused" : ""}`} style={{ "content-visibility": "auto", "contain-intrinsic-size": "320px" }}>
      <div class="telegram-tweet-layout">
        <div class="telegram-tweet-avatar" style={{ "background-color": avatarBgColor(props.entry.category) }}>
          {avatarLetter()}
        </div>
        <div class="telegram-tweet-content">
          <header class="telegram-tweet-header">
            <div class="telegram-tweet-author">
              <p class="telegram-tweet-author-name">{channelName()}</p>
              <span class="telegram-tweet-time">· {formatRelativeTimeLive(props.entry.message.datetime, props.nowMs)}</span>
              <Show when={props.showCategory}>
                <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${style().bg} ${style().border} ${style().text}`}>
                  {props.categoryLabel}
                </span>
              </Show>
              <Show when={(props.entry.dedupe?.sourceCount ?? 1) > 1}>
                <span
                  class="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                  title={(props.entry.dedupe?.sourceLabels ?? []).join(", ")}
                >
                  {props.entry.dedupe?.sourceCount} sources
                </span>
              </Show>
              <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${trustBadgeClass(trustTier())}`}>
                Trust {trustTier()}
              </span>
              <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${freshnessBadgeClass(freshnessState())}`}>
                {freshnessState()}
              </span>
            </div>
          </header>

          <div class="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span class="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-zinc-300">
              {verificationLabel(props.entry)}
            </span>
            <Show when={entryMediaCount(props.entry) > 0}>
              <span class="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                {entryMediaCount(props.entry)} media
              </span>
            </Show>
            <For each={rankReasons()}>
              {(reason) => (
                <span class="inline-flex rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 uppercase tracking-[0.14em] text-zinc-400">
                  {reason}
                </span>
              )}
            </For>
          </div>

          <p class="telegram-tweet-text">{messageText(props.entry.message)}</p>

          <Show when={hasTranslation()}>
            <button onClick={() => setShowOriginal(!showOriginal())} class="mt-2 cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">
              {showOriginal() ? "Hide original" : "Show original"}
            </button>
            <Show when={showOriginal()}>
              <div class="mt-2 border-l border-white/[0.08] pl-3">
                <p class="whitespace-pre-wrap text-[12px] italic leading-relaxed text-zinc-500">{props.entry.message.text_original}</p>
              </div>
            </Show>
          </Show>

          <Show when={videos().length > 0}>
            <div class="mt-3 space-y-2">
              <For each={videos()}>{(media) => <VideoPlayer media={media} />}</For>
            </div>
          </Show>

          <Show when={photos().length > 0}>
            <div class={`telegram-photo-collage ${collageLayoutClass(visiblePhotos().length)} mt-3`}>
              <For each={visiblePhotos()}>
                {(media, index) => (
                  <PhotoViewer
                    media={media}
                    count={visiblePhotos().length}
                    index={index()}
                    overflowCount={hiddenPhotoCount()}
                    onOpen={setActivePhotoIndex}
                  />
                )}
              </For>
            </div>
          </Show>

          <Show when={hasUsefulImageText(props.entry.message.image_text_en)}>
            <div class="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Image Translation</p>
              <p class="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">{props.entry.message.image_text_en}</p>
            </div>
          </Show>

          <footer class="telegram-tweet-actions">
            <Show when={props.entry.message.views}>
              <span class="telegram-tweet-action-pill">
                <Eye size={12} /> {props.entry.message.views}
              </span>
            </Show>

            <button type="button" class="telegram-tweet-action-btn cursor-pointer" onClick={() => props.onShare(props.entry)}>
              <Share2 size={13} /> Share
            </button>
            <button type="button" class="telegram-tweet-action-btn cursor-pointer" onClick={copyShareLink}>
              <Copy size={13} /> Copy
            </button>
          </footer>

          <Show when={sourceLabels().length > 0}>
            <details class="mt-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <summary class="cursor-pointer list-none text-[11px] font-medium text-zinc-300">
                Source matrix
                <span class="ml-2 text-zinc-500">{sourceLabels().length} labels</span>
              </summary>
              <div class="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                <Show when={props.entry.dedupe?.rankScore}>
                  <span class="rounded-full border border-blue-400/20 bg-blue-500/10 px-2 py-0.5 text-blue-200">
                    Rank {props.entry.dedupe?.rankScore}
                  </span>
                </Show>
                <Show when={props.entry.dedupe?.verificationState}>
                  <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
                    {props.entry.dedupe?.verificationState?.replaceAll("_", " ")}
                  </span>
                </Show>
                <Show when={props.entry.dedupe?.latencyTier}>
                  <span class="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">
                    {props.entry.dedupe?.latencyTier}
                  </span>
                </Show>
                <Show when={props.entry.dedupe?.domainTags && props.entry.dedupe.domainTags.length > 0}>
                  <For each={props.entry.dedupe?.domainTags?.slice(0, 6) ?? []}>
                    {(tag) => (
                      <span class="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-zinc-400">
                        {tag.replaceAll("_", " ")}
                      </span>
                    )}
                  </For>
                </Show>
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <For each={sourceLabels().slice(0, 18)}>
                  {(label) => (
                    <span class="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-300">
                      {label}
                    </span>
                  )}
                </For>
              </div>
              <Show when={(props.entry.dedupe?.sources?.length ?? 0) > 0}>
                <div class="mt-3 grid gap-2">
                  <For each={props.entry.dedupe?.sources?.slice(0, 8) ?? []}>
                    {(source) => (
                      <div class="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-[10px] text-zinc-400">
                        <div class="flex flex-wrap items-center gap-1.5">
                          <span class="font-medium text-zinc-200">{source.label || source.channel}</span>
                          <span class="rounded-full border border-white/[0.08] px-1.5 py-0.5 uppercase tracking-[0.14em] text-zinc-500">
                            {source.category}
                          </span>
                          <Show when={source.trust_tier}>
                            <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">
                              {source.trust_tier}
                            </span>
                          </Show>
                        </div>
                        <div class="mt-1 flex flex-wrap items-center gap-2">
                          <span>@{source.channel}</span>
                          <Show when={source.source_type}>
                            <span>{source.source_type}</span>
                          </Show>
                          <Show when={source.latency_tier}>
                            <span>{source.latency_tier}</span>
                          </Show>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </details>
          </Show>

          <Show when={props.ownerToolsEnabled && sourceSignatureCount() > 0}>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={props.adminBusy}
                onClick={() => props.onToggleMergeSelect?.(props.entry)}
                class={`cursor-pointer rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${
                  props.selectedForMerge
                    ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/[0.12] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {props.selectedForMerge ? "Selected for merge" : "Select for merge"}
              </button>
              <button
                type="button"
                disabled={props.adminBusy}
                onClick={() => props.onSplitEvent?.(props.entry)}
                class="cursor-pointer rounded-md border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Split event
              </button>
              <button
                type="button"
                disabled={props.adminBusy}
                onClick={() => props.onClearRule?.(props.entry)}
                class="cursor-pointer rounded-md border border-zinc-500/30 bg-zinc-700/20 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-700/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear rule
              </button>
            </div>
          </Show>
        </div>
      </div>

      <Show when={activePhoto()}>
        {(currentPhoto) => (
          <div class="telegram-lightbox" onClick={closeLightbox} role="dialog" aria-modal="true" aria-label="Image viewer">
            <div class="telegram-lightbox-frame" onClick={(event) => event.stopPropagation()}>
              <button type="button" class="telegram-lightbox-close" onClick={closeLightbox} aria-label="Close image viewer">
                <X size={16} />
              </button>

              <img src={mediaUrl(currentPhoto().url)} alt="" class="telegram-lightbox-img" loading="eager" decoding="async" />

              <div class="telegram-lightbox-meta">
                <span>
                  {activePhotoIndex()! + 1} / {photos().length}
                </span>
                <span>Use arrow keys</span>
              </div>

              <Show when={activePhotoIndex()! > 0}>
                <button type="button" class="telegram-lightbox-nav telegram-lightbox-nav--left" onClick={showPrev} aria-label="Previous image">
                  <ChevronLeft size={18} />
                </button>
              </Show>
              <Show when={activePhotoIndex()! < photos().length - 1}>
                <button type="button" class="telegram-lightbox-nav telegram-lightbox-nav--right" onClick={showNext} aria-label="Next image">
                  <ChevronRight size={18} />
                </button>
              </Show>
            </div>
          </div>
        )}
      </Show>

    </article>
  );
}

export default function TelegramPage() {
  const [data, setData] = createSignal<TelegramData | null>(null);
  const [loadingInitial, setLoadingInitial] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const clockNow = useWallClock(1000);
  const [groupFilter, setGroupFilter] = createSignal("all");
  const [ageWindow, setAgeWindow] = createSignal<AgeWindow>("all");
  const [feedMode, setFeedMode] = createSignal<FeedMode>("deduped");
  const [mediaOnly, setMediaOnly] = createSignal(false);
  const [focusKey, setFocusKey] = createSignal("");
  const [ownerDedupeEnabled, setOwnerDedupeEnabled] = createSignal(false);
  const [dedupeFeedbackCount, setDedupeFeedbackCount] = createSignal(0);
  const [selectedClusterKeys, setSelectedClusterKeys] = createSignal<string[]>([]);
  const [adminBusy, setAdminBusy] = createSignal(false);
  const [adminStatus, setAdminStatus] = createSignal("");
  const [streamConnected, setStreamConnected] = createSignal(false);
  const feedThresholds = { liveMaxMinutes: 20, delayedMaxMinutes: 90 } as const;
  let lastTimestamp = "";

  const refreshDedupeFeedbackStatus = async (): Promise<void> => {
    try {
      const res = await fetch("/api/telegram/dedupe-feedback", {
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (res.status === 403) {
        setOwnerDedupeEnabled(false);
        setDedupeFeedbackCount(0);
        return;
      }
      if (!res.ok) {
        return;
      }
      const payload = await res.json() as { count?: unknown };
      setOwnerDedupeEnabled(true);
      const count = typeof payload.count === "number" && Number.isFinite(payload.count) ? Math.max(0, Math.floor(payload.count)) : 0;
      setDedupeFeedbackCount(count);
    } catch {
      // Best-effort owner capability detection.
    }
  };

  const refreshTelegram = async (): Promise<boolean> => {
    if (refreshing()) return false;
    setRefreshing(true);
    try {
      const res = await fetch("/api/telegram", {
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (!res.ok) return false;
      const next = (await res.json()) as TelegramData;

      const prev = data();
      if (prev) {
        const prevSnapshotTs = parseTs(prev.timestamp);
        const nextSnapshotTs = parseTs(next.timestamp);
        if (
          (prevSnapshotTs > 0 && nextSnapshotTs > 0 && nextSnapshotTs < prevSnapshotTs) ||
          (prevSnapshotTs > 0 && nextSnapshotTs <= 0)
        ) {
          return false;
        }
      }
      const merged = prev ? reconcileData(prev, next) : next;
      const changed = !prev || next.timestamp !== lastTimestamp || next.total_messages !== prev.total_messages;
      if (changed) {
        setData(merged);
        lastTimestamp = next.timestamp;
      }
      return changed;
    } catch {
      return false;
    } finally {
      setRefreshing(false);
      if (loadingInitial()) setLoadingInitial(false);
    }
  };

  onMount(() => {
    const focus = new URL(window.location.href).searchParams.get("focus");
    if (focus) {
      setFocusKey(focus);
      setGroupFilter("all");
    }
    void refreshTelegram();
    void refreshDedupeFeedbackStatus();

    if (typeof window !== "undefined") {
      let socket: WebSocket | null = null;
      let reconnectTimer: number | null = null;
      let reconnectDelayMs = 2_000;
      let closed = false;

      const clearReconnect = () => {
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      const scheduleReconnect = () => {
        if (closed) return;
        clearReconnect();
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, reconnectDelayMs);
        reconnectDelayMs = Math.min(30_000, Math.floor(reconnectDelayMs * 1.6));
      };

      const connect = () => {
        clearReconnect();
        try {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          socket = new WebSocket(`${protocol}//${window.location.host}/api/telegram/stream`);
        } catch {
          setStreamConnected(false);
          scheduleReconnect();
          return;
        }

        socket.addEventListener("open", () => {
          setStreamConnected(true);
          reconnectDelayMs = 2_000;
          try {
            socket?.send("state");
          } catch {
            // best effort
          }
        });

        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as { type?: string; timestamp?: string | null };
            if (payload.type === "state_updated" || payload.type === "state" || payload.type === "hello") {
              if (payload.timestamp && payload.timestamp !== lastTimestamp) {
                void refreshTelegram();
              }
            }
          } catch {
            // ignore malformed stream events
          }
        });

        socket.addEventListener("close", () => {
          setStreamConnected(false);
          scheduleReconnect();
        });

        socket.addEventListener("error", () => {
          setStreamConnected(false);
          try {
            socket?.close();
          } catch {
            // ignore
          }
        });
      };

      connect();

      onCleanup(() => {
        closed = true;
        clearReconnect();
        setStreamConnected(false);
        try {
          socket?.close();
        } catch {
          // ignore close errors
        }
      });
    }
  });

  useLiveRefresh(refreshTelegram, 60_000, { runImmediately: false, jitterRatio: 0.15 });

  const categories = () => data()?.categories ?? {};
  const channels = () => data()?.channels ?? [];
  const timestamp = () => data()?.timestamp ?? "";

  const normalizedChannels = createMemo(() => {
    return channels().map((channel) => ({
      ...channel,
      messages: [...(channel.messages ?? [])].sort((a, b) => parseTs(b.datetime) - parseTs(a.datetime)),
    }));
  });

  const latestMessageTimestamp = createMemo(() => {
    let latest = 0;
    for (const channel of normalizedChannels()) {
      for (const msg of channel.messages) {
        const ts = parseTs(msg.datetime);
        if (ts > latest) latest = ts;
      }
    }
    return latest;
  });

  const feedFreshness = createMemo(() => {
    const latestTs = latestMessageTimestamp() || parseTs(timestamp());
    return buildFreshnessStatusAt(clockNow(), latestTs, feedThresholds, {
      noData: "No recent data",
      live: "Live flow",
      delayed: "Delayed",
      stale: "Stale feed",
    });
  });

  const latestMessageAgeMs = createMemo(() => {
    const latestTs = latestMessageTimestamp() || parseTs(timestamp());
    if (!latestTs) return null;
    return Math.max(0, clockNow() - latestTs);
  });

  const latestMessageAgeLabel = createMemo(() => formatAgeCompactFromMs(latestMessageAgeMs()));
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, "Telegram feed");

  const isVisibleMessage = (msg: TelegramMessage) => {
    if (ageWindow() === "24h") {
      const ts = parseTs(msg.datetime);
      if (!ts || clockNow() - ts > 24 * 60 * 60 * 1000) return false;
    }
    if (mediaOnly()) {
      return msg.media.length > 0 || msg.has_photo || msg.has_video;
    }
    return true;
  };

  const mergeDuplicates = createMemo(() => feedMode() !== "raw");
  const verifiedOnly = createMemo(() => feedMode() === "verified");

  const rawEntries = createMemo<TelegramEntry[]>((prev) => {
    const previous = prev ?? [];
    const prevMap = new Map(previous.map((entry) => [entryKey(entry), entry]));
    const out: TelegramEntry[] = [];

    for (const channel of normalizedChannels()) {
      for (const msg of channel.messages) {
        if (!isVisibleMessage(msg)) continue;
        const key = msg.link || `${channel.category}:${msg.datetime}:${msg.text_original.slice(0, 48)}`;
        const existing = prevMap.get(key);
        if (existing && existing.message === msg && existing.category === channel.category) {
          out.push(existing);
        } else {
          out.push({
            category: channel.category,
            channelLabel: channel.label || channel.username || "Telegram source",
            channelUsername: channel.username || "",
            message: msg,
          });
        }
      }
    }

    out.sort((a, b) => parseTs(b.message.datetime) - parseTs(a.message.datetime));
    return out;
  }, []);

  const entries = createMemo<TelegramEntry[]>(() => {
    const snapshot = data();
    if (mergeDuplicates() && Array.isArray(snapshot?.canonical_events) && snapshot.canonical_events.length > 0) {
      const canonicalEntries: TelegramEntry[] = [];
      for (const event of snapshot.canonical_events) {
        const message: TelegramMessage = {
          text_original: event.text_original || event.text_en || "",
          text_en: event.text_en || event.text_original || "",
          image_text_en: event.image_text_en || "",
          datetime: event.datetime,
          link: event.sources?.[0]?.link || "",
          views: event.sources?.[0]?.views || "",
          media: Array.isArray(event.media) ? event.media : [],
          has_video: Boolean(event.has_video),
          has_photo: Boolean(event.has_photo),
          language: event.language || "unknown",
        };
        if (!isVisibleMessage(message)) continue;
        canonicalEntries.push({
          category: event.category,
          channelLabel: event.source_labels?.[0] || event.sources?.[0]?.label || "Telegram source",
          channelUsername: event.source_channels?.[0] || event.sources?.[0]?.channel || "",
          message,
          dedupe: {
            clusterKey: event.event_key || event.event_id,
            sourceCount: Math.max(1, Number(event.source_count) || 1),
            duplicateCount: Math.max(0, Number(event.duplicate_count) || 0),
            sourceLabels: Array.isArray(event.source_labels) ? event.source_labels : [],
            categorySet: Array.isArray(event.categories) ? event.categories : [event.category],
            domainTags: Array.isArray(event.domain_tags) ? event.domain_tags : [],
            trustTier: event.trust_tier,
            latencyTier: event.latency_tier,
            sourceType: event.source_type,
            acquisitionMethod: event.acquisition_method,
            subscriberValueScore: typeof event.subscriber_value_score === "number" ? event.subscriber_value_score : undefined,
            freshnessTier: event.freshness_tier,
            verificationState: event.verification_state,
            rankScore: typeof event.rank_score === "number" ? event.rank_score : undefined,
            sources: Array.isArray(event.sources) ? event.sources : [],
            sourceSignatures: Array.isArray(event.sources)
              ? event.sources
                .map((source) => source?.signature)
                .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              : [],
          },
        });
      }
      canonicalEntries.sort((left, right) => parseTs(right.message.datetime) - parseTs(left.message.datetime));
      return canonicalEntries;
    }

    const base = rawEntries();
    return mergeDuplicates() ? dedupeTelegramEntries(base) : base;
  });

  const dedupeSavedCount = createMemo(() => Math.max(0, rawEntries().length - entries().length));

  const categoryCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries()) {
      const categoriesForCount = entry.dedupe?.categorySet?.length
        ? entry.dedupe.categorySet
        : [entry.category];
      for (const category of categoriesForCount) {
        counts[category] = (counts[category] || 0) + 1;
      }
    }
    return counts;
  });

  const groupCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of TELEGRAM_FILTER_GROUPS) {
      if (group.id === "all") {
        counts[group.id] = entries().length;
        continue;
      }
      counts[group.id] = entries().filter((entry) => groupMatchesEntry(group, entry)).length;
    }
    return counts;
  });

  const activeFilterGroups = createMemo(() => {
    return TELEGRAM_FILTER_GROUPS.filter((group) => group.id === "all" || (groupCounts()[group.id] || 0) > 0);
  });

  const filteredEntries = createMemo(() => {
    const activeGroupId = groupFilter();
    const group = FILTER_GROUP_BY_ID.get(activeGroupId) ?? TELEGRAM_FILTER_GROUPS[0];
    return entries().filter((entry) => {
      if (activeGroupId !== "all" && !groupMatchesEntry(group, entry)) {
        return false;
      }
      if (verifiedOnly() && !isVerifiedEntry(entry)) {
        return false;
      }
      return true;
    });
  });

  const activeGroup = createMemo(() => FILTER_GROUP_BY_ID.get(groupFilter()) ?? TELEGRAM_FILTER_GROUPS[0]);
  const activeGroupCount = createMemo(() => {
    return TELEGRAM_FILTER_GROUPS.filter((group) => group.id !== "all" && (groupCounts()[group.id] || 0) > 0).length;
  });
  const verifiedCount = createMemo(() => entries().filter((entry) => isVerifiedEntry(entry)).length);
  const mediaCount = createMemo(() => entries().filter((entry) => entry.message.media.length > 0).length);
  const selectedSignatures = createMemo(() => {
    const map = new Map(filteredEntries().map((entry) => [entry.dedupe?.clusterKey ?? "", entry] as const));
    const signatureSet = new Set<string>();
    for (const key of selectedClusterKeys()) {
      const entry = map.get(key);
      if (!entry) continue;
      for (const signature of entrySourceSignatures(entry)) {
        signatureSet.add(signature);
      }
    }
    return Array.from(signatureSet);
  });
  const showCategoryPill = createMemo(() => {
    if (groupFilter() === "all") return true;
    return (activeGroup().categories?.length ?? 0) > 1;
  });

  createEffect(() => {
    if (!mergeDuplicates()) {
      setSelectedClusterKeys([]);
      return;
    }
    const visibleKeys = new Set(
      filteredEntries()
        .map((entry) => entry.dedupe?.clusterKey ?? "")
        .filter((value) => value.length > 0),
    );
    setSelectedClusterKeys((prev) => prev.filter((key) => visibleKeys.has(key)));
  });

  const toggleClusterSelection = (entry: TelegramEntry) => {
    const clusterKey = entry.dedupe?.clusterKey ?? "";
    if (!clusterKey || entrySourceSignatures(entry).length === 0) return;
    setSelectedClusterKeys((prev) => {
      if (prev.includes(clusterKey)) {
        return prev.filter((value) => value !== clusterKey);
      }
      return [...prev, clusterKey];
    });
  };

  const applyDedupeFeedback = async (args: { action: "merge" | "split" | "clear"; signatures: string[]; targetCluster?: string }) => {
    if (args.signatures.length === 0 || adminBusy()) return;
    setAdminBusy(true);
    setAdminStatus("");
    try {
      const res = await fetch("/api/telegram/dedupe-feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: args.action,
          signatures: args.signatures,
          ...(args.targetCluster ? { targetCluster: args.targetCluster } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setAdminStatus(`Dedupe action failed (${res.status}) ${body.slice(0, 120)}`);
        return;
      }
      setAdminStatus(`${args.action} applied to ${args.signatures.length} signatures`);
      setSelectedClusterKeys([]);
      await refreshDedupeFeedbackStatus();
      await refreshTelegram();
    } catch {
      setAdminStatus("Dedupe action failed due to network/runtime error");
    } finally {
      setAdminBusy(false);
    }
  };

  const mergeSelectedClusters = async () => {
    const signatures = selectedSignatures();
    if (signatures.length < 2) {
      setAdminStatus("Select at least 2 source signatures to merge.");
      return;
    }
    const clusterSeed = selectedClusterKeys().sort().join("|");
    const targetCluster = `owner_manual_${fastHash(clusterSeed)}_${Math.floor(Date.now() / 1000)}`;
    await applyDedupeFeedback({ action: "merge", signatures, targetCluster });
  };

  const splitCluster = async (entry: TelegramEntry) => {
    const signatures = entrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "split", signatures });
  };

  const clearClusterRule = async (entry: TelegramEntry) => {
    const signatures = entrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "clear", signatures });
  };

  createEffect(() => {
    const key = focusKey();
    if (!key || filteredEntries().length === 0) return;
    const node = document.getElementById(`msg-${safeDomId(key)}`);
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  const shareFromSite = async (entry: TelegramEntry) => {
    const target = new URL(window.location.href);
    target.searchParams.set("focus", entryKey(entry));
    const shareUrl = target.toString();
    const shareTitle = `${entry.channelLabel} intel update`;
    const shareText = messageText(entry.message).slice(0, 160);
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
    }
  };

  const showInitialLoading = () => loadingInitial() && !data();
  const showEmpty = () => !showInitialLoading() && filteredEntries().length === 0;

  return (
    <>
      <Title>{TELEGRAM_TITLE}</Title>
      <Meta name="description" content={TELEGRAM_DESCRIPTION} />
      <Meta property="og:title" content={TELEGRAM_TITLE} />
      <Meta property="og:description" content={TELEGRAM_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/telegram")} />
      <Meta property="og:type" content="website" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={TELEGRAM_TITLE} />
      <Meta name="twitter:description" content={TELEGRAM_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/telegram")} />
      <div class="intel-page">
      <header class="intel-panel p-6 sm:p-8">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="intel-badge mb-2">
              <div class="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Telegram Monitoring
            </div>
            <h1 class="intel-heading">Telegram Intel</h1>
            <p class="intel-subheading">Unified analyst rail for conflict, OSINT Cyber, strategic monitoring, and media-backed event triage.</p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-white">{filteredEntries().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Visible Msgs</p>
              <Show when={mergeDuplicates() && dedupeSavedCount() > 0}>
                <p class="text-[10px] text-emerald-300/80">-{dedupeSavedCount()} dupes</p>
              </Show>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-emerald-300">{verifiedCount()}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Verified</p>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-cyan-300">{channels().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Channels Monitored</p>
            </div>
            <div class={`rounded-xl border px-3 py-2 text-center ${freshnessPillTone(feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              <p
                class={`font-mono-data text-lg font-bold ${
                  feedFreshness().state === "live"
                    ? "text-emerald-300"
                    : feedFreshness().state === "delayed"
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                {latestMessageAgeLabel()}
              </p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Latest Msg Age</p>
            </div>
          </div>
        </div>
      </header>

      <FeedAccessNotice surface="Telegram" />

      <section class="surface-card space-y-3 p-3 sm:p-4">
        <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Telegram filter groups">
          <For each={activeFilterGroups()}>
            {(group) => (
              <button
                type="button"
                onClick={() => setGroupFilter(group.id)}
                aria-pressed={groupFilter() === group.id}
                class={`min-h-11 cursor-pointer rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                  groupFilter() === group.id
                    ? "border-blue-400/40 bg-blue-500/15 text-blue-200"
                    : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                {group.label}
                <span class="ml-1 text-[10px] opacity-60">({groupCounts()[group.id] || 0})</span>
              </button>
            )}
          </For>

          <Show when={timestamp()}>
            <span class="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500" aria-live="polite">
              <Show when={refreshing()}>
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              </Show>
              <span
                class={`h-1.5 w-1.5 rounded-full ${
                  feedFreshness().state === "live"
                    ? "bg-emerald-300"
                    : feedFreshness().state === "delayed"
                      ? "bg-amber-300"
                      : "bg-red-300"
                }`}
              />
              <Clock size={12} /> Updated {timestamp()}
              <span class="text-zinc-600">•</span>
              <span class={streamConnected() ? "text-emerald-300" : "text-zinc-500"}>
                {streamConnected() ? "Live stream" : "Polling fallback"}
              </span>
              <span class="text-zinc-600">•</span>
              <span class="text-zinc-400">
                {feedFreshness().label}
                <Show when={latestMessageAgeMs() !== null}> ({latestMessageAgeLabel()})</Show>
              </span>
            </span>
          </Show>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setFeedMode("deduped")}
              aria-pressed={feedMode() === "deduped"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "deduped" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Deduped
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("raw")}
              aria-pressed={feedMode() === "raw"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "raw" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("verified")}
              aria-pressed={feedMode() === "verified"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "verified" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Verified
            </button>
          </div>

          <div class="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setAgeWindow("all")}
              aria-pressed={ageWindow() === "all"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "all" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Full history
            </button>
            <button
              type="button"
              onClick={() => setAgeWindow("24h")}
              aria-pressed={ageWindow() === "24h"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "24h" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Last 24h
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMediaOnly(!mediaOnly())}
            aria-pressed={mediaOnly()}
            class={`min-h-11 cursor-pointer rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
              mediaOnly() ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-white/[0.08] bg-black/20 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Media only
          </button>
          <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[11px] text-zinc-400">
            {feedMode() === "raw"
              ? "Raw view shows single-source flow for operator triage."
              : feedMode() === "verified"
                ? "Verified view biases toward multi-source and media-backed clusters."
                : "Deduped view collapses near-duplicates into a cleaner timeline."}
          </div>
        </div>

        <Show when={ownerDedupeEnabled() && mergeDuplicates()}>
          <div class="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[12px] font-semibold text-emerald-200">Owner Dedupe Controls</p>
              <span class="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                Rules: {dedupeFeedbackCount()}
              </span>
              <span class="rounded-full border border-white/[0.1] bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300">
                Selected events: {selectedClusterKeys().length}
              </span>
              <span class="rounded-full border border-white/[0.1] bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300">
                Selected signatures: {selectedSignatures().length}
              </span>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => { void mergeSelectedClusters(); }}
                class="cursor-pointer rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Merge selected
              </button>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => setSelectedClusterKeys([])}
                class="cursor-pointer rounded-md border border-white/[0.15] bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear selection
              </button>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => { void refreshDedupeFeedbackStatus(); }}
                class="cursor-pointer rounded-md border border-white/[0.15] bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh rules
              </button>
              <Show when={adminBusy()}>
                <span class="inline-flex items-center gap-1 text-[11px] text-emerald-100">
                  <LoaderCircle class="h-3.5 w-3.5 animate-spin" /> Applying...
                </span>
              </Show>
            </div>
            <Show when={adminStatus().trim().length > 0}>
              <p class="mt-2 text-[11px] text-emerald-100/90">{adminStatus()}</p>
            </Show>
          </div>
        </Show>
      </section>

      <Show when={freshnessNotice()}>
        {(notice) => (
          <section
            class={`freshness-transition-banner rounded-2xl border px-4 py-3 text-xs ${freshnessBannerTone(notice().state)} ${notice().phase === "exit" ? "freshness-transition-banner--exit" : ""}`}
            role="status"
            aria-live="polite"
          >
            {notice().message}
          </section>
        )}
      </Show>

      <Show when={showInitialLoading()}>
        <div>
          <For each={[1, 2, 3, 4]}>
            {(i) => (
              <div class="telegram-skeleton-card" style={{ "animation-delay": `${(i - 1) * 150}ms` }}>
                <div class="telegram-skeleton-avatar" />
                <div class="flex flex-col gap-2 flex-1">
                  <div class="telegram-skeleton-line telegram-skeleton-line--header" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--long" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--medium" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--short" />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <section class="space-y-3">
          <div class="flex items-center gap-3 border-b border-white/[0.06] pb-2">
            <div class="h-5 w-1 rounded-full bg-blue-500" />
            <h2 class="text-base font-semibold text-white">{groupFilter() === "all" ? "All Messages" : `${activeGroup().label} Messages`}</h2>
            <span class="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono-data text-zinc-300">
              {filteredEntries().length} msgs
            </span>
          </div>
          <div class="space-y-0">
            <For each={filteredEntries()}>
              {(entry) => (
                <MessageCard
                  entry={entry}
                  categoryLabel={categories()[entry.category] || entry.category}
                  showCategory={showCategoryPill()}
                  nowMs={clockNow()}
                  focusKey={focusKey()}
                  onShare={shareFromSite}
                  ownerToolsEnabled={ownerDedupeEnabled() && mergeDuplicates()}
                  selectedForMerge={selectedClusterKeys().includes(entry.dedupe?.clusterKey ?? "")}
                  adminBusy={adminBusy()}
                  onToggleMergeSelect={toggleClusterSelection}
                  onSplitEvent={(item) => { void splitCluster(item); }}
                  onClearRule={(item) => { void clearClusterRule(item); }}
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={showEmpty()}>
        <div class="surface-card p-14 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/40">
            <Radio size={24} class="text-zinc-500" />
          </div>
          <h3 class="text-sm font-medium text-zinc-400">No Telegram messages match the current filters</h3>
          <p class="mt-1 text-[12px] text-zinc-600">Use Show all, switch to Full history, change Deduped/Raw/Verified mode, or disable Media only.</p>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <div class="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-500 sm:grid-cols-3">
          <div class="flex items-center gap-2"><MessageSquare size={12} /> Raw, deduped, and verified modes let operators pivot without leaving the page</div>
          <div class="flex items-center gap-2"><Image size={12} /> Media-only mode isolates visual posts and OCR-backed entries</div>
          <div class="flex items-center gap-2"><Video size={12} /> Source matrix panels expose cluster provenance before merge or escalation</div>
        </div>
      </Show>
      </div>
    </>
  );
}
