import { getIntelCategoryStyle } from "./intel-category-style.ts";

export type TelegramEntryLike = {
  category: string;
  channelLabel: string;
  channelUsername: string;
  message: {
    link: string;
    datetime: string;
    text_original: string;
    text_en?: string;
    image_text_en?: string;
    media: Array<{ type?: string }>;
  };
  dedupe?: {
    clusterKey?: string;
    sourceCount?: number;
    sourceLabels?: string[];
    sourceSignatures?: string[];
    freshnessTier?: "breaking" | "fresh" | "watch";
    domainTags?: string[];
    categorySet?: string[];
  };
};

export type TelegramFilterGroupLike<TEntry extends TelegramEntryLike = TelegramEntryLike> = {
  id: string;
  categories?: string[];
  predicate?: (entry: TEntry) => boolean;
};

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

export function getTelegramAvatarBgColor(category: string): string {
  const style = getIntelCategoryStyle(category);
  return AVATAR_BG_BY_TEXT_CLASS[style.text] ?? "#a1a1aa";
}

export function getTelegramChannelName(entry: TelegramEntryLike): string {
  return entry.channelLabel || entry.channelUsername || "Telegram source";
}

export function getTelegramAvatarLetter(entry: TelegramEntryLike): string {
  return getTelegramChannelName(entry).charAt(0).toUpperCase() || "T";
}

export function getTelegramEntryKey(entry: TelegramEntryLike): string {
  if (entry.dedupe?.clusterKey) return entry.dedupe.clusterKey;
  return entry.message.link || `${entry.category}:${entry.message.datetime}:${entry.message.text_original.slice(0, 48)}`;
}

export function getTelegramEntrySourceSignatures(entry: TelegramEntryLike): string[] {
  return entry.dedupe?.sourceSignatures?.filter((value) => typeof value === "string" && value.trim().length > 0) ?? [];
}

export function toTelegramSafeDomId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

export function getTelegramRankReasons(args: {
  entry: TelegramEntryLike;
  hasUsefulImageText: (value: string | undefined) => boolean;
}): string[] {
  const { entry, hasUsefulImageText } = args;
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

export function doesTelegramGroupMatchEntry<TEntry extends TelegramEntryLike>(
  group: TelegramFilterGroupLike<TEntry>,
  entry: TEntry,
): boolean {
  if (group.id === "all") return true;
  if (group.predicate?.(entry)) return true;
  const categorySet = new Set(group.categories ?? []);
  if (categorySet.size === 0) return false;
  if (categorySet.has(entry.category)) return true;
  return entry.dedupe?.categorySet?.some((category) => categorySet.has(category)) ?? false;
}
