export function getAviationSourceLabel(source: string | null | undefined): string {
  const normalized = (source ?? "").trim();
  return normalized.length > 0 ? normalized : "Source unavailable";
}

export function getAviationSourceNote(source: string | null | undefined): string {
  const normalized = (source ?? "").trim().toLowerCase();
  if (!normalized) {
    return "Aviation snapshot unavailable.";
  }
  if (normalized.includes("cached")) {
    return "Showing cached aviation snapshot; background refresh pending.";
  }
  return "OpenSky data refreshes every 5 minutes";
}
