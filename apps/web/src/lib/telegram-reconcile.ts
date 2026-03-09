import { isSameTelegramMessage } from "./telegram-dedupe.ts";
import { getTelegramLegacyEntryKey } from "./telegram-dedupe-cluster.ts";

export type TelegramReconcileMessage = {
  link: string;
  datetime: string;
  text_original: string;
  text_en: string;
  image_text_en?: string;
  views: string;
  media: Array<{ url: string }>;
};

export type TelegramReconcileChannel<TMessage extends TelegramReconcileMessage = TelegramReconcileMessage> = {
  category: string;
  messages: TMessage[];
};

export type TelegramReconcileData<
  TMessage extends TelegramReconcileMessage = TelegramReconcileMessage,
  TChannel extends TelegramReconcileChannel<TMessage> = TelegramReconcileChannel<TMessage>,
> = {
  channels: TChannel[];
};

export function reconcileTelegramData<
  TMessage extends TelegramReconcileMessage,
  TChannel extends TelegramReconcileChannel<TMessage>,
  TData extends TelegramReconcileData<TMessage, TChannel>,
>(prev: TData, next: TData): TData {
  const prevByKey = new Map<string, TMessage>();
  for (const channel of prev.channels) {
    for (const message of channel.messages) {
      prevByKey.set(getTelegramLegacyEntryKey({ category: channel.category, message }), message);
    }
  }

  return {
    ...next,
    channels: next.channels.map((channel) => ({
      ...channel,
      messages: channel.messages.map((message) => {
        const key = getTelegramLegacyEntryKey({ category: channel.category, message });
        const existing = prevByKey.get(key);
        return existing && isSameTelegramMessage(existing, message) ? existing : message;
      }),
    })) as TChannel[],
  };
}
