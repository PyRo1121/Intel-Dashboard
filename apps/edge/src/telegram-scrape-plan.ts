import type { ChannelConfig } from './channels';
import { parseTelegramCollectorChannelSpecs } from '@intel-dashboard/shared/telegram-collector.ts';

export type TelegramScrapePlan = {
  channels: ChannelConfig[];
  slot: number;
  slots: number;
  mustHitCount: number;
  fastRotateCount: number;
  slowRotateCount: number;
};

function uniqueByUsername(channels: ChannelConfig[]): ChannelConfig[] {
  const seen = new Set<string>();
  const out: ChannelConfig[] = [];
  for (const channel of channels) {
    const key = channel.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(channel);
  }
  return out;
}

export function resolveTelegramScrapePlan(args: {
  channels: ChannelConfig[];
  nowMs: number;
  intervalMs: number;
  rotationWindowSeconds: number;
  hotChannelsPerCycle: number;
  mtprotoChannels?: string[];
  mustHitChannelsPerCycle?: number;
  fastRotateBandSize?: number;
  slowRotationMultiplier?: number;
}): TelegramScrapePlan {
  const mtprotoSet = new Set((args.mtprotoChannels ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean));
  const prioritized = [...args.channels]
    .filter((channel) => !mtprotoSet.has(channel.username.toLowerCase()))
    .sort((left, right) => right.subscriberValueScore - left.subscriberValueScore);

  const mustHitCount = Math.max(0, Math.min(args.mustHitChannelsPerCycle ?? Math.min(48, args.hotChannelsPerCycle), prioritized.length));
  const mustHitChannels = prioritized.slice(0, mustHitCount);
  const fastBandSize = Math.max(0, Math.min(args.fastRotateBandSize ?? Math.max(0, args.hotChannelsPerCycle - mustHitCount + 64), prioritized.length - mustHitCount));
  const fastRotatePool = prioritized.slice(mustHitCount, mustHitCount + fastBandSize);
  const slowRotatePool = prioritized.slice(mustHitCount + fastBandSize);

  const intervalMs = Math.max(1, args.intervalMs);
  const rotationWindowMs = Math.max(1, args.rotationWindowSeconds) * 1000;
  const fastSlots = Math.max(1, Math.ceil(rotationWindowMs / intervalMs));
  const slowSlots = Math.max(1, fastSlots * Math.max(1, Math.floor(args.slowRotationMultiplier ?? 4)));
  const fastSlot = Math.floor(args.nowMs / intervalMs) % fastSlots;
  const slowSlot = Math.floor(args.nowMs / intervalMs) % slowSlots;

  const fastSelected = fastRotatePool.filter((_, index) => index % fastSlots === fastSlot);
  const slowSelected = slowRotatePool.filter((_, index) => index % slowSlots === slowSlot);
  const channels = uniqueByUsername([
    ...mustHitChannels,
    ...fastSelected,
    ...slowSelected,
  ]);

  return {
    channels,
    slot: fastSlot,
    slots: fastSlots,
    mustHitCount: mustHitChannels.length,
    fastRotateCount: fastSelected.length,
    slowRotateCount: slowSelected.length,
  };
}


export type TelegramSlowFetchSample = {
  username: string;
  durationMs: number;
};

export function summarizeSlowFetches(samples: readonly TelegramSlowFetchSample[], thresholdMs = 3000, limit = 3): string | null {
  const filtered = samples
    .filter((sample) => Number.isFinite(sample.durationMs) && sample.durationMs >= thresholdMs)
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, Math.max(1, limit));
  if (filtered.length === 0) return null;
  return filtered.map((sample) => `${sample.username}:${Math.round(sample.durationMs)}ms`).join(', ');
}
