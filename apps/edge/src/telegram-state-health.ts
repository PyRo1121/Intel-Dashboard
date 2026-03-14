export function isTelegramStateStale(args: {
  timestamp: string | null | undefined;
  nowMs: number;
  maxAgeMs: number;
}): boolean {
  const ts = typeof args.timestamp === "string" ? Date.parse(args.timestamp) : Number.NaN;
  if (!Number.isFinite(ts)) return true;
  return Math.max(0, args.nowMs - ts) > Math.max(0, args.maxAgeMs);
}

export function shouldSelfHealTelegramState(args: {
  timestamp: string | null | undefined;
  nowMs: number;
  maxAgeMs: number;
  isRunning: boolean;
  alarmAt: number | null | undefined;
}): boolean {
  if (args.isRunning) return false;
  const stale = isTelegramStateStale({
    timestamp: args.timestamp,
    nowMs: args.nowMs,
    maxAgeMs: args.maxAgeMs,
  });
  if (!stale) return false;
  if (!Number.isFinite(args.alarmAt ?? Number.NaN)) return true;
  return Number(args.alarmAt) <= args.nowMs;
}
