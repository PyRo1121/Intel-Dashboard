import type { Severity } from "./types";

type SeverityCarrier = {
  severity: Severity | "";
};

const SEVERITY_STYLES: Record<Severity, {
  text: string;
  surface: string;
  dot: string;
  hex: string;
}> = {
  critical: {
    text: "text-red-400",
    surface: "bg-red-500/15 text-red-400 ring-red-500/30",
    dot: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
    hex: "#ef4444",
  },
  high: {
    text: "text-amber-400",
    surface: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
    hex: "#f59e0b",
  },
  medium: {
    text: "text-blue-400",
    surface: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
    dot: "bg-blue-400",
    hex: "#3b82f6",
  },
  low: {
    text: "text-zinc-400",
    surface: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
    dot: "bg-zinc-500",
    hex: "#71717a",
  },
};

export function severityColor(severity: Severity | ""): string {
  return severity ? SEVERITY_STYLES[severity].text : "text-zinc-500";
}

export function severityBg(severity: Severity | ""): string {
  return severity ? SEVERITY_STYLES[severity].surface : "bg-zinc-500/10 text-zinc-500 ring-zinc-500/20";
}

export function severityDot(severity: Severity | ""): string {
  return severity ? SEVERITY_STYLES[severity].dot : "bg-zinc-500";
}

export function severityHexColor(severity: Severity | ""): string {
  return severity ? SEVERITY_STYLES[severity].hex : "#71717a";
}

export function formatRelativeTimeAt(timestamp: string, now: number): string {
  const then = parseTimestampMs(timestamp);
  if (!Number.isFinite(then)) return "unknown";
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  return `${formatAgeCompactFromMs(diffMs)} ago`;
}

export function parseTimestampMs(timestamp: string): number {
  const then = new Date(timestamp).getTime();
  return Number.isFinite(then) ? then : Number.NaN;
}

export function formatAgeCompactFromMs(ageMs: number | null): string {
  if (ageMs === null) return "n/a";
  const totalSeconds = Math.max(0, Math.floor(ageMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${String(remMinutes).padStart(2, "0")}m`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${String(remHours).padStart(2, "0")}h`;
}

export function formatAgeAgoAt(atMs: number | undefined, nowMs: number): string {
  if (typeof atMs !== "number" || !Number.isFinite(atMs)) {
    return "Unknown";
  }
  return `${formatAgeCompactFromMs(Math.max(0, nowMs - atMs))} ago`;
}

export function isInitialResourceLoading(resourceState: string | undefined, itemCount: number): boolean {
  return resourceState === "refreshing" && itemCount === 0;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function parseCompactNumber(value: string): number {
  const upper = value.replace(/,/g, "").trim().toUpperCase();
  const match = upper.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/);
  if (!match) return Number.parseInt(upper.replace(/[^0-9]/g, ""), 10) || 0;
  const base = Number.parseFloat(match[1]);
  if (match[2] === "K") return Math.round(base * 1_000);
  if (match[2] === "M") return Math.round(base * 1_000_000);
  if (match[2] === "B") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

export function formatWholeNumber(value: number | undefined): string {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.floor(safe)));
}

export function formatUsd(value: number | undefined): string {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, safe));
}

export function formatPercent(value: number | undefined): string {
  const safe = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return `${Math.max(0, safe).toFixed(1)}%`;
}

export function formatDateTime(ms: number | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return "—";
  return new Date(ms).toLocaleString();
}

export function formatShortDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatLongDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(0)}¢`;
}

export function countBySeverity<T extends SeverityCarrier>(items: T[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const item of items) {
    if (item.severity) counts[item.severity] += 1;
  }
  return counts;
}
