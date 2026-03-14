function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  return raw || null;
}

function normalizeMessageDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  return null;
}

export function getEventChannelUsername(event) {
  return trim(event?.chat?.username).replace(/^@+/, "").toLowerCase() || null;
}

export function getEventChannelId(event) {
  const candidates = [
    event?.message?.peerId?.channelId,
    event?.chatId,
    event?.chat?.id,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export function isLikelyChannelEvent(event) {
  if (event?.message?.peerId?.channelId != null) return true;
  const username = getEventChannelUsername(event);
  if (username) return true;
  const className = event?.chat?.className || event?.chat?.constructor?.name || null;
  if (typeof className === "string" && /channel/i.test(className)) return true;
  return false;
}

export function normalizeTelegramEventMessage(event, channelMap, channelIdMap) {
  const message = event?.message;
  const username = getEventChannelUsername(event);
  const channelId = getEventChannelId(event);
  const channel = (username ? channelMap.get(username) : null) || (channelId ? channelIdMap.get(channelId) : null);
  if (!channel || !message?.id) return null;

  const textOriginal = trim(message?.message);
  const media = []; // TODO: Populate collector media references when transport support is added.
  if (!textOriginal && media.length === 0) return null;
  const datetime = normalizeMessageDate(message?.date);
  if (!datetime) return null;
  const hasPhoto = media.some((item) => item.type === "photo");
  const mimeType = trim(message?.media?.document?.mimeType);
  const hasVideo = mimeType.startsWith("video/") && media.some((item) => item.type === "video");

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
    hasPhoto,
    hasVideo,
    collectorMessageId: `${channel.username}:${message.id}`,
  };
}
