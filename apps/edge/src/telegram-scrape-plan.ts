import type { ChannelConfig } from './channels';
import { parseTelegramCollectorChannelSpecs } from '@intel-dashboard/shared/telegram-collector.ts';

export type TelegramScrapePlan = {
  channels: ChannelConfig[];
  slot: number;
  slots: number;
};

export function resolveTelegramScrapePlan(args: {
  channels: ChannelConfig[];
  nowMs: number;
  intervalMs: number;
  rotationWindowSeconds: number;
  hotChannelsPerCycle: number;
  mtprotoChannels?: string[];
}): TelegramScrapePlan {
  const mtprotoSet = new Set((args.mtprotoChannels ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  const prioritized = [...args.channels]
    .filter((channel) => !mtprotoSet.has(channel.username.toLowerCase()))
    .sort((left, right) => right.subscriberValueScore - left.subscriberValueScore);
  const hotLimit = Math.max(0, Math.min(args.hotChannelsPerCycle, prioritized.length));
  const hotChannels = prioritized.slice(0, hotLimit);
  const hotSet = new Set(hotChannels.map((channel) => channel.username));
  const rotatingPool = args.channels.filter((channel) => !hotSet.has(channel.username));
  const intervalMs = Math.max(1, args.intervalMs);
  const rotationWindowMs = Math.max(1, args.rotationWindowSeconds) * 1000;
  const slots = Math.max(1, Math.ceil(rotationWindowMs / intervalMs));

  if (slots <= 1 || rotatingPool.length <= 1) {
    return {
      channels: hotChannels.length > 0 ? [...hotChannels, ...rotatingPool] : args.channels,
      slot: 0,
      slots: 1,
    };
  }

  const slot = Math.floor(args.nowMs / intervalMs) % slots;
  const selected = rotatingPool.filter((_, index) => index % slots === slot);
  return {
    channels: selected.length > 0 ? [...hotChannels, ...selected] : [...hotChannels, ...rotatingPool],
    slot,
    slots,
  };
}
