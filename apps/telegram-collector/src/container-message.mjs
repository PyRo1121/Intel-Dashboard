export function normalizeTelegramEventMessage({ event, channelMap }) {
  const message = event?.message;
  const chat = event?.chat;
  const username = String(chat?.username || "").trim().toLowerCase();
  const channel = channelMap.get(username);
  if (!channel || !message?.id) return null;

  const textOriginal = String(message?.message || "").trim();
  const media = [];
  if (!textOriginal && media.length === 0) return null;

  return {
    channel: channel.username,
    label: channel.label,
    category: channel.category,
    messageId: String(message.id),
    datetime: message?.date instanceof Date ? message.date.toISOString() : new Date().toISOString(),
    link: `https://t.me/${channel.username}/${message.id}`,
    textOriginal,
    textEn: textOriginal || undefined,
    language: "unknown",
    views: message?.views ? String(message.views) : undefined,
    media,
    hasPhoto: false,
    hasVideo: false,
    collectorMessageId: `${channel.username}:${message.id}`,
  };
}
