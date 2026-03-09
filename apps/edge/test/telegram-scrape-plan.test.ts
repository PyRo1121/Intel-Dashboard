import assert from 'node:assert/strict';
import test from 'node:test';
import { CHANNELS } from '../src/channels.ts';
import { resolveTelegramScrapePlan } from '../src/telegram-scrape-plan.ts';

test('resolveTelegramScrapePlan keeps hot channels every cycle and rotates the rest across the window', () => {
  const planA = resolveTelegramScrapePlan({
    channels: CHANNELS.slice(0, 12),
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 60,
    hotChannelsPerCycle: 4,
  });
  const planB = resolveTelegramScrapePlan({
    channels: CHANNELS.slice(0, 12),
    nowMs: 10_000,
    intervalMs: 10_000,
    rotationWindowSeconds: 60,
    hotChannelsPerCycle: 4,
  });

  assert.equal(planA.slots, 6);
  assert.equal(planB.slots, 6);
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
