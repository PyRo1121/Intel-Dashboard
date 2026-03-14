export type TelegramCollectorMessageMedia = {
  url: string;
  type: "photo" | "video";
  width?: number;
  height?: number;
};

export type TelegramCollectorMessage = {
  channel: string;
  label: string;
  category: string;
  messageId: string;
  datetime: string;
  link: string;
  textOriginal: string;
  textEn?: string;
  imageTextEn?: string;
  language?: string;
  views?: string;
  media?: TelegramCollectorMessageMedia[];
  hasVideo?: boolean;
  hasPhoto?: boolean;
  collectorMessageId?: string;
};

export type TelegramCollectorBatch = {
  source: "mtproto";
  accountId: string;
  collectedAt: string;
  messages: TelegramCollectorMessage[];
};

export type TelegramIngestAuthority = "scraper" | "mtproto";

export type TelegramCollectorChannelSpec = {
  username: string;
  label: string;
  category: string;
};

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseTelegramCollectorChannelSpecs(raw: string | undefined | null): TelegramCollectorChannelSpec[] {
  const text = trim(raw);
  if (!text) return [];
  const seen = new Set<string>();
  const entries: TelegramCollectorChannelSpec[] = [];

  for (const part of text.split(/[\n,]+/)) {
    const compact = trim(part);
    if (!compact) continue;
    const [usernameRaw, labelRaw, categoryRaw] = compact.split("|");
    const username = trim(usernameRaw).replace(/^@+/, "").toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    entries.push({
      username,
      label: trim(labelRaw) || username,
      category: trim(categoryRaw).toLowerCase() || "telegram",
    });
  }

  return entries;
}

export function isTelegramCollectorBatch(value: unknown): value is TelegramCollectorBatch {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.source === "mtproto" &&
    typeof record.accountId === "string" &&
    typeof record.collectedAt === "string" &&
    Array.isArray(record.messages)
  );
}


export type TelegramChannelAuthority = "scraper" | "mtproto";
export type TelegramChannelJoinStatus = "pending" | "joined" | "unavailable";

export type TelegramChannelAuthorityRow = {
  channel: string;
  desiredAuthority: TelegramChannelAuthority;
  effectiveAuthority: TelegramChannelAuthority;
  joinStatus: TelegramChannelJoinStatus;
  lastCollectorMessageAt?: string | null;
  lastScraperMessageAt?: string | null;
  updatedAt: string;
};
