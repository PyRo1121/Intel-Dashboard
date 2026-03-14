import type {
  SubscriberAlertItem,
  SubscriberAlertPreferences,
  SubscriberAlertState,
  SubscriberAlertType,
} from "@intel-dashboard/shared/subscriber-alerts.ts";
import { matchesOsintSourcePreference } from "@intel-dashboard/shared/osint-source-profile.ts";
import type { SubscriberFeedPreferences } from "@intel-dashboard/shared/subscriber-feed.ts";

type TelegramCanonicalEventLike = {
  event_id: string;
  datetime: string;
  category: string;
  domain_tags?: string[];
  source_labels?: string[];
  source_channels?: string[];
  text_en?: string;
  text_original?: string;
  signal_score?: number;
  signal_grade?: string;
  signal_reasons?: string[];
  first_reporter_channel?: string;
  first_reporter_label?: string;
  sources?: Array<{ link?: string }>;
};

type IntelItemLike = {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: string;
  category: string;
  severity: string;
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeString(value).toLowerCase())
    .filter(Boolean);
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function matchesNormalized(list: string[], value: string | undefined): boolean {
  const normalized = normalizeKey(value ?? "");
  return normalized.length > 0 && list.includes(normalized);
}

function coerceTimestamp(value: string | undefined): string {
  const timestamp = normalizeString(value);
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? timestamp : new Date().toISOString();
}

function normalizeTelegramText(event: TelegramCanonicalEventLike): string {
  return [event.text_en, event.text_original]
    .map((value) => normalizeString(value))
    .find((value) => value.length > 0) ?? "";
}

function buildAlertId(userId: string, type: SubscriberAlertType, itemId: string, matchedPreference: string): string {
  return `${normalizeKey(userId)}:${type}:${itemId}:${normalizeKey(matchedPreference)}`;
}

function createAlert(args: {
  userId: string;
  type: SubscriberAlertType;
  itemId: string;
  matchedPreference: string;
  sourceSurface: "telegram" | "osint";
  createdAt: string;
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
  channelOrProvider: string;
  region: string;
  tags: string[];
  signalScore: number;
  signalGrade?: string;
  rankReasons: string[];
}): SubscriberAlertItem {
  return {
    id: buildAlertId(args.userId, args.type, args.itemId, args.matchedPreference),
    type: args.type,
    sourceSurface: args.sourceSurface,
    createdAt: args.createdAt,
    readAt: null,
    title: args.title,
    summary: args.summary,
    link: args.link,
    sourceLabel: args.sourceLabel,
    channelOrProvider: args.channelOrProvider,
    region: args.region,
    tags: args.tags,
    signalScore: args.signalScore,
    signalGrade: args.signalGrade,
    rankReasons: args.rankReasons,
    matchedPreference: args.matchedPreference,
  };
}

export function normalizeSubscriberAlertState(value: string | null | undefined): SubscriberAlertState {
  return value === "all" ? "all" : "unread";
}

export function createDefaultSubscriberAlertPreferences(): SubscriberAlertPreferences {
  return {
    firstReportRegionEnabled: true,
    highSignalRegionEnabled: true,
    firstReportChannelEnabled: true,
    highSignalSourceEnabled: true,
    minimumTelegramHighSignalGrade: "B",
  };
}

export function normalizeSubscriberAlertPreferences(value: unknown): SubscriberAlertPreferences {
  const defaults = createDefaultSubscriberAlertPreferences();
  if (!value || typeof value !== "object") {
    return defaults;
  }
  const record = value as Record<string, unknown>;
  const updatedAt = normalizeString(record.updatedAt) || undefined;
  const minimumTelegramHighSignalGrade = normalizeKey(normalizeString(record.minimumTelegramHighSignalGrade)) === "a" ? "A" : "B";
  return {
    firstReportRegionEnabled: record.firstReportRegionEnabled !== false,
    highSignalRegionEnabled: record.highSignalRegionEnabled !== false,
    firstReportChannelEnabled: record.firstReportChannelEnabled !== false,
    highSignalSourceEnabled: record.highSignalSourceEnabled !== false,
    minimumTelegramHighSignalGrade,
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export function matchTelegramSubscriberAlerts(args: {
  userId: string;
  event: TelegramCanonicalEventLike;
  preferences: SubscriberFeedPreferences;
  alertPreferences: SubscriberAlertPreferences;
}): SubscriberAlertItem[] {
  const tags = normalizeStringArray(args.event.domain_tags);
  const channel = normalizeString(args.event.source_channels?.[0] ?? args.event.first_reporter_channel);
  const sourceLabel = normalizeString(args.event.source_labels?.[0] ?? args.event.first_reporter_label) || "Telegram";
  const region = normalizeString(args.event.category);
  const signalScore =
    typeof args.event.signal_score === "number" && Number.isFinite(args.event.signal_score)
      ? Math.max(0, Math.min(100, args.event.signal_score))
      : 0;
  const signalGrade = normalizeString(args.event.signal_grade) || undefined;
  const rankReasons = normalizeStringArray(args.event.signal_reasons);
  const isFirst = rankReasons.includes("first");
  const isHighSignal =
    args.alertPreferences.minimumTelegramHighSignalGrade === "A"
      ? signalGrade === "A"
      : signalGrade === "A" || signalGrade === "B";
  const title = normalizeTelegramText(args.event).slice(0, 180);
  const summary = normalizeTelegramText(args.event);
  const link = normalizeString(args.event.sources?.[0]?.link);
  const alerts: SubscriberAlertItem[] = [];

  for (const watchedRegion of args.preferences.watchRegions) {
    if (!matchesNormalized([watchedRegion], region)) continue;
    if (isFirst && args.alertPreferences.firstReportRegionEnabled) {
      alerts.push(createAlert({
        userId: args.userId,
        type: "first_report_region",
        itemId: `telegram:${args.event.event_id}`,
        matchedPreference: watchedRegion,
        sourceSurface: "telegram",
        createdAt: coerceTimestamp(args.event.datetime),
        title,
        summary,
        link,
        sourceLabel,
        channelOrProvider: channel,
        region,
        tags,
        signalScore,
        signalGrade,
        rankReasons,
      }));
    }
    if (isHighSignal && args.alertPreferences.highSignalRegionEnabled) {
      alerts.push(createAlert({
        userId: args.userId,
        type: "high_signal_region",
        itemId: `telegram:${args.event.event_id}`,
        matchedPreference: watchedRegion,
        sourceSurface: "telegram",
        createdAt: coerceTimestamp(args.event.datetime),
        title,
        summary,
        link,
        sourceLabel,
        channelOrProvider: channel,
        region,
        tags,
        signalScore,
        signalGrade,
        rankReasons,
      }));
    }
  }

  for (const favoriteChannel of args.preferences.favoriteChannels) {
    if (!matchesNormalized([favoriteChannel], channel)) continue;
    if (isFirst && args.alertPreferences.firstReportChannelEnabled) {
      alerts.push(createAlert({
        userId: args.userId,
        type: "first_report_channel",
        itemId: `telegram:${args.event.event_id}`,
        matchedPreference: favoriteChannel,
        sourceSurface: "telegram",
        createdAt: coerceTimestamp(args.event.datetime),
        title,
        summary,
        link,
        sourceLabel,
        channelOrProvider: channel,
        region,
        tags,
        signalScore,
        signalGrade,
        rankReasons,
      }));
    }
  }

  return alerts;
}

export function matchOsintSubscriberAlerts(args: {
  userId: string;
  item: IntelItemLike;
  preferences: SubscriberFeedPreferences;
  alertPreferences: SubscriberAlertPreferences;
}): SubscriberAlertItem[] {
  const severity = normalizeKey(args.item.severity);
  const source = normalizeString(args.item.source);
  const region = normalizeString(args.item.region);
  const tags = [normalizeString(args.item.category), region].filter(Boolean);
  const severityBase = severity === "critical" ? 90 : severity === "high" ? 78 : severity === "medium" ? 62 : 45;
  const isHighSignal = severity === "high" || severity === "critical";
  const alerts: SubscriberAlertItem[] = [];

  if (isHighSignal) {
    for (const watchedRegion of args.preferences.watchRegions) {
      if (!matchesNormalized([watchedRegion], region)) continue;
      if (args.alertPreferences.highSignalRegionEnabled) {
        alerts.push(createAlert({
          userId: args.userId,
          type: "high_signal_region",
          itemId: `osint:${args.item.url}`,
          matchedPreference: watchedRegion,
          sourceSurface: "osint",
          createdAt: coerceTimestamp(args.item.timestamp),
          title: normalizeString(args.item.title),
          summary: normalizeString(args.item.summary),
          link: normalizeString(args.item.url),
          sourceLabel: source,
          channelOrProvider: source,
          region,
          tags,
          signalScore: severityBase,
          rankReasons: [],
        }));
      }
    }

    for (const favoriteSource of args.preferences.favoriteSources) {
      if (!matchesOsintSourcePreference([favoriteSource], { name: source })) continue;
      if (args.alertPreferences.highSignalSourceEnabled) {
        alerts.push(createAlert({
          userId: args.userId,
          type: "high_signal_source",
          itemId: `osint:${args.item.url}`,
          matchedPreference: favoriteSource,
          sourceSurface: "osint",
          createdAt: coerceTimestamp(args.item.timestamp),
          title: normalizeString(args.item.title),
          summary: normalizeString(args.item.summary),
          link: normalizeString(args.item.url),
          sourceLabel: source,
          channelOrProvider: source,
          region,
          tags,
          signalScore: severityBase,
          rankReasons: [],
        }));
      }
    }
  }

  return alerts;
}

export function sortSubscriberAlerts(items: SubscriberAlertItem[]): SubscriberAlertItem[] {
  return [...items].sort((left, right) => {
    const timeDiff = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    return right.signalScore - left.signalScore;
  });
}
