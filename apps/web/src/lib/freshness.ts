import { createEffect, createMemo, createSignal, onCleanup, type Accessor } from "solid-js";
import { formatAgeCompactFromMs } from "./utils.ts";

export type FreshnessState = "live" | "delayed" | "stale";

export interface FreshnessThresholds {
  liveMaxMinutes: number;
  delayedMaxMinutes: number;
}

export interface FreshnessLabels {
  noData?: string;
  live?: string;
  delayed?: string;
  stale?: string;
}

export interface FreshnessStatus {
  state: FreshnessState;
  minutes: number | null;
  ageMs: number | null;
  label: string;
}

export const STANDARD_FEED_FRESHNESS_THRESHOLDS = {
  liveMaxMinutes: 20,
  delayedMaxMinutes: 90,
} as const;

export interface FreshnessTransitionNotice {
  state: FreshnessState;
  message: string;
  phase: "enter" | "exit";
}

const DEFAULT_LABELS: Required<FreshnessLabels> = {
  noData: "No recent data",
  live: "Live",
  delayed: "Delayed",
  stale: "Stale",
};

function normalizeLabels(labels?: FreshnessLabels): Required<FreshnessLabels> {
  return {
    noData: labels?.noData ?? DEFAULT_LABELS.noData,
    live: labels?.live ?? DEFAULT_LABELS.live,
    delayed: labels?.delayed ?? DEFAULT_LABELS.delayed,
    stale: labels?.stale ?? DEFAULT_LABELS.stale,
  };
}

export function maxIsoTimestamp(values: Array<string | undefined | null>): number {
  let latest = 0;
  for (const value of values) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (Number.isFinite(ts) && ts > latest) latest = ts;
  }
  return latest;
}

export function maxIsoTimestampBy<T>(
  items: readonly T[],
  select: (item: T) => string | undefined | null,
): number {
  let latest = 0;
  for (const item of items) {
    const value = select(item);
    if (!value) continue;
    const ts = Date.parse(value);
    if (Number.isFinite(ts) && ts > latest) latest = ts;
  }
  return latest;
}

export function freshnessTooltip(thresholds: FreshnessThresholds): string {
  return `Freshness thresholds: live <= ${thresholds.liveMaxMinutes}m, delayed <= ${thresholds.delayedMaxMinutes}m, stale > ${thresholds.delayedMaxMinutes}m.`;
}

export function buildFreshnessStatusAt(
  nowMs: number,
  latestTimestampMs: number,
  thresholds: FreshnessThresholds,
  labels?: FreshnessLabels,
): FreshnessStatus {
  const resolved = normalizeLabels(labels);
  if (!Number.isFinite(latestTimestampMs) || latestTimestampMs <= 0) {
    return { state: "stale", minutes: null, ageMs: null, label: resolved.noData };
  }

  const ageMs = Math.max(0, nowMs - latestTimestampMs);
  const minutes = Math.floor(ageMs / 60_000);
  if (ageMs <= thresholds.liveMaxMinutes * 60_000) {
    return { state: "live", minutes, ageMs, label: resolved.live };
  }
  if (ageMs <= thresholds.delayedMaxMinutes * 60_000) {
    return { state: "delayed", minutes, ageMs, label: resolved.delayed };
  }
  return { state: "stale", minutes, ageMs, label: resolved.stale };
}

export function freshnessPillTone(state: FreshnessState): string {
  if (state === "live") return "border-orange-400/35 bg-orange-500/12 text-orange-100";
  if (state === "delayed") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-red-400/25 bg-red-500/10 text-red-200";
}

export function freshnessBannerTone(state: FreshnessState): string {
  if (state === "live") return "border-orange-400/25 bg-orange-500/[0.10] text-orange-100";
  if (state === "delayed") return "border-amber-400/20 bg-amber-500/[0.08] text-amber-100";
  return "border-red-400/20 bg-red-500/[0.08] text-red-100";
}

export function useFreshnessTransitionNotice(
  status: Accessor<FreshnessStatus>,
  subject: string,
  dismissMs = 9000,
): Accessor<FreshnessTransitionNotice | null> {
  const [notice, setNotice] = createSignal<FreshnessTransitionNotice | null>(null);
  let previousState: FreshnessState | null = null;
  let exitTimer: number | null = null;
  let clearTimer: number | null = null;

  createEffect(() => {
    if (typeof window === "undefined") return;

    const current = status();
    if (current.minutes === null) {
      previousState = current.state;
      return;
    }

    if (!previousState) {
      previousState = current.state;
      return;
    }

    if (previousState === current.state) return;

    previousState = current.state;
    const ageLabel = formatAgeCompactFromMs(current.ageMs);
    const message =
      current.state === "live"
        ? `${subject} recovered to live (${ageLabel}).`
        : current.state === "delayed"
          ? `${subject} moved to delayed (${ageLabel}).`
          : `${subject} became stale (${ageLabel}).`;

    setNotice({ state: current.state, message, phase: "enter" });

    const visibleFor = Math.max(3000, dismissMs);
    const exitLeadMs = Math.min(260, Math.max(140, Math.floor(visibleFor * 0.18)));

    if (exitTimer !== null) {
      window.clearTimeout(exitTimer);
    }
    if (clearTimer !== null) {
      window.clearTimeout(clearTimer);
    }

    exitTimer = window.setTimeout(() => {
      setNotice((currentNotice) => {
        if (!currentNotice) return null;
        return { ...currentNotice, phase: "exit" };
      });
    }, Math.max(0, visibleFor - exitLeadMs));

    clearTimer = window.setTimeout(() => {
      setNotice(null);
      exitTimer = null;
      clearTimer = null;
    }, visibleFor);
  });

  onCleanup(() => {
    if (exitTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(exitTimer);
    }
    if (clearTimer !== null && typeof window !== "undefined") {
      window.clearTimeout(clearTimer);
    }
  });

  return notice;
}

export function useFeedFreshness(params: {
  nowMs: Accessor<number>;
  latestTimestampMs: Accessor<number>;
  thresholds: FreshnessThresholds;
  subject: string;
  labels?: FreshnessLabels;
}) {
  const feedFreshness = createMemo(() =>
    buildFreshnessStatusAt(
      params.nowMs(),
      params.latestTimestampMs(),
      params.thresholds,
      params.labels,
    ),
  );
  const latestFeedAgeMs = createMemo(() => {
    const ts = params.latestTimestampMs();
    if (!Number.isFinite(ts) || ts <= 0) return null;
    return Math.max(0, params.nowMs() - ts);
  });
  const latestFeedAgeLabel = createMemo(() => formatAgeCompactFromMs(latestFeedAgeMs()));
  const freshnessNotice = useFreshnessTransitionNotice(feedFreshness, params.subject);

  return {
    feedFreshness,
    latestFeedAgeMs,
    latestFeedAgeLabel,
    freshnessNotice,
  };
}
