import { parseTimestampMs } from "./utils.ts";

export type TelegramFeedMessageLike = {
  datetime: string;
};

export type TelegramFeedChannelLike<TMessage extends TelegramFeedMessageLike = TelegramFeedMessageLike> = {
  messages?: TMessage[];
};

export function sortTelegramChannelsByMessageTime<
  TMessage extends TelegramFeedMessageLike,
  TChannel extends TelegramFeedChannelLike<TMessage>,
>(channels: TChannel[]): Array<TChannel & { messages: TMessage[] }> {
  return channels.map((channel) => ({
    ...channel,
    messages: [...(channel.messages ?? [])].sort(
      (a, b) => parseTimestampMs(b.datetime) - parseTimestampMs(a.datetime),
    ),
  }));
}

export function getLatestTelegramMessageTimestamp<
  TMessage extends TelegramFeedMessageLike,
  TChannel extends TelegramFeedChannelLike<TMessage>,
>(channels: Array<TChannel & { messages: TMessage[] }>): number {
  let latest = 0;
  for (const channel of channels) {
    for (const message of channel.messages) {
      const ts = parseTimestampMs(message.datetime);
      if (ts > latest) latest = ts;
    }
  }
  return latest;
}
