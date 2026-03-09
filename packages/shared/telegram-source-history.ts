export type TelegramSourceHistoryWindow = "24h" | "7d" | "30d";

export type TelegramSourceHistorySource = {
  channel: string;
  label: string;
  category: string;
  trustTier: "core" | "verified" | "watch";
  latencyTier: "instant" | "fast" | "monitor";
};

export type TelegramSourceHistorySummary = {
  score: number;
  leadCount: number;
  duplicateCount: number;
  recentFirstReports: number;
  averageSignalScore: number;
  duplicateRate: number;
  topReasons: string[];
  lastSeenAt: string;
  verdict: "High-value first reporter" | "Reliable corroborator" | "Watch source";
};

export type TelegramSourceHistoryEvent = {
  eventId: string;
  datetime: string;
  title: string;
  signalScore: number;
  signalGrade?: string;
  rankReasons: string[];
  link: string;
};

export type TelegramSourceHistoryOwnerDiagnostics = {
  bestSourceScore: number;
  averageSourceScore: number;
  sourceCountSeen: number;
  leadWins: number;
  followOnCount: number;
  duplicatePenaltyCount: number;
  totalEvents: number;
};

export type TelegramSourceHistoryResponse = {
  window: TelegramSourceHistoryWindow;
  generatedAt: string;
  source: TelegramSourceHistorySource;
  summary: TelegramSourceHistorySummary;
  recentEvents: TelegramSourceHistoryEvent[];
  ownerDiagnostics?: TelegramSourceHistoryOwnerDiagnostics;
};

