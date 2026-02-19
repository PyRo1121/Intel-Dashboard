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

export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  if (!Number.isFinite(then)) return "unknown";
  const diff = Math.floor((now - then) / 1000);
  if (diff < 0) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatPrice(price: number): string {
  return `${(price * 100).toFixed(0)}¢`;
}
