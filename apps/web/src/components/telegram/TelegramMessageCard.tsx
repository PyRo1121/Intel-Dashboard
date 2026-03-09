import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { ChevronLeft, ChevronRight, Clock, Copy, Eye, Share2, X } from "lucide-solid";
import { TelegramPhotoViewer, TelegramVideoPlayer } from "./TelegramMedia";
import { formatEventLabel } from "~/lib/event-label";
import { getIntelCategoryStyle } from "~/lib/intel-category-style";
import {
  getTelegramAvatarLetter,
  getTelegramAvatarBgColor,
  getTelegramChannelName,
  getTelegramEntryKey,
  getTelegramEntrySourceSignatures,
  getTelegramRankReasons,
  toTelegramSafeDomId,
} from "~/lib/telegram-entry-meta";
import { getTelegramCollageLayoutClass } from "~/lib/telegram-media-layout";
import {
  entryMediaCount,
  freshnessBadgeClass,
  freshnessStateForAge,
  hasUsefulImageText,
  mediaUrl,
  messageText,
  trustBadgeClass,
  trustTierForSignals,
  verificationLabelForSignals,
} from "~/lib/telegram-entry";
import type { TelegramEntry } from "~/lib/telegram-types";
import { formatRelativeTimeAt, parseTimestampMs as parseTs } from "~/lib/utils";

export default function TelegramMessageCard(props: {
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
  const videos = () => props.entry.message.media.filter((media) => media.type === "video");
  const photos = () => props.entry.message.media.filter((media) => media.type === "photo");
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
              <For each={videos()}>{(media) => <TelegramVideoPlayer media={media} />}</For>
            </div>
          </Show>

          <Show when={photos().length > 0}>
            <div class={`telegram-photo-collage ${getTelegramCollageLayoutClass(visiblePhotos().length)} mt-3`}>
              <For each={visiblePhotos()}>
                {(media, index) => (
                  <TelegramPhotoViewer
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
