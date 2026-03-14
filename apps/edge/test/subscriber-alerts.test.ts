import assert from "node:assert/strict";
import test from "node:test";
import { createEmptySubscriberFeedPreferences } from "../src/subscriber-feed.ts";
import {
  createDefaultSubscriberAlertPreferences,
  matchOsintSubscriberAlerts,
  matchTelegramSubscriberAlerts,
  normalizeSubscriberAlertPreferences,
  normalizeSubscriberAlertState,
  sortSubscriberAlerts,
} from "../src/subscriber-alerts.ts";

test("normalizeSubscriberAlertState defaults to unread", () => {
  assert.equal(normalizeSubscriberAlertState("all"), "all");
  assert.equal(normalizeSubscriberAlertState("unread"), "unread");
  assert.equal(normalizeSubscriberAlertState("other"), "unread");
});

test("normalizeSubscriberAlertPreferences applies safe defaults", () => {
  assert.deepEqual(createDefaultSubscriberAlertPreferences(), {
    firstReportRegionEnabled: true,
    highSignalRegionEnabled: true,
    firstReportChannelEnabled: true,
    highSignalSourceEnabled: true,
    minimumTelegramHighSignalGrade: "B",
  });

  assert.equal(normalizeSubscriberAlertPreferences({ minimumTelegramHighSignalGrade: "a" }).minimumTelegramHighSignalGrade, "A");
  assert.equal(normalizeSubscriberAlertPreferences({ highSignalRegionEnabled: false }).highSignalRegionEnabled, false);
});

test("normalizeSubscriberAlertPreferences handles non-objects, updatedAt, and fallback normalization", () => {
  assert.deepEqual(normalizeSubscriberAlertPreferences(null), createDefaultSubscriberAlertPreferences());
  assert.deepEqual(normalizeSubscriberAlertPreferences("invalid"), createDefaultSubscriberAlertPreferences());

  const normalized = normalizeSubscriberAlertPreferences({
    updatedAt: "2026-03-09T12:00:00.000Z",
    minimumTelegramHighSignalGrade: "garbage",
  });
  assert.equal(normalized.updatedAt, "2026-03-09T12:00:00.000Z");
  assert.equal(normalized.minimumTelegramHighSignalGrade, "B");
  assert.equal(normalized.firstReportRegionEnabled, true);
  assert.equal(normalized.highSignalRegionEnabled, true);
  assert.equal(normalized.firstReportChannelEnabled, true);
  assert.equal(normalized.highSignalSourceEnabled, true);
});

test("telegram alerts match watched regions and favorite channels", () => {
  const prefs = createEmptySubscriberFeedPreferences();
  prefs.watchRegions = ["ukraine"];
  prefs.favoriteChannels = ["alpha"];

  const alerts = matchTelegramSubscriberAlerts({
    userId: "user-1",
    event: {
      event_id: "evt-1",
      datetime: "2026-03-09T12:00:00.000Z",
      category: "ukraine",
      source_channels: ["alpha"],
      source_labels: ["Alpha"],
      text_en: "Telegram event",
      signal_score: 88,
      signal_grade: "A",
      signal_reasons: ["first", "multi-source"],
      sources: [{ link: "https://t.me/alpha/1" }],
    },
    preferences: prefs,
    alertPreferences: createDefaultSubscriberAlertPreferences(),
  });

  assert.deepEqual(
    alerts.map((alert) => alert.type).sort(),
    ["first_report_channel", "first_report_region", "high_signal_region"],
  );
});

test("osint alerts match watched regions and favorite sources only for high severity", () => {
  const prefs = createEmptySubscriberFeedPreferences();
  prefs.watchRegions = ["global"];
  prefs.favoriteSources = ["example-desk"];

  const alerts = matchOsintSubscriberAlerts({
    userId: "user-1",
    item: {
      title: "OSINT item",
      summary: "OSINT item summary",
      source: "Example Desk",
      url: "https://example.com/item",
      timestamp: "2026-03-09T12:00:00.000Z",
      region: "global",
      category: "news",
      severity: "high",
    },
    preferences: prefs,
    alertPreferences: createDefaultSubscriberAlertPreferences(),
  });

  assert.deepEqual(
    alerts.map((alert) => alert.type).sort(),
    ["high_signal_region", "high_signal_source"],
  );
});

test("sortSubscriberAlerts orders newest first then stronger scores", () => {
  const items = [
    {
      id: "older-high",
      type: "high_signal_region",
      sourceSurface: "osint",
      createdAt: "2026-03-09T11:00:00.000Z",
      readAt: null,
      title: "older-high",
      summary: "",
      link: "",
      sourceLabel: "",
      channelOrProvider: "",
      region: "",
      tags: [],
      signalScore: 95,
      rankReasons: [],
      matchedPreference: "global",
    },
    {
      id: "newer-low",
      type: "high_signal_region",
      sourceSurface: "telegram",
      createdAt: "2026-03-09T12:00:00.000Z",
      readAt: null,
      title: "newer-low",
      summary: "",
      link: "",
      sourceLabel: "",
      channelOrProvider: "",
      region: "",
      tags: [],
      signalScore: 60,
      rankReasons: [],
      matchedPreference: "global",
    },
  ] as const;

  assert.equal(sortSubscriberAlerts(items as never)[0]?.id, "newer-low");
});

test("alert preferences can suppress alert types and tighten Telegram high-signal grade", () => {
  const prefs = createEmptySubscriberFeedPreferences();
  prefs.watchRegions = ["ukraine"];
  const controls = normalizeSubscriberAlertPreferences({
    firstReportRegionEnabled: false,
    highSignalRegionEnabled: true,
    minimumTelegramHighSignalGrade: "A",
  });

  const alerts = matchTelegramSubscriberAlerts({
    userId: "user-1",
    event: {
      event_id: "evt-2",
      datetime: "2026-03-09T12:00:00.000Z",
      category: "ukraine",
      text_en: "Telegram event",
      signal_score: 82,
      signal_grade: "B",
      signal_reasons: ["first", "multi-source"],
    },
    preferences: prefs,
    alertPreferences: controls,
  });

  assert.deepEqual(alerts, []);
});

test("osint alert preferences can suppress region and source high-signal alerts", () => {
  const prefs = createEmptySubscriberFeedPreferences();
  prefs.watchRegions = ["global"];
  prefs.favoriteSources = ["example desk"];

  const controls = normalizeSubscriberAlertPreferences({
    highSignalRegionEnabled: false,
    highSignalSourceEnabled: false,
  });

  const alerts = matchOsintSubscriberAlerts({
    userId: "user-1",
    item: {
      title: "OSINT item",
      summary: "OSINT item summary",
      source: "Example Desk",
      url: "https://example.com/item",
      timestamp: "2026-03-09T12:00:00.000Z",
      region: "global",
      category: "news",
      severity: "high",
    },
    preferences: prefs,
    alertPreferences: controls,
  });

  assert.deepEqual(alerts, []);
});
