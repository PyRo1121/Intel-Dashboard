export type SubscriberFeedScope = "all" | "favorites" | "watched" | "telegram" | "osint";

export type SubscriberFeedPreferences = {
  favoriteChannels: string[];
  favoriteSources: string[];
  watchRegions: string[];
  watchTags: string[];
  watchCategories: string[];
  updatedAt?: string;
};

export type SubscriberFeedItem = {
  id: string;
  sourceSurface: "telegram" | "osint";
  timestamp: string;
  title: string;
  summary: string;
  link: string;
  sourceLabel: string;
  channelOrProvider: string;
  severity: string;
  region: string;
  tags: string[];
  signalScore: number;
  signalGrade?: string;
  rankReasons: string[];
  favoriteMatch: boolean;
  watchMatch: boolean;
  combinedScore: number;
};

export type SubscriberFeedResponse = {
  preferences: SubscriberFeedPreferences;
  items: SubscriberFeedItem[];
};
