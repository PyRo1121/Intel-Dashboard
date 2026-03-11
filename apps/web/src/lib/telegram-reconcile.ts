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
  TEvent extends { event_key?: string; event_id?: string } = { event_key?: string; event_id?: string },
> = {
  channels: TChannel[];
  canonical_events?: TEvent[];
};

export function reconcileTelegramData<
  TMessage extends TelegramReconcileMessage,
  TChannel extends TelegramReconcileChannel<TMessage>,
  TEvent extends { event_key?: string; event_id?: string },
  TData extends TelegramReconcileData<TMessage, TChannel, TEvent>,
>(prev: TData, next: TData): TData {
  const prevByKey = new Map<string, TMessage>();
  for (const channel of prev.channels) {
    for (const message of channel.messages) {
      prevByKey.set(getTelegramLegacyEntryKey({ category: channel.category, message }), message);
    }
  }

  let reconciledEvents = next.canonical_events;
  if (prev.canonical_events && next.canonical_events) {
    const prevEventByKey = new Map<string, TEvent>();
    for (const event of prev.canonical_events) {
      const key = event.event_key || event.event_id;
      if (key) prevEventByKey.set(key, event);
    }

    reconciledEvents = next.canonical_events.map((event) => {
      const key = event.event_key || event.event_id;
      if (!key) return event;
      const existing = prevEventByKey.get(key);
      // Because events are complex and mergeDuplicates runs on the backend, 
      // we only reuse the object if JSON stringify is identical, or we can just use 
      // Solid's reconcile approach. For simplicity, we stringify to ensure deep equality.
      // Wait, stringify is slow. Let's just compare a few crucial fields.
      if (existing && JSON.stringify(existing) === JSON.stringify(event)) {
        return existing;
      }
      return event;
    });
  }

  return {
    ...next,
    canonical_events: reconciledEvents,
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
