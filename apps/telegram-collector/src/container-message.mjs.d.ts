export type CollectorChannelSpec = {
  username: string;
  label: string;
  category: string;
};

export type NormalizedCollectorEventMessage = {
  channel: string;
  label: string;
  category: string;
  messageId: string;
  datetime: string;
  link: string;
  textOriginal: string;
  textEn?: string;
  language: string;
  views?: string;
  media: Array<{ type: "photo" | "video"; url: string }>;
  hasPhoto: boolean;
  hasVideo: boolean;
  collectorMessageId: string;
};

export function normalizeTelegramEventMessage(args: {
  event: unknown;
  channelMap: Map<string, CollectorChannelSpec>;
}): NormalizedCollectorEventMessage | null;
