import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { ChevronLeft, ChevronRight, Clock, ExternalLink, Eye, Image, Link2, MessageSquare, Radio, Share2, Video, X } from "lucide-solid";
import {
  buildFreshnessStatus,
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  useFreshnessTransitionNotice,
} from "~/lib/freshness";
import { useLiveRefresh } from "~/lib/live-refresh";
import { formatRelativeTime } from "~/lib/utils";

interface TelegramMedia {
  type: "video" | "photo";
  url: string;
  thumbnail?: string;
}

interface TelegramMessage {
  text_original: string;
  text_en: string;
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
  categories: Record<string, string>;
  channels: TelegramChannel[];
}

interface TelegramEntry {
  category: string;
  channelLabel: string;
  channelUsername: string;
  message: TelegramMessage;
}

type AgeWindow = "all" | "24h";

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
};

const DEFAULT_STYLE = { bg: "bg-zinc-500/10", border: "border-zinc-500/20", text: "text-zinc-300" };

function getCategoryStyle(category: string) {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}

function parseTs(input: string) {
  const ts = new Date(input).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function messageText(msg: TelegramMessage) {
  return (msg.text_en || msg.text_original || "").trim();
}

function entryKey(entry: TelegramEntry) {
  return entry.message.link || `${entry.category}:${entry.message.datetime}:${entry.message.text_original.slice(0, 48)}`;
}

function safeDomId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 140);
}

function isSameMessage(a: TelegramMessage, b: TelegramMessage) {
  return (
    a.link === b.link &&
    a.datetime === b.datetime &&
    a.text_en === b.text_en &&
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

function VideoPlayer(props: { media: TelegramMedia }) {
  return (
    <div class="overflow-hidden rounded-xl border border-white/[0.08] bg-black/40">
      <video src={props.media.url} controls preload="none" poster={props.media.thumbnail} playsinline class="max-h-[420px] w-full rounded-xl" />
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
  return (
    <div class={collageCellClass(props.count, props.index)}>
      <button type="button" class="telegram-photo-button" onClick={() => props.onOpen(props.index)} aria-label={`Open image ${props.index + 1}`}>
        <img src={props.media.url} alt="" loading="lazy" class="telegram-photo-img" />
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
  focusKey?: string;
  onShare: (entry: TelegramEntry) => void;
}) {
  const [showOriginal, setShowOriginal] = createSignal(false);
  const [activePhotoIndex, setActivePhotoIndex] = createSignal<number | null>(null);
  const hasTranslation = () => props.entry.message.text_en !== props.entry.message.text_original && props.entry.message.language !== "en";
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
  const isFocused = () => props.focusKey === entryKey(props.entry);
  const itemId = () => `msg-${safeDomId(entryKey(props.entry))}`;

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
      <header class="telegram-tweet-header">
        <div class="telegram-tweet-author">
          <p class="telegram-tweet-author-name">{props.entry.channelLabel || props.entry.channelUsername || "Telegram source"}</p>
          <Show when={props.showCategory}>
            <span class={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${style().bg} ${style().border} ${style().text}`}>
              {props.categoryLabel}
            </span>
          </Show>
        </div>
        <span class="telegram-tweet-time">
          <Clock size={11} /> {formatRelativeTime(props.entry.message.datetime)}
        </span>
      </header>

      <p class="telegram-tweet-text">{messageText(props.entry.message)}</p>

      <Show when={hasTranslation()}>
        <button onClick={() => setShowOriginal(!showOriginal())} class="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300">
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

      <Show when={activePhoto()}>
        {(currentPhoto) => (
          <div class="telegram-lightbox" onClick={closeLightbox} role="dialog" aria-modal="true" aria-label="Image viewer">
            <div class="telegram-lightbox-frame" onClick={(event) => event.stopPropagation()}>
              <button type="button" class="telegram-lightbox-close" onClick={closeLightbox} aria-label="Close image viewer">
                <X size={16} />
              </button>

              <img src={currentPhoto().url} alt="" class="telegram-lightbox-img" loading="eager" decoding="async" />

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

      <footer class="telegram-tweet-actions">
        <Show when={props.entry.message.views}>
          <span class="telegram-tweet-action-pill">
            <Eye size={12} /> {props.entry.message.views}
          </span>
        </Show>

        <button type="button" class="telegram-tweet-action-btn" onClick={() => props.onShare(props.entry)}>
          <Share2 size={13} /> Share
        </button>
        <a href={props.entry.message.link} target="_blank" rel="noopener noreferrer" class="telegram-tweet-action-btn">
          <ExternalLink size={13} /> Telegram
        </a>
        <a href={props.entry.message.link} target="_blank" rel="noopener noreferrer" class="telegram-tweet-action-link" title="Message source permalink">
          <Link2 size={13} />
        </a>
      </footer>
    </article>
  );
}

export default function TelegramPage() {
  const [data, setData] = createSignal<TelegramData | null>(null);
  const [loadingInitial, setLoadingInitial] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const [categoryFilter, setCategoryFilter] = createSignal("all");
  const [ageWindow, setAgeWindow] = createSignal<AgeWindow>("all");
  const [mediaOnly, setMediaOnly] = createSignal(false);
  const [focusKey, setFocusKey] = createSignal("");
  const feedThresholds = { liveMaxMinutes: 20, delayedMaxMinutes: 90 } as const;
  let lastTimestamp = "";

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
      setCategoryFilter("all");
    }
    void refreshTelegram();
  });

  useLiveRefresh(refreshTelegram, 75_000, { runImmediately: false, jitterRatio: 0.15 });

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
    return buildFreshnessStatus(latestTs, feedThresholds, {
      noData: "No recent data",
      live: "Live flow",
      delayed: "Delayed",
      stale: "Stale feed",
    });
  });
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, "Telegram feed");

  const isVisibleMessage = (msg: TelegramMessage) => {
    if (ageWindow() === "24h") {
      const ts = parseTs(msg.datetime);
      if (!ts || Date.now() - ts > 24 * 60 * 60 * 1000) return false;
    }
    if (mediaOnly()) {
      return msg.media.length > 0 || msg.has_photo || msg.has_video;
    }
    return true;
  };

  const entries = createMemo<TelegramEntry[]>((prev) => {
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

  const categoryCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries()) {
      counts[entry.category] = (counts[entry.category] || 0) + 1;
    }
    return counts;
  });

  const categoryList = createMemo(() => {
    return Object.entries(categories())
      .filter(([key]) => (categoryCounts()[key] || 0) > 0)
      .sort((a, b) => (categoryCounts()[b[0]] || 0) - (categoryCounts()[a[0]] || 0));
  });

  const filteredEntries = createMemo(() => {
    const category = categoryFilter();
    if (category === "all") return entries();
    return entries().filter((entry) => entry.category === category);
  });

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
    <div class="space-y-6">
      <header class="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-6 sm:p-8">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="mb-2 inline-flex items-center gap-2 rounded-lg border border-blue-400/20 bg-blue-500/10 px-2.5 py-1">
              <div class="h-1.5 w-1.5 rounded-full bg-blue-300" />
              <span class="text-[11px] font-semibold uppercase tracking-wider text-blue-300">Telegram Monitoring</span>
            </div>
            <h1 class="text-3xl font-bold tracking-tight text-white">Telegram Intel</h1>
            <p class="mt-1.5 text-sm text-zinc-400">Unified timeline. Use top filters for Russian Milbloggers, Ukrainian categories, and Show all.</p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-white">{filteredEntries().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Visible Msgs</p>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-cyan-300">{Object.keys(categoryCounts()).length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Active Categories</p>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-amber-300">{channels().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Sources</p>
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
                {feedFreshness().minutes === null ? "n/a" : `${feedFreshness().minutes}m`}
              </p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Latest Msg Age</p>
            </div>
          </div>
        </div>
      </header>

      <section class="surface-card space-y-3 p-3 sm:p-4">
        <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Telegram categories">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            aria-pressed={categoryFilter() === "all"}
            class={`min-h-11 rounded-xl px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
              categoryFilter() === "all" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
            }`}
          >
            Show all <span class="ml-1 text-[10px] opacity-60">({entries().length})</span>
          </button>

          <For each={categoryList()}>
            {([key, label]) => {
              const style = getCategoryStyle(key);
              return (
                <button
                  type="button"
                  onClick={() => setCategoryFilter(key)}
                  aria-pressed={categoryFilter() === key}
                  class={`min-h-11 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                    categoryFilter() === key
                      ? `${style.bg} ${style.text} ${style.border}`
                      : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  {label as string}
                  <span class="ml-1 text-[10px] opacity-60">({categoryCounts()[key] || 0})</span>
                </button>
              );
            }}
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
              <span class="text-zinc-400">
                {feedFreshness().label}
                <Show when={feedFreshness().minutes !== null}> ({feedFreshness().minutes}m)</Show>
              </span>
            </span>
          </Show>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setAgeWindow("all")}
              aria-pressed={ageWindow() === "all"}
              class={`min-h-11 rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "all" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Full history
            </button>
            <button
              type="button"
              onClick={() => setAgeWindow("24h")}
              aria-pressed={ageWindow() === "24h"}
              class={`min-h-11 rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "24h" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Last 24h
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMediaOnly(!mediaOnly())}
            aria-pressed={mediaOnly()}
            class={`min-h-11 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
              mediaOnly() ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-white/[0.08] bg-black/20 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Media only
          </button>
        </div>
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
        <div class="flex flex-col items-center justify-center space-y-4 py-20">
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
            <MessageSquare size={20} class="text-blue-300" />
          </div>
          <p class="text-sm text-zinc-500">Loading Telegram feed...</p>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <section class="space-y-3">
          <div class="flex items-center gap-3 border-b border-white/[0.06] pb-2">
            <div class="h-5 w-1 rounded-full bg-blue-500" />
            <h2 class="text-base font-semibold text-white">{categoryFilter() === "all" ? "All Messages" : categories()[categoryFilter()] || categoryFilter()}</h2>
            <span class="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono-data text-zinc-300">
              {filteredEntries().length} msgs
            </span>
          </div>
          <div class="space-y-2">
            <For each={filteredEntries()}>
              {(entry) => (
                <MessageCard
                  entry={entry}
                  categoryLabel={categories()[entry.category] || entry.category}
                  showCategory={categoryFilter() === "all"}
                  focusKey={focusKey()}
                  onShare={shareFromSite}
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
          <p class="mt-1 text-[12px] text-zinc-600">Use Show all, switch to Full history, or disable Media only.</p>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <div class="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-500 sm:grid-cols-3">
          <div class="flex items-center gap-2"><MessageSquare size={12} /> Unified Twitter-style feed controlled by top filters</div>
          <div class="flex items-center gap-2"><Image size={12} /> Media-only mode isolates visual posts</div>
          <div class="flex items-center gap-2"><Video size={12} /> Share links stay on-site and deep-link to each message</div>
        </div>
      </Show>
    </div>
  );
}
