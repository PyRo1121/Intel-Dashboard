export function normalizeTelegramEventMessage({ event, channelMap }) {
  const message = event?.message;
  const chat = event?.chat;
  const username = String(chat?.username || "").trim().toLowerCase();
  const channel = channelMap.get(username);
  if (!channel || !message?.id) return null;

  const textOriginal = String(message?.message || "").trim();
  const media = [];
  if (!textOriginal && media.length === 0) return null;

  const normalizeMessageDate = (value) => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value * 1000).toISOString();
    }
    return null;
  };
  const datetime = normalizeMessageDate(message?.date);
  if (!datetime) return null;

  return {
    channel: channel.username,
    label: channel.label,
    category: channel.category,
    messageId: String(message.id),
    datetime,
    link: `https://t.me/${channel.username}/${message.id}`,
    textOriginal,
    textEn: textOriginal || undefined,
    language: "unknown",
    views: message?.views === null || message?.views === undefined ? undefined : String(message.views),
    media,
    hasPhoto: false,
    hasVideo: false,
    collectorMessageId: `${channel.username}:${message.id}`,
  };
}
