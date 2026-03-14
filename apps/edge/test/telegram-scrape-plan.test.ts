import assert from 'node:assert/strict';
import test from 'node:test';
import { CHANNELS } from '../src/channels.ts';
import { resolveTelegramScrapePlan, summarizeSlowFetches } from '../src/telegram-scrape-plan.ts';

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
  assert.equal(planA.mustHitCount, 4);
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


test('resolveTelegramScrapePlan splits non-MTProto channels into must-hit, fast, and slow rotate tiers', () => {
  const channels = CHANNELS.slice(0, 30);
  const plan = resolveTelegramScrapePlan({
    channels,
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 12,
    mustHitChannelsPerCycle: 6,
    fastRotateBandSize: 12,
    slowRotationMultiplier: 4,
  });

  assert.equal(plan.mustHitCount, 6);
  assert.ok(plan.fastRotateCount > 0);
  assert.ok(plan.slowRotateCount >= 0);
  assert.ok(plan.channels.length >= 6);
});

test('resolveTelegramScrapePlan keeps must-hit channels stable while fast and slow tiers rotate across slots', () => {
  const channels = CHANNELS.slice(0, 30);
  const planA = resolveTelegramScrapePlan({
    channels,
    nowMs: 0,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 12,
    mustHitChannelsPerCycle: 6,
    fastRotateBandSize: 12,
    slowRotationMultiplier: 4,
  });
  const planB = resolveTelegramScrapePlan({
    channels,
    nowMs: 10_000,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 12,
    mustHitChannelsPerCycle: 6,
    fastRotateBandSize: 12,
    slowRotationMultiplier: 4,
  });

  const mustHitA = planA.channels.slice(0, planA.mustHitCount).map((channel) => channel.username);
  const mustHitB = planB.channels.slice(0, planB.mustHitCount).map((channel) => channel.username);
  assert.deepEqual(mustHitA, mustHitB);
  assert.notDeepEqual(planA.channels.map((channel) => channel.username), planB.channels.map((channel) => channel.username));
});

test('resolveTelegramScrapePlan still returns a channel when tier rotation would otherwise produce an empty cycle', () => {
  const channels = CHANNELS.slice(0, 2);
  const plan = resolveTelegramScrapePlan({
    channels,
    nowMs: 20_000,
    intervalMs: 10_000,
    rotationWindowSeconds: 30,
    hotChannelsPerCycle: 0,
    mustHitChannelsPerCycle: 0,
    fastRotateBandSize: 0,
    slowRotationMultiplier: 4,
  });

  assert.equal(plan.channels.length > 0, true);
});


test('summarizeSlowFetches reports the slowest fetches above threshold', () => {
  const summary = summarizeSlowFetches([
    { username: 'a', durationMs: 1200 },
    { username: 'b', durationMs: 6200 },
    { username: 'c', durationMs: 4800 },
    { username: 'd', durationMs: 7100 },
  ], 3000, 2);
  assert.equal(summary, 'd:7100ms, b:6200ms');
  assert.equal(summarizeSlowFetches([{ username: 'a', durationMs: 1000 }]), null);
  assert.equal(summarizeSlowFetches([]), null);
  assert.equal(
    summarizeSlowFetches([
      { username: 'a', durationMs: 2999 },
      { username: 'b', durationMs: Number.NaN },
      { username: 'c', durationMs: Number.POSITIVE_INFINITY },
    ], 3000, 1),
    null,
  );
  assert.equal(
    summarizeSlowFetches([
      { username: 'a', durationMs: 6200 },
      { username: 'b', durationMs: 7100 },
      { username: 'c', durationMs: 4800 },
    ], 3000, 1),
    'b:7100ms',
  );
});
