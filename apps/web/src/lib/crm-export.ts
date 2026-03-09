import { formatEventLabel } from "./event-label.ts";
import { formatDateTime } from "./utils.ts";

export type CrmLatestEventLike = {
  userId?: string;
  atMs?: number;
  kind?: string;
};

export function buildCrmLatestEventMap(
  events: Array<CrmLatestEventLike> | null | undefined,
): Map<string, { atMs?: number; kind?: string }> {
  const map = new Map<string, { atMs?: number; kind?: string }>();
  for (const event of events ?? []) {
    if (typeof event.userId === "string" && event.userId.trim().length > 0 && !map.has(event.userId)) {
      map.set(event.userId, { atMs: event.atMs, kind: event.kind });
    }
  }
  return map;
}

export function getCrmLatestEventDisplay(
  event: { atMs?: number; kind?: string } | null | undefined,
): { kindLabel: string; atLabel: string } {
  return {
    kindLabel: formatEventLabel(event?.kind),
    atLabel: formatDateTime(event?.atMs),
  };
}

export function escapeCsvCell(value: unknown): string {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`;
  }
  return text;
}
