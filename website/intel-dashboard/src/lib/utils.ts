import type { Severity } from "./types";

export function severityColor(severity: Severity | ""): string {
  switch (severity) {
    case "critical": return "text-red-400";
    case "high": return "text-amber-400";
    case "medium": return "text-blue-400";
    case "low": return "text-zinc-400";
    default: return "text-zinc-500";
  }
}

export function severityBg(severity: Severity | ""): string {
  switch (severity) {
    case "critical": return "bg-red-500/15 text-red-400 ring-red-500/30";
    case "high": return "bg-amber-500/15 text-amber-400 ring-amber-500/30";
    case "medium": return "bg-blue-500/15 text-blue-400 ring-blue-500/30";
    case "low": return "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30";
    default: return "bg-zinc-500/10 text-zinc-500 ring-zinc-500/20";
  }
}

export function formatRelativeTimeAt(timestamp: string, now: number): string {
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  return `${formatAgeCompactFromMs(diffMs)} ago`;
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

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(0)}¢`;
}
