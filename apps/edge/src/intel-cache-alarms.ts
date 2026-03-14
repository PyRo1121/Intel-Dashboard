export function resolveStartupAlarmAt(
  currentAlarm: number | null,
  nowMs: number,
  refreshIntervalMs: number,
): number | null {
  if (typeof currentAlarm === "number" && Number.isFinite(currentAlarm)) {
    return currentAlarm;
  }
  return nowMs + refreshIntervalMs;
}
