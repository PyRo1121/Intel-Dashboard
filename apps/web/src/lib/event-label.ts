export function formatEventLabel(raw: string | undefined, emptyLabel = "—"): string {
  const value = (raw || "").trim();
  if (!value) return emptyLabel;
  return value.replaceAll(/[._-]+/g, " ");
}

export function formatActivityKindLabel(value: string | undefined): string {
  const normalized = formatEventLabel(value, "Event");
  if (!normalized) return "Event";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatTitleLabel(raw: string | undefined, emptyLabel = "—"): string {
  const normalized = formatEventLabel(raw, emptyLabel);
  if (normalized === emptyLabel) return emptyLabel;
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}
