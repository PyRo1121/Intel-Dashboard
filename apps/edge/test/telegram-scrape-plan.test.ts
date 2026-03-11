import assert from 'node:assert/strict';
import test from 'node:test';
import { CHANNELS } from '../src/channels.ts';
import { resolveTelegramScrapePlan } from '../src/telegram-scrape-plan.ts';

test('resolveTelegramScrapePlan keeps hot channels every cycle and rotates the rest across the window', () => {
  const planA = resolveTelegramScrapePlan({
    channels: CHANNELS.slice(0, 12),
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 4,
  });
  const planB = resolveTelegramScrapePlan({
    channels: CHANNELS.slice(0, 12),
    nowMs: 10_000,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 4,
  });

  assert.equal(planA.slots, 3);
  assert.equal(planB.slots, 3);
  const hot = CHANNELS.slice(0, 12)
    .sort((a, b) => b.subscriberValueScore - a.subscriberValueScore)
    .slice(0, 4)
    .map((c) => c.username)
    .sort();
  const planAHot = planA.channels.slice(0, 4).map((c) => c.username).sort();
  const planBHot = planB.channels.slice(0, 4).map((c) => c.username).sort();
  assert.deepEqual(planAHot, hot);
  assert.deepEqual(planBHot, hot);
  assert.notDeepEqual(planA.channels.map((c) => c.username), planB.channels.map((c) => c.username));
});

test('resolveTelegramScrapePlan collapses to one slot when rotation window is smaller than interval', () => {
  const plan = resolveTelegramScrapePlan({
    channels: CHANNELS.slice(0, 5),
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 5,
    hotChannelsPerCycle: 2,
  });
  assert.equal(plan.slots, 1);
  assert.equal(plan.channels.length, 5);
});

test('resolveTelegramScrapePlan excludes MTProto-authoritative channels from the hot set', () => {
  const channels = CHANNELS.slice(0, 12);
  const forcedMtproto = channels
    .sort((a, b) => b.subscriberValueScore - a.subscriberValueScore)
    .slice(0, 2)
    .map((channel) => channel.username);

  const plan = resolveTelegramScrapePlan({
    channels,
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 4,
    mtprotoChannels: forcedMtproto,
  });

  const hotSlice = plan.channels.slice(0, 4).map((channel) => channel.username);
  for (const username of forcedMtproto) {
    assert.equal(hotSlice.includes(username), false);
  }
});
