export interface TelegramMedia {
  type: "video" | "photo";
  url: string;
  thumbnail?: string;
}

export interface TelegramMessage {
  text_original: string;
  text_en: string;
  image_text_en?: string;
  datetime: string;
  link: string;
  views: string;
  media: TelegramMedia[];
  has_video: boolean;
  has_photo: boolean;
  language: string;
}

export interface TelegramChannel {
  username: string;
  label: string;
  category: string;
  language: string;
  message_count: number;
  messages: TelegramMessage[];
}

export interface TelegramCanonicalEventSource {
  signature: string;
  channel: string;
  label: string;
  category: string;
  trust_tier?: "core" | "verified" | "watch";
  latency_tier?: "instant" | "fast" | "monitor";
  source_type?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisition_method?: "telegram_public";
  domain_tags?: string[];
  subscriber_value_score?: number;
  message_id: string;
  link: string;
  datetime: string;
  views: string;
}

export interface TelegramDedupeMeta {
  clusterKey: string;
  sourceCount: number;
  duplicateCount: number;
  sourceLabels: string[];
  categorySet: string[];
  sourceSignatures?: string[];
  domainTags?: string[];
  trustTier?: "core" | "verified" | "watch";
  latencyTier?: "instant" | "fast" | "monitor";
  sourceType?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisitionMethod?: "telegram_public";
  subscriberValueScore?: number;
  signalScore?: number;
  signalGrade?: "A" | "B" | "C" | "D";
  signalReasons?: string[];
  freshnessTier?: "breaking" | "fresh" | "watch";
  verificationState?: "verified" | "corroborated" | "single_source";
  rankScore?: number;
  firstReporterLabel?: string;
  firstReporterChannel?: string;
  firstReportedAt?: string;
  sources?: TelegramCanonicalEventSource[];
}

export interface TelegramCanonicalEvent {
  event_id: string;
  event_key: string;
  datetime: string;
  category: string;
  categories: string[];
  domain_tags?: string[];
  trust_tier?: "core" | "verified" | "watch";
  latency_tier?: "instant" | "fast" | "monitor";
  source_type?: "official" | "milblog" | "osint" | "analysis" | "journalism";
  acquisition_method?: "telegram_public";
  subscriber_value_score?: number;
  signal_score?: number;
  signal_grade?: "A" | "B" | "C" | "D";
  signal_reasons?: string[];
  freshness_tier?: "breaking" | "fresh" | "watch";
  verification_state?: "verified" | "corroborated" | "single_source";
  rank_score?: number;
  first_reporter_label?: string;
  first_reporter_channel?: string;
  first_reported_at?: string;
  source_count: number;
  duplicate_count: number;
  source_labels: string[];
  source_channels: string[];
  text_original: string;
  text_en: string;
  image_text_en?: string;
  language: string;
  media: TelegramMedia[];
  has_video: boolean;
  has_photo: boolean;
  sources: TelegramCanonicalEventSource[];
}

export interface TelegramEntry {
  category: string;
  channelLabel: string;
  channelUsername: string;
  message: TelegramMessage;
  dedupe?: TelegramDedupeMeta;
}

export interface TelegramData {
  timestamp: string;
  total_channels: number;
  channels_fetched: number;
  total_messages: number;
  canonical_total_messages?: number;
  canonical_events?: TelegramCanonicalEvent[];
  dedupe_stats?: {
    raw_messages: number;
    canonical_messages: number;
    duplicates_collapsed: number;
    feedback_overrides: number;
  };
  categories: Record<string, string>;
  channels: TelegramChannel[];
}

export type TelegramAgeWindow = "all" | "24h";
export type TelegramFeedMode = "deduped" | "raw" | "verified";

export type TelegramFilterGroup = {
  id: string;
  label: string;
  categories?: string[];
  predicate?: (entry: TelegramEntry) => boolean;
};
