export type SubscriberAlertType =
  | "first_report_region"
  | "high_signal_region"
  | "first_report_channel"
  | "high_signal_source";

export type SubscriberAlertState = "all" | "unread";
export type SubscriberTelegramHighSignalGrade = "A" | "B";

export type SubscriberAlertPreferences = {
  firstReportRegionEnabled: boolean;
  highSignalRegionEnabled: boolean;
  firstReportChannelEnabled: boolean;
  highSignalSourceEnabled: boolean;
  minimumTelegramHighSignalGrade: SubscriberTelegramHighSignalGrade;
  updatedAt?: string;
};

export type SubscriberAlertItem = {
  id: string;
  type: SubscriberAlertType;
  sourceSurface: "telegram" | "osint";
  createdAt: string;
  readAt?: string | null;
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
  matchedPreference: string;
};

export type SubscriberAlertsDegradedState = {
  materializationFailed: boolean;
  message: string;
};

export type SubscriberAlertsResponse = {
  unreadCount: number;
  items: SubscriberAlertItem[];
  degraded?: SubscriberAlertsDegradedState;
};

export type SubscriberAlertsQuery = {
  state: SubscriberAlertState;
  limit?: number;
};

export type SubscriberAlertsReadRequest = {
  alertIds: string[];
};

export type SubscriberAlertsMutationResponse = {
  ok: true;
};
