export const FREE_FEED_DELAY_MINUTES = 90;
export const TRIAL_DAYS = 7;
export const PREMIUM_PRICE_USD = 8;
export const UPGRADE_INSTANT_FEED_LABEL = "Upgrade for instant feed";

export const FREE_PLAN_NAME = "Free Plan";
export const PREMIUM_PLAN_NAME = "Premium Plan";

export function formatUsdMonthlyCompact(amountUsd: number): string {
  return `$${amountUsd}/mo`;
}

export function formatUsdMonthlySpaced(amountUsd: number): string {
  return `$${amountUsd} / month`;
}

export function formatTrialDaysLabel(days: number): string {
  return `${days}-day trial`;
}

export function formatDelayMinutesCompact(minutes: number): string {
  return `${minutes}m`;
}

export function formatDelayMinutesLong(minutes: number): string {
  return `${minutes}-minute`;
}

export function formatDelayMinutesShortLabel(minutes: number): string {
  return `${Math.max(0, Math.floor(minutes))}m`;
}
