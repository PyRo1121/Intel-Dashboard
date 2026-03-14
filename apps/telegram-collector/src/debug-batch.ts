import type { TelegramCollectorBatch, TelegramCollectorMessage } from "@intel-dashboard/shared/telegram-collector.ts";

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDebugCollectorBatch(payload: Record<string, unknown>, accountId: string): TelegramCollectorBatch | null {
  const maybeMessages = Array.isArray(payload.messages) ? payload.messages : null;
  if (!maybeMessages) return null;
  const messages = maybeMessages.filter((item): item is TelegramCollectorMessage => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return (
      typeof record.channel === "string" &&
      typeof record.category === "string" &&
      typeof record.messageId === "string" &&
      typeof record.datetime === "string" &&
      typeof record.link === "string"
    );
  });
  if (messages.length === 0) return null;
  return {
    source: "mtproto",
    accountId: accountId || trim(payload.accountId),
    collectedAt: trim(payload.collectedAt) || new Date().toISOString(),
    messages,
  };
}
