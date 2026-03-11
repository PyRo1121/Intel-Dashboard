import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTelegramScrapePlan } from '../src/telegram-scrape-plan.ts';
import { CHANNELS } from '../src/channels.ts';

test('authority-selected mtproto channels are excluded from the hot slice', () => {
  const channels = CHANNELS.slice(0, 12);
  const mtprotoChannels = channels
    .sort((a, b) => b.subscriberValueScore - a.subscriberValueScore)
    .slice(0, 3)
    .map((channel) => channel.username.toLowerCase());

  const plan = resolveTelegramScrapePlan({
    channels,
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 4,
    mtprotoChannels,
  });

  const hotSlice = plan.channels.slice(0, 4).map((channel) => channel.username.toLowerCase());
  for (const channel of mtprotoChannels) {
    assert.equal(hotSlice.includes(channel), false);
  }
});
