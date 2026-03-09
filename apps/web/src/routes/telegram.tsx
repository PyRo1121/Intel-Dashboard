import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { ChevronLeft, ChevronRight, Clock, Copy, Eye, Image, LoaderCircle, MessageSquare, Radio, RefreshCw, Share2, Video, X } from "lucide-solid";
import {
  buildFreshnessStatusAt,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  STANDARD_FEED_FRESHNESS_THRESHOLDS,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { fetchClientJson, fetchPublicJson } from "~/lib/client-json";
import {
  fastHash,
  isSameTelegramMessage,
  jaccardSimilarity,
  messageMediaSignature,
  normalizeDedupeText,
  tokenizeDedupeText,
} from "~/lib/telegram-dedupe";
import {
  buildTelegramDedupeClusterKey,
  getTelegramDominantCategory,
  getTelegramLegacyEntryKey,
  registerTelegramClusterIndex,
  scoreTelegramDedupeCluster,
} from "~/lib/telegram-dedupe-cluster";
import { dedupeTelegramEntries } from "~/lib/telegram-dedupe-run";
import { formatEventLabel } from "~/lib/event-label";
import { getIntelCategoryStyle } from "~/lib/intel-category-style";
import {
  getTelegramAvatarLetter,
  doesTelegramGroupMatchEntry,
  getTelegramAvatarBgColor,
  getTelegramChannelName,
  getTelegramEntryKey,
  getTelegramEntrySourceSignatures,
  getTelegramRankReasons,
  toTelegramSafeDomId,
} from "~/lib/telegram-entry-meta";
import { getTelegramCollageCellClass, getTelegramCollageLayoutClass } from "~/lib/telegram-media-layout";
import {
  entryMediaCount,
  freshnessBadgeClass,
  freshnessStateForAge,
  hasUsefulImageText,
  isVerifiedEntry,
  mediaUrl,
  messageText,
  trustBadgeClass,
  trustTierForSignals,
  verificationLabelForSignals,
} from "~/lib/telegram-entry";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import { reconcileTelegramData } from "~/lib/telegram-reconcile";
import { formatAgeCompactFromMs, formatRelativeTimeAt, parseTimestampMs as parseTs } from "~/lib/utils";
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

function PhotoViewer(props: { media: TelegramMedia; count: number; index: number; overflowCount: number; onOpen: (index: number) => void }) {
  const [loaded, setLoaded] = createSignal(false);
  return (
    <div class={getTelegramCollageCellClass(props.count, props.index)}>
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
  const style = () => getIntelCategoryStyle(props.entry.category);
  const trustTier = () => trustTierForSignals({
    trustTier: props.entry.dedupe?.trustTier,
    sourceCount: props.entry.dedupe?.sourceCount,
  });
  const freshnessState = () => freshnessStateForAge(Math.max(0, props.nowMs - parseTs(props.entry.message.datetime)));
  const rankReasons = () => getTelegramRankReasons({
    entry: props.entry,
    hasUsefulImageText,
  });
  const sourceLabels = () => props.entry.dedupe?.sourceLabels ?? [];
  const isFocused = () => props.focusKey === getTelegramEntryKey(props.entry);
  const itemId = () => `msg-${toTelegramSafeDomId(getTelegramEntryKey(props.entry))}`;
  const channelName = () => getTelegramChannelName(props.entry);
  const avatarLetter = () => getTelegramAvatarLetter(props.entry);
  const sourceSignatureCount = () => getTelegramEntrySourceSignatures(props.entry).length;
  const copyShareLink = async () => {
    const target = new URL(window.location.href);
    target.searchParams.set("focus", getTelegramEntryKey(props.entry));
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
        <div class="telegram-tweet-avatar" style={{ "background-color": getTelegramAvatarBgColor(props.entry.category) }}>
          {avatarLetter()}
        </div>
        <div class="telegram-tweet-content">
          <header class="telegram-tweet-header">
            <div class="telegram-tweet-author">
              <p class="telegram-tweet-author-name">{channelName()}</p>
              <span class="telegram-tweet-time">· {formatRelativeTimeAt(props.entry.message.datetime, props.nowMs)}</span>
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
              {verificationLabelForSignals({
                verificationState: props.entry.dedupe?.verificationState,
                sourceCount: props.entry.dedupe?.sourceCount,
                hasMedia: props.entry.message.media.length > 0,
                hasUsefulImageText: hasUsefulImageText(props.entry.message.image_text_en),
              })}
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
            <div class={`telegram-photo-collage ${getTelegramCollageLayoutClass(visiblePhotos().length)} mt-3`}>
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
                    {formatEventLabel(props.entry.dedupe?.verificationState)}
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
                        {formatEventLabel(tag)}
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
  const feedThresholds = STANDARD_FEED_FRESHNESS_THRESHOLDS;
  let lastTimestamp = "";

  const refreshDedupeFeedbackStatus = async (): Promise<void> => {
    const result = await fetchClientJson<{ count?: unknown }>("/api/telegram/dedupe-feedback", {
      signal: AbortSignal.timeout(8_000),
    });
    if (!result.ok) {
      if (result.status === 403) {
        setOwnerDedupeEnabled(false);
        setDedupeFeedbackCount(0);
      }
      // Best-effort owner capability detection.
      return;
    }
    setOwnerDedupeEnabled(true);
    const count = typeof result.data.count === "number" && Number.isFinite(result.data.count) ? Math.max(0, Math.floor(result.data.count)) : 0;
    setDedupeFeedbackCount(count);
  };

  const refreshTelegram = async (): Promise<boolean> => {
    if (refreshing()) return false;
    setRefreshing(true);
    try {
      const result = await fetchPublicJson<TelegramData>("/api/telegram", {
        signal: AbortSignal.timeout(15_000),
      });
      if (!result.ok) return false;
      const next = result.data;

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
      const merged = prev ? reconcileTelegramData(prev, next) : next;
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
    const prevMap = new Map(previous.map((entry) => [getTelegramEntryKey(entry), entry]));
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
      counts[group.id] = entries().filter((entry) => doesTelegramGroupMatchEntry(group, entry)).length;
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
      if (activeGroupId !== "all" && !doesTelegramGroupMatchEntry(group, entry)) {
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
      for (const signature of getTelegramEntrySourceSignatures(entry)) {
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
    if (!clusterKey || getTelegramEntrySourceSignatures(entry).length === 0) return;
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
      const result = await fetchClientJson<unknown>("/api/telegram/dedupe-feedback", {
        method: "POST",
        body: JSON.stringify({
          action: args.action,
          signatures: args.signatures,
          ...(args.targetCluster ? { targetCluster: args.targetCluster } : {}),
        }),
      });
      if (!result.ok) {
        setAdminStatus(`Dedupe action failed (${result.status ?? "?"}) ${result.error.slice(0, 120)}`);
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
    const signatures = getTelegramEntrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "split", signatures });
  };

  const clearClusterRule = async (entry: TelegramEntry) => {
    const signatures = getTelegramEntrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "clear", signatures });
  };

  createEffect(() => {
    const key = focusKey();
    if (!key || filteredEntries().length === 0) return;
    const node = document.getElementById(`msg-${toTelegramSafeDomId(key)}`);
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  const shareFromSite = async (entry: TelegramEntry) => {
    const target = new URL(window.location.href);
    target.searchParams.set("focus", getTelegramEntryKey(entry));
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
