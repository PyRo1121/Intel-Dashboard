import { Show, createSignal } from "solid-js";
import { LoaderCircle, RefreshCw, Video } from "lucide-solid";
import { mediaUrl } from "~/lib/telegram-entry";
import { getTelegramCollageCellClass } from "~/lib/telegram-media-layout";
import type { TelegramMedia } from "~/lib/telegram-types";

export function TelegramVideoPlayer(props: { media: TelegramMedia }) {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal(false);
  const [retryKey, setRetryKey] = createSignal(0);

  const handleRetry = () => {
    setError(false);
    setLoading(true);
    setRetryKey((key) => key + 1);
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
          onError={() => {
            setLoading(false);
            setError(true);
          }}
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
          <button
            type="button"
            onClick={handleRetry}
            class="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3.5 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/[0.1] hover:text-white/90"
          >
            <RefreshCw class="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </Show>
    </div>
  );
}

export function TelegramPhotoViewer(props: {
  media: TelegramMedia;
  count: number;
  index: number;
  overflowCount: number;
  onOpen: (index: number) => void;
}) {
  const [loaded, setLoaded] = createSignal(false);

  return (
    <div class={getTelegramCollageCellClass(props.count, props.index)}>
      <button
        type="button"
        class="telegram-photo-button"
        onClick={() => props.onOpen(props.index)}
        aria-label={`Open image ${props.index + 1}`}
      >
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
