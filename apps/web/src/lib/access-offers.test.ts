import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_FEED_DELAY_MINUTES,
  FREE_PLAN_NAME,
  PREMIUM_PLAN_NAME,
  PREMIUM_PRICE_USD,
  TRIAL_DAYS,
  formatDelayMinutesCompact,
  formatDelayMinutesLong,
  formatDelayMinutesShortLabel,
  formatTrialDaysLabel,
  formatUsdMonthlyCompact,
  formatUsdMonthlySpaced,
  UPGRADE_INSTANT_FEED_LABEL,
} from "../../shared/access-offers.ts";

test("shared access offer constants and formatters stay aligned", () => {
  assert.equal(FREE_FEED_DELAY_MINUTES, 90);
  assert.equal(TRIAL_DAYS, 7);
  assert.equal(PREMIUM_PRICE_USD, 8);
  assert.equal(FREE_PLAN_NAME, "Free Plan");
  assert.equal(PREMIUM_PLAN_NAME, "Premium Plan");
  assert.equal(UPGRADE_INSTANT_FEED_LABEL, "Upgrade for instant feed");
  assert.equal(formatUsdMonthlyCompact(PREMIUM_PRICE_USD), "$8/mo");
  assert.equal(formatUsdMonthlySpaced(PREMIUM_PRICE_USD), "$8 / month");
  assert.equal(formatTrialDaysLabel(TRIAL_DAYS), "7-day trial");
  assert.equal(formatDelayMinutesCompact(FREE_FEED_DELAY_MINUTES), "90m");
  assert.equal(formatDelayMinutesLong(FREE_FEED_DELAY_MINUTES), "90-minute");
  assert.equal(formatDelayMinutesShortLabel(FREE_FEED_DELAY_MINUTES), "90m");
});
