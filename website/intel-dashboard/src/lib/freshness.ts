import { createEffect, createSignal, onCleanup, type Accessor } from "solid-js";

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
  label: string;
}

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

export function freshnessTooltip(thresholds: FreshnessThresholds): string {
  return `Freshness thresholds: live <= ${thresholds.liveMaxMinutes}m, delayed <= ${thresholds.delayedMaxMinutes}m, stale > ${thresholds.delayedMaxMinutes}m.`;
}

export function buildFreshnessStatus(
  latestTimestampMs: number,
  thresholds: FreshnessThresholds,
  labels?: FreshnessLabels,
): FreshnessStatus {
  const resolved = normalizeLabels(labels);
  if (!Number.isFinite(latestTimestampMs) || latestTimestampMs <= 0) {
    return { state: "stale", minutes: null, label: resolved.noData };
  }

  const minutes = Math.max(0, Math.round((Date.now() - latestTimestampMs) / 60_000));
  if (minutes <= thresholds.liveMaxMinutes) {
    return { state: "live", minutes, label: resolved.live };
  }
  if (minutes <= thresholds.delayedMaxMinutes) {
    return { state: "delayed", minutes, label: resolved.delayed };
  }
  return { state: "stale", minutes, label: resolved.stale };
}

export function freshnessPillTone(state: FreshnessState): string {
  if (state === "live") return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  if (state === "delayed") return "border-amber-400/25 bg-amber-500/10 text-amber-200";
  return "border-red-400/25 bg-red-500/10 text-red-200";
}

export function freshnessBannerTone(state: FreshnessState): string {
  if (state === "live") return "border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-100";
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
    const message =
      current.state === "live"
        ? `${subject} recovered to live (${current.minutes}m).`
        : current.state === "delayed"
          ? `${subject} moved to delayed (${current.minutes}m).`
          : `${subject} became stale (${current.minutes}m).`;

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
