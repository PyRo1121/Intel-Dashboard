import {
  isTelegramCollectorBatch,
  type TelegramCollectorBatch,
  type TelegramCollectorMessage,
  type TelegramCollectorMessageMedia,
} from "@intel-dashboard/shared/telegram-collector.ts";

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMedia(
  media: TelegramCollectorMessage["media"],
): TelegramCollectorMessageMedia[] {
  if (!Array.isArray(media)) return [];
  return media
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const url = trimString(record.url);
      const type: TelegramCollectorMessageMedia["type"] | null =
        record.type === "video" ? "video" : record.type === "photo" ? "photo" : null;
      if (!url || !type) return null;
      const width = Number.isFinite(record.width) ? Number(record.width) : undefined;
      const height = Number.isFinite(record.height) ? Number(record.height) : undefined;
      return {
        url,
        type,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

export type NormalizedTelegramCollectorBatch = {
  source: "mtproto";
  accountId: string;
  collectedAt: string;
  messages: TelegramCollectorMessage[];
};

export function normalizeTelegramCollectorBatch(
  value: unknown,
): NormalizedTelegramCollectorBatch | null {
  if (!isTelegramCollectorBatch(value)) return null;
  const accountId = trimString(value.accountId);
  const collectedAt = trimString(value.collectedAt);
  if (!accountId || !collectedAt) return null;

  const seen = new Set<string>();
  const messages: TelegramCollectorMessage[] = [];
  for (const raw of value.messages) {
    const channel = trimString(raw.channel).toLowerCase();
    const label = trimString(raw.label) || channel;
    const category = trimString(raw.category).toLowerCase();
    const messageId = trimString(raw.messageId);
    const datetime = trimString(raw.datetime);
    const link = trimString(raw.link);
    const textOriginal = trimString(raw.textOriginal);
    if (!channel || !category || !messageId || !datetime || !link) continue;
    if (!textOriginal && (!Array.isArray(raw.media) || raw.media.length === 0)) continue;
    const dedupeKey = `${channel}:${messageId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const media = normalizeMedia(raw.media);
    messages.push({
      channel,
      label,
      category,
      messageId,
      datetime,
      link,
      textOriginal,
      textEn: trimString(raw.textEn) || undefined,
      imageTextEn: trimString(raw.imageTextEn) || undefined,
      language: trimString(raw.language) || undefined,
      views: trimString(raw.views) || undefined,
      media,
      hasVideo: Boolean(raw.hasVideo ?? media.some((item) => item.type === "video")),
      hasPhoto: Boolean(raw.hasPhoto ?? media.some((item) => item.type === "photo")),
      collectorMessageId: trimString(raw.collectorMessageId) || undefined,
    });
  }

  return {
    source: "mtproto",
    accountId,
    collectedAt,
    messages,
  };
}
