import { OSINT_SOURCE_CATALOG, type OsintSource } from "./osint-sources.js";
import { buildAbsoluteAuthProviderUrl } from "@intel-dashboard/shared/auth-flow.ts";
import { FREE_FEED_DELAY_MINUTES, PREMIUM_PRICE_USD, TRIAL_DAYS, formatUsdMonthlyCompact, formatUsdMonthlySpaced } from "@intel-dashboard/shared/access-offers.ts";
import { BACKEND_LANDING_HERO, BACKEND_OPERATOR_CARDS, BACKEND_OPERATOR_PANEL, BACKEND_OPERATOR_PRICING } from "@intel-dashboard/shared/landing-content.ts";
import { INTERNAL_LANDING_TAGLINE, SITE_NAME } from "@intel-dashboard/shared/site-config.ts";
import { matchesBearerToken } from "./token-auth.js";

const DEFAULT_ENDPOINT_PATH = "/api/intel-dashboard/usage-data-source";
const DEFAULT_NEWS_ENDPOINT_PATH = "/api/intel-dashboard/news";
const DEFAULT_NEWS_PUBLISH_PATH = "/api/intel-dashboard/news/publish";
const DEFAULT_BILLING_STATUS_PATH = "/api/intel-dashboard/billing/status";
const DEFAULT_BILLING_START_TRIAL_PATH = "/api/intel-dashboard/billing/start-trial";
const DEFAULT_BILLING_SUBSCRIBE_PATH = "/api/intel-dashboard/billing/subscribe";
const DEFAULT_BILLING_CHECKOUT_PATH = "/api/intel-dashboard/billing/checkout";
const DEFAULT_BILLING_PORTAL_PATH = "/api/intel-dashboard/billing/portal";
const DEFAULT_BILLING_ACTIVITY_PATH = "/api/intel-dashboard/billing/activity";
const DEFAULT_BILLING_WEBHOOK_PATH = "/api/intel-dashboard/billing/webhook";
const DEFAULT_FEATURE_GATES_PATH = "/api/intel-dashboard/feature-gates";
const DEFAULT_USER_INFO_PATH = "/api/intel-dashboard/user-info";
const DEFAULT_ADMIN_CRM_SUMMARY_PATH = "/api/intel-dashboard/admin/crm/summary";
const DEFAULT_ADMIN_CRM_AI_TELEMETRY_PATH = "/api/intel-dashboard/admin/crm/ai-telemetry";
const DEFAULT_ADMIN_CRM_CUSTOMER_PATH = "/api/intel-dashboard/admin/crm/customer";
const DEFAULT_ADMIN_CRM_CANCEL_SUBSCRIPTION_PATH = "/api/intel-dashboard/admin/crm/cancel-subscription";
const DEFAULT_ADMIN_CRM_REFUND_PATH = "/api/intel-dashboard/admin/crm/refund";
const DEFAULT_SOURCES_PATH = "/api/intel-dashboard/sources";
const DEFAULT_AI_JOBS_PATH = "/api/intel-dashboard/ai/jobs";
const DEFAULT_OUTBOUND_PUBLISH_PATH = "/api/intel-dashboard/outbound/publish";
const DEFAULT_LANDING_PATH = "/";
const DEFAULT_LANDING_BRAND_NAME = SITE_NAME;
const DEFAULT_LANDING_TAGLINE = INTERNAL_LANDING_TAGLINE;
const DEFAULT_BACKEND_TIMEOUT_MS = 10_000;
const MAX_BACKEND_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_POINTS = 200;
const DEFAULT_LOG_LIMIT = 200;
const MAX_BOUNDED_LIMIT = 1000;
const DEFAULT_STORAGE_MODE = "backend";
const DEFAULT_KV_PREFIX = "intel-dashboard:usage";
const DEFAULT_SEED_PATH_SUFFIX = "/seed";
const MAX_SEED_ENTRIES = 500;
const MAX_SEED_VALUE_BYTES = 512_000;
const MIN_SEED_TTL_SECONDS = 60;
const MAX_SEED_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MAX_REQUEST_BYTES = 1_048_576;
const MIN_MAX_REQUEST_BYTES = 1_024;
const MAX_MAX_REQUEST_BYTES = 10_485_760;
const DEFAULT_CACHE_TTL_SECONDS = 30;
const MAX_CACHE_TTL_SECONDS = 86_400;
const DEFAULT_BACKEND_MAX_RETRIES = 1;
const MAX_BACKEND_RETRIES = 3;
const DEFAULT_SEED_ASYNC_BATCH_SIZE = 100;
const MAX_SEED_ASYNC_BATCH_SIZE = 100;
const DEFAULT_ANALYTICS_SAMPLE_RATE = 1;
const DEFAULT_CACHE_WARM_WINDOWS_DAYS = [1, 7, 30] as const;
const DEFAULT_CACHE_WARM_ENABLED = true;
const DEFAULT_NEWS_DELAY_MINUTES = FREE_FEED_DELAY_MINUTES;
const DEFAULT_TRIAL_DAYS = TRIAL_DAYS;
const DEFAULT_MONTHLY_PRICE_USD = PREMIUM_PRICE_USD;
const DEFAULT_NEWS_LIMIT = 50;
const MAX_NEWS_LIMIT = 200;
const MAX_NEWS_ENTRIES = 500;
const DEFAULT_OUTBOUND_DEDUPE_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_WEBHOOK_PROCESSING_LEASE_SECONDS = 5 * 60;
const MAX_OUTBOUND_TARGETS = 20;
const DEFAULT_OUTBOUND_DELIVERY_TIMEOUT_MS = 10_000;
const DEFAULT_FREE_RATE_LIMIT_PER_MINUTE = 60;
const DEFAULT_TRIAL_RATE_LIMIT_PER_MINUTE = 180;
const DEFAULT_SUBSCRIBER_RATE_LIMIT_PER_MINUTE = 600;
const MAX_RATE_LIMIT_PER_MINUTE = 5_000;
const DEFAULT_FREE_NEWS_MAX_ITEMS = 50;
const DEFAULT_TRIAL_NEWS_MAX_ITEMS = 100;
const DEFAULT_SUBSCRIBER_NEWS_MAX_ITEMS = 200;
const MAX_TIER_NEWS_MAX_ITEMS = 500;
const DEFAULT_BILLING_ACTIVITY_HISTORY_LIMIT = 80;
const MAX_BILLING_ACTIVITY_HISTORY_LIMIT = 250;
const DEFAULT_NEWS_FEED_MAX_ITEMS = 3000;
const MAX_NEWS_FEED_MAX_ITEMS = 10000;
const DEFAULT_NEWS_READ_CACHE_MS = 200;
const MAX_NEWS_READ_CACHE_MS = 5000;
const DEFAULT_NEWS_COORDINATOR_ENABLED = true;
const DEFAULT_NEWS_COORDINATOR_NAME = "global";
const DEFAULT_NEWS_COORDINATOR_SHARD_COUNT = 1;
const MAX_NEWS_COORDINATOR_SHARD_COUNT = 64;
const DEFAULT_NEWS_COORDINATOR_ALLOW_FALLBACK = true;
const DEFAULT_NEWS_HOT_OVERLAY_ENABLED = true;
const DEFAULT_NEWS_HOT_OVERLAY_LIMIT = 250;
const MAX_NEWS_HOT_OVERLAY_LIMIT = 1000;
const DEFAULT_NEWS_HOT_OVERLAY_SHARD_FANOUT = 1;
const DEFAULT_NEWS_HOT_OVERLAY_TIMEOUT_MS = 350;
const MAX_NEWS_HOT_OVERLAY_TIMEOUT_MS = 5000;
const DEFAULT_NEWS_HOT_OVERLAY_CACHE_MS = 750;
const MAX_NEWS_HOT_OVERLAY_CACHE_MS = 10_000;
const DEFAULT_OUTBOUND_ASYNC = true;
const DEFAULT_STRIPE_API_BASE = "https://api.stripe.com";
const DEFAULT_CRM_STRIPE_LIVE_ENABLED = true;
const DEFAULT_CRM_STRIPE_SYNC_TIMEOUT_MS = 8_000;
const MAX_CRM_STRIPE_SYNC_TIMEOUT_MS = 30_000;
const DEFAULT_CRM_STRIPE_MAX_SUBSCRIPTIONS = 5_000;
const MAX_CRM_STRIPE_MAX_SUBSCRIPTIONS = 25_000;
const DEFAULT_CRM_STRIPE_CACHE_TTL_SECONDS = 5 * 60;
const MAX_CRM_STRIPE_CACHE_TTL_SECONDS = 24 * 60 * 60;
const DEFAULT_CRM_CUSTOMER_CACHE_TTL_SECONDS = 60;
const MAX_CRM_CUSTOMER_CACHE_TTL_SECONDS = 15 * 60;
const DEFAULT_AI_GATEWAY_TIMEOUT_MS = 3_000;
const DEFAULT_AI_GATEWAY_MODEL = "cerebras/gpt-oss-120b";
const DEFAULT_AI_GATEWAY_MEDIA_MODEL = "groq/meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_AI_GATEWAY_ESCALATION_MODEL = "cerebras/zai-glm-4.7";
const DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS = 600;
const MAX_AI_GATEWAY_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_AI_GATEWAY_CACHE_TTL_DEDUPE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_AI_GATEWAY_CACHE_TTL_TRANSLATE_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_AI_GATEWAY_CACHE_TTL_CLASSIFY_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_AI_GATEWAY_CACHE_TTL_NEWS_ENRICH_SECONDS = 24 * 60 * 60;
const DEFAULT_AI_GATEWAY_CACHE_TTL_BRIEFING_SECONDS = 6 * 60 * 60;
const DEFAULT_AI_GATEWAY_MAX_ATTEMPTS = 1;
const MAX_AI_GATEWAY_MAX_ATTEMPTS = 5;
const DEFAULT_AI_GATEWAY_RETRY_DELAY_MS = 250;
const MAX_AI_GATEWAY_RETRY_DELAY_MS = 5_000;
const DEFAULT_AI_GATEWAY_BACKOFF = "exponential";
const DEFAULT_AI_GATEWAY_COLLECT_LOG = false;
const DEFAULT_AI_DEDUPE_ESCALATION_ENABLED = true;
const DEFAULT_AI_DEDUPE_MEDIA_MAX_IMAGES = 3;
const MAX_AI_DEDUPE_MEDIA_MAX_IMAGES = 6;
const DEFAULT_AI_PIPELINE_MAX_CONNECTIONS = 10;
const MAX_AI_PIPELINE_MAX_CONNECTIONS = 20;
const DEFAULT_AI_BATCH_MAX_JOBS = 1000;
const MAX_AI_BATCH_MAX_JOBS = 5000;
const DEFAULT_AI_BATCH_NAMESPACE_PREFIX = "intel-dashboard:ai-batch";
const DEFAULT_AI_BATCH_STATUS_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_AI_BATCH_POLL_DELAY_SECONDS = 60;
const MAX_AI_BATCH_POLL_DELAY_SECONDS = 24 * 60 * 60;
const DEFAULT_AI_BATCH_MAX_POLL_ATTEMPTS = 120;
const DEFAULT_AI_BATCH_PROVIDER = "internal";
const DEFAULT_GROQ_API_BASE_URL = "https://api.groq.com";
const DEFAULT_GROQ_BATCH_COMPLETION_WINDOW = "24h";
const DEFAULT_AI_BATCH_RECOVERY_STALE_SECONDS = 300;
const MAX_AI_BATCH_SWEEP_KEYS = 250;
const DEFAULT_OWNER_USER_IDS = "";
const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NEWS_AI_ENRICH_ENABLED = true;
const DEFAULT_NEWS_AI_ENRICH_MAX_ITEMS = 120;
const MAX_NEWS_AI_ENRICH_MAX_ITEMS = 500;
const DEFAULT_NEWS_AI_ENRICH_CONNECTIONS = 8;
const MAX_NEWS_AI_ENRICH_CONNECTIONS = 20;
const DEFAULT_PUBLIC_INTEL_LIMIT = 250;
const MAX_PUBLIC_INTEL_LIMIT = 1000;
const DEFAULT_PUBLIC_FEED_ROUTES_ENABLED = false;
const DEFAULT_AIRSEA_OPENSKY_ENABLED = true;
const DEFAULT_AIRSEA_OPENSKY_URL = "https://opensky-network.org/api/states/all";
const DEFAULT_AIRSEA_OPENSKY_TIMEOUT_MS = 8_000;
const MAX_AIRSEA_OPENSKY_TIMEOUT_MS = 20_000;
const DEFAULT_AIRSEA_AVIATION_REFRESH_SECONDS = 120;
const MAX_AIRSEA_AVIATION_REFRESH_SECONDS = 3_600;
const DEFAULT_AIRSEA_AVIATION_STALE_SECONDS = 12 * 60 * 60;
const MAX_AIRSEA_AVIATION_STALE_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_AIRSEA_AVIATION_MAX_TRACKS = 120;
const MAX_AIRSEA_AVIATION_MAX_TRACKS = 500;
const DEFAULT_BRIEFING_WINDOW_HOURS = 4;
const DEFAULT_BRIEFING_MAX_WINDOWS = 6;
const MAX_BRIEFING_MAX_WINDOWS = 12;
const DEFAULT_BRIEFING_AI_WINDOWS = 1;
const MAX_BRIEFING_AI_WINDOWS = 3;
const DEFAULT_NEWS_RSS_INGEST_ENABLED = true;
const DEFAULT_NEWS_RSS_SOURCES_PER_RUN = 12;
const MAX_NEWS_RSS_SOURCES_PER_RUN = 36;
const DEFAULT_NEWS_RSS_ITEMS_PER_SOURCE = 10;
const MAX_NEWS_RSS_ITEMS_PER_SOURCE = 20;
const DEFAULT_NEWS_RSS_ROTATION_WINDOW_SECONDS = 60;
const MIN_NEWS_RSS_ROTATION_WINDOW_SECONDS = 30;
const MAX_NEWS_RSS_ROTATION_WINDOW_SECONDS = 3_600;
const DEFAULT_NEWS_RSS_VALIDATOR_TTL_SECONDS = 14 * 24 * 60 * 60;
const MAX_NEWS_RSS_VALIDATOR_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_FREE_TIER_MODE = true;
const FREE_TIER_HARD_MAX_NEWS_RSS_SOURCES_PER_RUN = 20;
const FREE_TIER_HARD_MAX_NEWS_RSS_ITEMS_PER_SOURCE = 12;
const NEWS_RSS_MAX_ITEM_AGE_HOURS = 72;
const NEWS_RSS_SUMMARY_MAX_CHARS = 360;
const NEWS_FEED_RETENTION_HOURS = 168;
const PRIORITY_RSS_SOURCE_IDS = new Set([
  "aljazeera-world",
  "bbc-world",
  "cnn-world",
  "defense-news",
  "defense-one",
  "defence-blog",
  "dw-world",
  "euronews-world",
  "guardian-world",
  "insider-paper",
  "npr-world",
  "the-hindu-international",
  "war-on-the-rocks",
]);

const RPC_METHODS = [
  "sessionExists",
  "discoverSessionsForRange",
  "loadCostUsageSummary",
  "loadSessionCostSummary",
  "loadSessionUsageTimeSeries",
  "loadSessionLogs",
] as const;

type RpcMethod = (typeof RPC_METHODS)[number];

type KvLike = {
  get(key: string): Promise<string | null>;
  put?(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  list?(options?: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{
    keys: Array<{ name: string }>;
    list_complete?: boolean;
    cursor?: string;
  }>;
};

type QueueBatchLike = {
  messages: Array<{
    body: unknown;
    ack?: () => void;
    retry?: () => void;
  }>;
};

type SeedQueueProducerLike = {
  sendBatch(messages: Array<{ body: unknown }>): Promise<void>;
};

type QueueProducerLike = {
  send(body: unknown, options?: { delaySeconds?: number }): Promise<void>;
};

type AnalyticsEngineLike = {
  writeDataPoint(point: {
    blobs?: string[];
    doubles?: number[];
    indexes?: string[];
  }): void;
};

type RateLimitBindingLike = {
  limit(args: { key: string }): Promise<{ success: boolean }>;
};

type BillingStatus = "none" | "trialing" | "active" | "expired" | "canceled";

type BillingAccount = {
  userId: string;
  status: BillingStatus;
  trialStartedAtMs?: number;
  trialEndsAtMs?: number;
  subscribedAtMs?: number;
  canceledAtMs?: number;
  lastStripeEventCreatedSec?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  monthlyPriceUsd: number;
  updatedAtMs: number;
};

type BillingActivityEvent = {
  id: string;
  userId: string;
  atMs: number;
  kind: string;
  source: "api" | "stripe";
  status?: BillingStatus | "owner";
  stripeEventId?: string;
  stripeEventType?: string;
  note?: string;
};

type WebhookDedupeAction = "reserve" | "complete" | "release";

type WebhookDedupeState = {
  state: "processing" | "completed";
  updatedAtMs: number;
  expiresAtMs: number;
};

type CrmAccountSnapshot = {
  userId: string;
  status: BillingStatus;
  monthlyPriceUsd: number;
  updatedAtMs: number;
  trialEndsAtMs?: number;
};

type CrmTelemetrySummary = {
  events24h: number;
  events7d: number;
  uniqueUsers24h: number;
  uniqueUsers7d: number;
  trialStarts7d: number;
  paidStarts7d: number;
  cancellations7d: number;
  cancellations30d: number;
  topKinds7d: Array<{ kind: string; count: number }>;
};

type CrmCustomerStripeSnapshot = {
  fetchedAtMs: number;
  accountUpdatedAtMs: number;
  stripe: {
    customer: {
      id: string;
      email: string | null;
      name: string | null;
      currency: string;
      delinquent: boolean;
      createdAtMs: number | null;
      balanceUsd: number;
    };
    subscription: {
      id: string | null;
      status: string | null;
      cancelAtPeriodEnd: boolean;
      cancelAtMs: number | null;
      currentPeriodEndMs: number | null;
      canceledAtMs: number | null;
    } | null;
    invoices: Array<{
      id: string;
      status: string;
      amountDueUsd: number;
      amountPaidUsd: number;
      paid: boolean;
      createdAtMs: number;
      hostedInvoiceUrl: string | null;
      invoicePdf: string | null;
    }>;
    charges: Array<{
      id: string;
      status: string;
      amountUsd: number;
      refundedUsd: number;
      paid: boolean;
      refunded: boolean;
      createdAtMs: number;
      receiptUrl: string | null;
      paymentIntentId: string | null;
    }>;
  };
};

type StripeCrmStatusCounts = {
  active: number;
  trialing: number;
  pastDue: number;
  unpaid: number;
  canceled: number;
  incomplete: number;
  incompleteExpired: number;
  paused: number;
  other: number;
};

type StripeCrmLiveSummary = {
  live: true;
  source: "stripe_live" | "stripe_cache";
  syncedAtMs: number;
  subscriptionsTotal: number;
  customersTotal: number;
  statuses: StripeCrmStatusCounts;
  mrrActiveUsd: number;
  mrrBillableUsd: number;
  arrActiveUsd: number;
  arrBillableUsd: number;
  currencies: Array<{ currency: string; mrrMonthly: number }>;
  apiBase: string;
};

type StripeCrmLiveFallback = {
  live: false;
  source: "internal_snapshot" | "stripe_cache_stale";
  syncedAtMs: number;
  error: string;
};

type IntelSeverity = "critical" | "high" | "medium" | "low";
type IntelRegion =
  | "middle_east"
  | "ukraine"
  | "europe"
  | "pacific"
  | "africa"
  | "east_asia"
  | "central_america"
  | "military"
  | "global"
  | "us";
type IntelCategory = "news" | "conflict" | "notam" | "military_movement";

type NewsItem = {
  id: string;
  title: string;
  url: string;
  publishedAtMs: number;
  summary?: string;
  source?: string;
  severity?: IntelSeverity;
  region?: IntelRegion;
  category?: IntelCategory;
  language?: string;
  translatedFrom?: string;
  priorityScore?: number;
  classificationConfidence?: number;
};

type PublicIntelItem = {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: IntelRegion | "";
  category: IntelCategory | "";
  severity: IntelSeverity | "";
};

type PublicBriefing = {
  id: string;
  timestamp: string;
  content: string;
  severity_summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
};

type PublicAirSeaIntelReport = {
  id: string;
  domain: "air" | "sea";
  category: string;
  channel: string;
  channelUsername: string;
  text: string;
  datetime: string;
  link: string;
  views: string;
  severity: IntelSeverity;
  region: IntelRegion;
  tags: string[];
  media: Array<{ type: string; url: string; thumbnail?: string }>;
};

type PublicAirSeaPayload = {
  timestamp: string;
  aviation: {
    timestamp: string;
    source: string;
    emergencies: number;
    aircraft: Array<Record<string, unknown>>;
  };
  intelFeed: PublicAirSeaIntelReport[];
  stats: {
    aircraftCount: number;
    airIntelCount: number;
    seaIntelCount: number;
    totalIntel: number;
    critical: number;
    high: number;
  };
};

type OutboundTarget = {
  channel: string;
  endpointUrl: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
};

type OutboundPublishPayload = {
  targets: OutboundTarget[];
  dedupeScope: string;
  dedupeTtlSeconds: number;
};

type EntitlementTier = "subscriber" | "trial" | "free";

type TierPolicy = {
  tier: EntitlementTier;
  rateLimitPerMinute: number;
  maxNewsItems: number;
};

type TierPolicies = {
  free: TierPolicy;
  trial: TierPolicy;
  subscriber: TierPolicy;
};

type NewsFeedCacheEntry = {
  cachedAtMs: number;
  items: NewsItem[];
};

type AirSeaAviationSnapshot = {
  timestamp: string;
  source: string;
  emergencies: number;
  aircraft: Array<Record<string, unknown>>;
  fetchedAtMs: number;
};

type RssSourceValidatorState = {
  etag?: string;
  lastModified?: string;
  checkedAtMs: number;
};

type NewsPublishMergeResult = {
  published: number;
  totalStored: number;
  merged: boolean;
};

type AiBatchProvider = "internal" | "groq";

type AiBatchStatus = "queued" | "running" | "submitted" | "polling" | "completed" | "failed";

type AiBatchJobResult = {
  index: number;
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

type AiBatchState = {
  id: string;
  status: AiBatchStatus;
  createdAtMs: number;
  updatedAtMs: number;
  provider: AiBatchProvider;
  jobs: AiJobRequest[];
  maxConnections: number;
  pollAttempts: number;
  externalBatchId?: string;
  outputFileId?: string;
  results?: AiBatchJobResult[];
  error?: string;
};

type AiBatchStateMeta = {
  id: string;
  status: AiBatchStatus;
  createdAtMs: number;
  updatedAtMs: number;
  provider: AiBatchProvider;
  maxConnections: number;
  pollAttempts: number;
  totalJobs: number;
  externalBatchId?: string;
  outputFileId?: string;
  results?: AiBatchJobResult[];
  error?: string;
};

type AiJobRequest =
  | {
      type: "dedupe";
      payload: unknown;
      channel?: string;
      preferEscalation?: boolean;
    }
  | {
      type: "translate";
      text: string;
      targetLanguage: string;
    }
  | {
      type: "classify";
      text: string;
      labels: string[];
    };

export type WorkerEnv = {
  USAGE_DATA_SOURCE_TOKEN?: string;
  USAGE_ADMIN_TOKEN?: string;
  AI_JOBS_ADMIN_TOKEN?: string;
  USAGE_ENDPOINT_PATH?: string;
  USAGE_SEED_ENDPOINT_PATH?: string;
  USAGE_STORAGE_MODE?: string;
  USAGE_KV_PREFIX?: string;
  USAGE_KV_SEED_TTL_SECONDS?: string;
  USAGE_KV?: KvLike;
  USAGE_BACKEND_BASE_URL?: string;
  USAGE_BACKEND_PATH?: string;
  USAGE_BACKEND_TIMEOUT_MS?: string;
  USAGE_BACKEND_TOKEN?: string;
  USAGE_MAX_REQUEST_BYTES?: string;
  USAGE_CACHE_TTL_SECONDS?: string;
  USAGE_CACHE_NAMESPACE?: string;
  USAGE_BACKEND_MAX_RETRIES?: string;
  USAGE_SEED_ASYNC?: string;
  USAGE_SEED_ASYNC_BATCH_SIZE?: string;
  USAGE_ANALYTICS_SAMPLE_RATE?: string;
  USAGE_SEED_QUEUE?: SeedQueueProducerLike;
  USAGE_ANALYTICS?: AnalyticsEngineLike;
  AI_TELEMETRY_SAMPLE_RATE?: string;
  AI_TELEMETRY?: AnalyticsEngineLike;
  USAGE_CACHE_WARM_ENABLED?: string;
  USAGE_CACHE_WARM_WINDOWS_DAYS?: string;
  NEWS_ENDPOINT_PATH?: string;
  NEWS_PUBLISH_PATH?: string;
  BILLING_STATUS_PATH?: string;
  BILLING_START_TRIAL_PATH?: string;
  BILLING_SUBSCRIBE_PATH?: string;
  BILLING_CHECKOUT_PATH?: string;
  BILLING_PORTAL_PATH?: string;
  BILLING_ACTIVITY_PATH?: string;
  BILLING_WEBHOOK_PATH?: string;
  FEATURE_GATES_PATH?: string;
  USER_INFO_PATH?: string;
  ADMIN_CRM_SUMMARY_PATH?: string;
  ADMIN_CRM_AI_TELEMETRY_PATH?: string;
  ADMIN_CRM_CUSTOMER_PATH?: string;
  ADMIN_CRM_CANCEL_SUBSCRIPTION_PATH?: string;
  ADMIN_CRM_REFUND_PATH?: string;
  AI_TELEMETRY_QUERY_ACCOUNT_ID?: string;
  AI_TELEMETRY_QUERY_API_TOKEN?: string;
  AI_TELEMETRY_DATASET?: string;
  LANDING_PATH?: string;
  LANDING_BRAND_NAME?: string;
  LANDING_TAGLINE?: string;
  X_AUTH_LOGIN_URL?: string;
  SOURCES_PATH?: string;
  AI_JOBS_PATH?: string;
  OUTBOUND_PUBLISH_PATH?: string;
  BILLING_ADMIN_TOKEN?: string;
  NEWS_DELAY_MINUTES?: string;
  BILLING_TRIAL_DAYS?: string;
  BILLING_MONTHLY_PRICE_USD?: string;
  BILLING_ACTIVITY_HISTORY_LIMIT?: string;
  NEWS_FEED_KEY?: string;
  BILLING_NAMESPACE_PREFIX?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_ID?: string;
  STRIPE_SUCCESS_URL?: string;
  STRIPE_CANCEL_URL?: string;
  STRIPE_PORTAL_RETURN_URL?: string;
  STRIPE_API_BASE_URL?: string;
  CRM_STRIPE_LIVE_ENABLED?: string;
  CRM_STRIPE_SYNC_TIMEOUT_MS?: string;
  CRM_STRIPE_MAX_SUBSCRIPTIONS?: string;
  CRM_STRIPE_CACHE_TTL_SECONDS?: string;
  CRM_CUSTOMER_CACHE_TTL_SECONDS?: string;
  OUTBOUND_NAMESPACE_PREFIX?: string;
  OUTBOUND_DEDUPE_TTL_SECONDS?: string;
  OUTBOUND_DELIVERY_TIMEOUT_MS?: string;
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_TOKEN?: string;
  AI_GATEWAY_MODEL?: string;
  AI_GATEWAY_TEXT_URL?: string;
  AI_GATEWAY_TEXT_MODEL?: string;
  AI_GATEWAY_MEDIA_URL?: string;
  AI_GATEWAY_MEDIA_MODEL?: string;
  AI_GATEWAY_ESCALATION_URL?: string;
  AI_GATEWAY_ESCALATION_MODEL?: string;
  AI_GATEWAY_TIMEOUT_MS?: string;
  AI_GATEWAY_CACHE_TTL_SECONDS?: string;
  AI_GATEWAY_CACHE_TTL_DEDUPE_SECONDS?: string;
  AI_GATEWAY_CACHE_TTL_TRANSLATE_SECONDS?: string;
  AI_GATEWAY_CACHE_TTL_CLASSIFY_SECONDS?: string;
  AI_GATEWAY_CACHE_TTL_NEWS_ENRICH_SECONDS?: string;
  AI_GATEWAY_CACHE_TTL_BRIEFING_SECONDS?: string;
  AI_GATEWAY_MAX_ATTEMPTS?: string;
  AI_GATEWAY_RETRY_DELAY_MS?: string;
  AI_GATEWAY_BACKOFF?: string;
  AI_GATEWAY_COLLECT_LOG?: string;
  AI_DEDUPE_ESCALATION_ENABLED?: string;
  AI_DEDUPE_MEDIA_MAX_IMAGES?: string;
  AI_PIPELINE_MAX_CONNECTIONS?: string;
  NEWS_AI_ENRICH_ENABLED?: string;
  NEWS_AI_ENRICH_MAX_ITEMS?: string;
  NEWS_AI_ENRICH_CONNECTIONS?: string;
  PUBLIC_FEED_ROUTES_ENABLED?: string;
  PUBLIC_INTEL_LIMIT?: string;
  AIRSEA_OPENSKY_ENABLED?: string;
  AIRSEA_OPENSKY_URL?: string;
  AIRSEA_OPENSKY_USERNAME?: string;
  AIRSEA_OPENSKY_PASSWORD?: string;
  AIRSEA_OPENSKY_TIMEOUT_MS?: string;
  AIRSEA_AVIATION_REFRESH_SECONDS?: string;
  AIRSEA_AVIATION_STALE_SECONDS?: string;
  AIRSEA_AVIATION_MAX_TRACKS?: string;
  BRIEFING_WINDOW_HOURS?: string;
  BRIEFING_MAX_WINDOWS?: string;
  BRIEFING_AI_WINDOWS?: string;
  NEWS_RSS_INGEST_ENABLED?: string;
  NEWS_RSS_SOURCES_PER_RUN?: string;
  NEWS_RSS_ITEMS_PER_SOURCE?: string;
  NEWS_RSS_ROTATION_WINDOW_SECONDS?: string;
  NEWS_RSS_VALIDATOR_TTL_SECONDS?: string;
  FREE_TIER_MODE?: string;
  AI_BATCH_MAX_JOBS?: string;
  AI_BATCH_PROVIDER?: string;
  AI_BATCH_NAMESPACE_PREFIX?: string;
  AI_BATCH_STATUS_TTL_SECONDS?: string;
  AI_BATCH_POLL_DELAY_SECONDS?: string;
  AI_BATCH_MAX_POLL_ATTEMPTS?: string;
  GROQ_API_KEY?: string;
  GROQ_API_BASE_URL?: string;
  GROQ_BATCH_COMPLETION_WINDOW?: string;
  OWNER_USER_IDS?: string;
  FREE_RATE_LIMIT_PER_MINUTE?: string;
  TRIAL_RATE_LIMIT_PER_MINUTE?: string;
  SUBSCRIBER_RATE_LIMIT_PER_MINUTE?: string;
  FREE_NEWS_MAX_ITEMS?: string;
  TRIAL_NEWS_MAX_ITEMS?: string;
  SUBSCRIBER_NEWS_MAX_ITEMS?: string;
  NEWS_FEED_MAX_ITEMS?: string;
  NEWS_READ_CACHE_MS?: string;
  NEWS_COORDINATOR_ENABLED?: string;
  NEWS_COORDINATOR_NAME?: string;
  NEWS_COORDINATOR_SHARD_COUNT?: string;
  NEWS_COORDINATOR_ALLOW_FALLBACK?: string;
  NEWS_HOT_OVERLAY_ENABLED?: string;
  NEWS_HOT_OVERLAY_LIMIT?: string;
  NEWS_HOT_OVERLAY_SHARD_FANOUT?: string;
  NEWS_HOT_OVERLAY_TIMEOUT_MS?: string;
  OUTBOUND_ASYNC?: string;
  BILLING_ALLOW_RETRIAL?: string;
  REQUIRE_SIGNED_USER_ID?: string;
  USER_ID_SIGNING_SECRET?: string;
  AI_JOB_QUEUE?: QueueProducerLike;
  NEWS_INGEST_COORDINATOR?: DurableObjectNamespace;
  FREE_TIER_RATE_LIMIT_BINDING?: RateLimitBindingLike;
  TRIAL_TIER_RATE_LIMIT_BINDING?: RateLimitBindingLike;
  SUBSCRIBER_TIER_RATE_LIMIT_BINDING?: RateLimitBindingLike;
};

type JsonRecord = Record<string, unknown>;

const newsFeedMemoryCache = new Map<string, NewsFeedCacheEntry>();
const newsFeedMergedMemoryCache = new Map<string, NewsFeedCacheEntry>();
const newsHotOverlayMemoryCache = new Map<string, NewsFeedCacheEntry>();
const kvBindingCacheIds = new WeakMap<object, string>();
let kvBindingCacheIdCounter = 0;

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object";
}

function parseFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeKvPrefix(rawValue: string | undefined): string {
  const raw = trimString(rawValue) ?? DEFAULT_KV_PREFIX;
  return raw.endsWith(":") ? raw.slice(0, -1) : raw;
}

function normalizePath(pathValue: string | undefined, fallback: string): string {
  const raw = trimString(pathValue) ?? fallback;
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function normalizeTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BACKEND_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 1, MAX_BACKEND_TIMEOUT_MS);
}

function normalizeStorageMode(rawValue: string | undefined): "backend" | "kv" {
  const raw = (trimString(rawValue) ?? DEFAULT_STORAGE_MODE).toLowerCase();
  return raw === "kv" ? "kv" : "backend";
}

function normalizeTtlSeconds(rawValue: unknown): number | undefined {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return undefined;
  }
  const normalized = Math.floor(parsed);
  if (normalized < 1) {
    return undefined;
  }
  return clamp(normalized, MIN_SEED_TTL_SECONDS, MAX_SEED_TTL_SECONDS);
}

function normalizeMaxRequestBytes(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_MAX_REQUEST_BYTES;
  }
  return clamp(Math.floor(parsed), MIN_MAX_REQUEST_BYTES, MAX_MAX_REQUEST_BYTES);
}

function normalizeCacheTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 0, MAX_CACHE_TTL_SECONDS);
}

function normalizeBackendMaxRetries(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BACKEND_MAX_RETRIES;
  }
  return clamp(Math.floor(parsed), 0, MAX_BACKEND_RETRIES);
}

function normalizeSeedAsyncBatchSize(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_SEED_ASYNC_BATCH_SIZE;
  }
  return clamp(Math.floor(parsed), 1, MAX_SEED_ASYNC_BATCH_SIZE);
}

function splitSeedEntries(entries: SeedEntry[], batchSize: number): SeedEntry[][] {
  if (entries.length === 0) {
    return [];
  }
  const output: SeedEntry[][] = [];
  for (let index = 0; index < entries.length; index += batchSize) {
    output.push(entries.slice(index, index + batchSize));
  }
  return output;
}

function normalizeBoolean(rawValue: unknown, fallback = false): boolean {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (typeof rawValue === "number") {
    return rawValue !== 0;
  }
  const value = trimString(rawValue);
  if (!value) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return fallback;
}

function normalizeSampleRate(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_ANALYTICS_SAMPLE_RATE;
  }
  if (parsed <= 0) {
    return 0;
  }
  return Math.min(1, parsed);
}

function parseWarmWindowsDays(rawValue: string | undefined): number[] {
  const fallback = [...DEFAULT_CACHE_WARM_WINDOWS_DAYS];
  const value = trimString(rawValue);
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((part) => parseFiniteNumber(part))
    .filter((part): part is number => part !== undefined)
    .map((part) => clamp(Math.floor(part), 1, 3650));

  if (parsed.length === 0) {
    return fallback;
  }

  const unique = Array.from(new Set(parsed));
  unique.sort((left, right) => left - right);
  return unique;
}

function normalizeNewsDelayMinutes(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_DELAY_MINUTES;
  }
  return clamp(Math.floor(parsed), 0, 24 * 60);
}

function normalizeTrialDays(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_TRIAL_DAYS;
  }
  return clamp(Math.floor(parsed), 1, 60);
}

function normalizeMonthlyPriceUsd(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_MONTHLY_PRICE_USD;
  }
  return Math.max(0, Number(parsed.toFixed(2)));
}

function isCrmStripeLiveEnabled(env: WorkerEnv): boolean {
  return normalizeBoolean(env.CRM_STRIPE_LIVE_ENABLED, DEFAULT_CRM_STRIPE_LIVE_ENABLED);
}

function normalizeCrmStripeSyncTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_CRM_STRIPE_SYNC_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 1_000, MAX_CRM_STRIPE_SYNC_TIMEOUT_MS);
}

function normalizeCrmStripeMaxSubscriptions(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_CRM_STRIPE_MAX_SUBSCRIPTIONS;
  }
  return clamp(Math.floor(parsed), 1, MAX_CRM_STRIPE_MAX_SUBSCRIPTIONS);
}

function normalizeCrmStripeCacheTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_CRM_STRIPE_CACHE_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 0, MAX_CRM_STRIPE_CACHE_TTL_SECONDS);
}

function normalizeCrmCustomerCacheTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_CRM_CUSTOMER_CACHE_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 0, MAX_CRM_CUSTOMER_CACHE_TTL_SECONDS);
}

function normalizeNewsLimit(rawValue: unknown): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_LIMIT;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_LIMIT);
}

function normalizeRateLimitPerMinute(rawValue: string | undefined, fallback: number): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return fallback;
  }
  return clamp(Math.floor(parsed), 1, MAX_RATE_LIMIT_PER_MINUTE);
}

function normalizeTierNewsMaxItems(rawValue: string | undefined, fallback: number): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return fallback;
  }
  return clamp(Math.floor(parsed), 1, MAX_TIER_NEWS_MAX_ITEMS);
}

function normalizeNewsFeedMaxItems(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_FEED_MAX_ITEMS;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_FEED_MAX_ITEMS);
}

function normalizeNewsReadCacheMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_READ_CACHE_MS;
  }
  return clamp(Math.floor(parsed), 0, MAX_NEWS_READ_CACHE_MS);
}

function normalizeNewsHotOverlayLimit(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_HOT_OVERLAY_LIMIT;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_HOT_OVERLAY_LIMIT);
}

function normalizeNewsHotOverlayTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_HOT_OVERLAY_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 50, MAX_NEWS_HOT_OVERLAY_TIMEOUT_MS);
}

function normalizeNewsHotOverlayCacheMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_HOT_OVERLAY_CACHE_MS;
  }
  return clamp(Math.floor(parsed), 0, MAX_NEWS_HOT_OVERLAY_CACHE_MS);
}

function resolveTierPolicies(env: WorkerEnv): TierPolicies {
  return {
    free: {
      tier: "free",
      rateLimitPerMinute: normalizeRateLimitPerMinute(env.FREE_RATE_LIMIT_PER_MINUTE, DEFAULT_FREE_RATE_LIMIT_PER_MINUTE),
      maxNewsItems: normalizeTierNewsMaxItems(env.FREE_NEWS_MAX_ITEMS, DEFAULT_FREE_NEWS_MAX_ITEMS),
    },
    trial: {
      tier: "trial",
      rateLimitPerMinute: normalizeRateLimitPerMinute(env.TRIAL_RATE_LIMIT_PER_MINUTE, DEFAULT_TRIAL_RATE_LIMIT_PER_MINUTE),
      maxNewsItems: normalizeTierNewsMaxItems(env.TRIAL_NEWS_MAX_ITEMS, DEFAULT_TRIAL_NEWS_MAX_ITEMS),
    },
    subscriber: {
      tier: "subscriber",
      rateLimitPerMinute: normalizeRateLimitPerMinute(
        env.SUBSCRIBER_RATE_LIMIT_PER_MINUTE,
        DEFAULT_SUBSCRIBER_RATE_LIMIT_PER_MINUTE,
      ),
      maxNewsItems: normalizeTierNewsMaxItems(env.SUBSCRIBER_NEWS_MAX_ITEMS, DEFAULT_SUBSCRIBER_NEWS_MAX_ITEMS),
    },
  };
}

function resolveTierPolicy(env: WorkerEnv, tier: EntitlementTier): TierPolicy {
  const policies = resolveTierPolicies(env);
  return policies[tier];
}

function normalizeBillingNamespacePrefix(rawValue: string | undefined): string {
  const raw = trimString(rawValue) ?? `${DEFAULT_KV_PREFIX}:billing`;
  return raw.endsWith(":") ? raw.slice(0, -1) : raw;
}

function normalizeOutboundNamespacePrefix(rawValue: string | undefined): string {
  const raw = trimString(rawValue) ?? `${DEFAULT_KV_PREFIX}:outbound`;
  return raw.endsWith(":") ? raw.slice(0, -1) : raw;
}

function resolveNewsCoordinatorName(rawValue: string | undefined): string {
  return trimString(rawValue) ?? DEFAULT_NEWS_COORDINATOR_NAME;
}

function normalizeNewsCoordinatorShardCount(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_COORDINATOR_SHARD_COUNT;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_COORDINATOR_SHARD_COUNT);
}

function normalizeNewsHotOverlayShardFanout(rawValue: string | undefined, shardCount: number): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return clamp(DEFAULT_NEWS_HOT_OVERLAY_SHARD_FANOUT, 1, shardCount);
  }
  return clamp(Math.floor(parsed), 1, shardCount);
}

function stableHash32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function deriveNewsShardKey(items: NewsItem[]): string {
  const first = items[0];
  if (!first) {
    return "default";
  }
  return first.source ?? first.url ?? first.title ?? first.id;
}

function resolveAllNewsCoordinatorShardNames(env: WorkerEnv): string[] {
  const baseName = resolveNewsCoordinatorName(env.NEWS_COORDINATOR_NAME);
  const shardCount = normalizeNewsCoordinatorShardCount(env.NEWS_COORDINATOR_SHARD_COUNT);
  if (shardCount <= 1) {
    return [baseName];
  }

  const names: string[] = [];
  for (let index = 0; index < shardCount; index += 1) {
    names.push(`${baseName}:${index}`);
  }
  return names;
}

function resolveNewsCoordinatorShardName(env: WorkerEnv, shardKey: string): string {
  const baseName = resolveNewsCoordinatorName(env.NEWS_COORDINATOR_NAME);
  const shardCount = normalizeNewsCoordinatorShardCount(env.NEWS_COORDINATOR_SHARD_COUNT);
  if (shardCount <= 1) {
    return baseName;
  }
  const shardIndex = stableHash32(shardKey) % shardCount;
  return `${baseName}:${shardIndex}`;
}

function resolveNewsCoordinatorShardNamesForOverlay(env: WorkerEnv): string[] {
  const allNames = resolveAllNewsCoordinatorShardNames(env);
  const fanout = normalizeNewsHotOverlayShardFanout(env.NEWS_HOT_OVERLAY_SHARD_FANOUT, allNames.length);
  if (fanout >= allNames.length) {
    return allNames;
  }

  const window = Math.floor(Date.now() / 30_000);
  const offset = stableHash32(String(window)) % allNames.length;
  const names: string[] = [];
  for (let index = 0; index < fanout; index += 1) {
    names.push(allNames[(offset + index) % allNames.length]);
  }
  return names;
}

function normalizeOutboundDedupeTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_OUTBOUND_DEDUPE_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 60, 30 * 24 * 60 * 60);
}

function normalizeDeliveryTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_OUTBOUND_DELIVERY_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 500, MAX_BACKEND_TIMEOUT_MS);
}

function normalizeAiGatewayTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_GATEWAY_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 250, MAX_BACKEND_TIMEOUT_MS);
}

function normalizeAiGatewayCacheTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_GATEWAY_CACHE_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 0, MAX_AI_GATEWAY_CACHE_TTL_SECONDS);
}

function resolveAiGatewayCacheTtlSeconds(rawValue: string | undefined, fallback: number): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return fallback;
  }
  return clamp(Math.floor(parsed), 0, MAX_AI_GATEWAY_CACHE_TTL_SECONDS);
}

function normalizeAiGatewayMaxAttempts(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_GATEWAY_MAX_ATTEMPTS;
  }
  return clamp(Math.floor(parsed), 1, MAX_AI_GATEWAY_MAX_ATTEMPTS);
}

function normalizeAiGatewayRetryDelayMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_GATEWAY_RETRY_DELAY_MS;
  }
  return clamp(Math.floor(parsed), 0, MAX_AI_GATEWAY_RETRY_DELAY_MS);
}

function normalizeAiGatewayBackoff(rawValue: string | undefined): "exponential" | "linear" {
  const normalized = (trimString(rawValue) ?? DEFAULT_AI_GATEWAY_BACKOFF).toLowerCase();
  if (normalized === "linear") return "linear";
  return "exponential";
}

function normalizeAiPipelineMaxConnections(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_PIPELINE_MAX_CONNECTIONS;
  }
  return clamp(Math.floor(parsed), 1, MAX_AI_PIPELINE_MAX_CONNECTIONS);
}

function normalizeNewsAiEnrichMaxItems(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_AI_ENRICH_MAX_ITEMS;
  }
  return clamp(Math.floor(parsed), 0, MAX_NEWS_AI_ENRICH_MAX_ITEMS);
}

function normalizeNewsAiEnrichConnections(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_AI_ENRICH_CONNECTIONS;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_AI_ENRICH_CONNECTIONS);
}

function normalizePublicIntelLimit(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_PUBLIC_INTEL_LIMIT;
  }
  return clamp(Math.floor(parsed), 1, MAX_PUBLIC_INTEL_LIMIT);
}

function isPublicFeedRoutesEnabled(env: WorkerEnv): boolean {
  return normalizeBoolean(env.PUBLIC_FEED_ROUTES_ENABLED, DEFAULT_PUBLIC_FEED_ROUTES_ENABLED);
}

function normalizeAirSeaOpenSkyTimeoutMs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AIRSEA_OPENSKY_TIMEOUT_MS;
  }
  return clamp(Math.floor(parsed), 1_000, MAX_AIRSEA_OPENSKY_TIMEOUT_MS);
}

function normalizeAirSeaAviationRefreshSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AIRSEA_AVIATION_REFRESH_SECONDS;
  }
  return clamp(Math.floor(parsed), 10, MAX_AIRSEA_AVIATION_REFRESH_SECONDS);
}

function normalizeAirSeaAviationStaleSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AIRSEA_AVIATION_STALE_SECONDS;
  }
  return clamp(Math.floor(parsed), 60, MAX_AIRSEA_AVIATION_STALE_SECONDS);
}

function normalizeAirSeaAviationMaxTracks(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AIRSEA_AVIATION_MAX_TRACKS;
  }
  return clamp(Math.floor(parsed), 1, MAX_AIRSEA_AVIATION_MAX_TRACKS);
}

function isInternalFeedProxyRequest(request: Request, env: WorkerEnv): boolean {
  if (request.headers.get("x-intel-internal-feed") !== "1") {
    return false;
  }
  const expectedToken = trimString(env.USAGE_DATA_SOURCE_TOKEN);
  if (!expectedToken) {
    return false;
  }
  const providedToken = parseBearerToken(request);
  return matchesBearerToken(providedToken, expectedToken);
}

function normalizeBriefingWindowHours(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BRIEFING_WINDOW_HOURS;
  }
  return clamp(Math.floor(parsed), 1, 24);
}

function normalizeBriefingMaxWindows(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BRIEFING_MAX_WINDOWS;
  }
  return clamp(Math.floor(parsed), 1, MAX_BRIEFING_MAX_WINDOWS);
}

function normalizeBriefingAiWindows(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BRIEFING_AI_WINDOWS;
  }
  return clamp(Math.floor(parsed), 0, MAX_BRIEFING_AI_WINDOWS);
}

function normalizeNewsRssSourcesPerRun(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_RSS_SOURCES_PER_RUN;
  }
  return clamp(Math.floor(parsed), 0, MAX_NEWS_RSS_SOURCES_PER_RUN);
}

function normalizeNewsRssItemsPerSource(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_RSS_ITEMS_PER_SOURCE;
  }
  return clamp(Math.floor(parsed), 1, MAX_NEWS_RSS_ITEMS_PER_SOURCE);
}

function normalizeNewsRssRotationWindowSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_RSS_ROTATION_WINDOW_SECONDS;
  }
  return clamp(
    Math.floor(parsed),
    MIN_NEWS_RSS_ROTATION_WINDOW_SECONDS,
    MAX_NEWS_RSS_ROTATION_WINDOW_SECONDS,
  );
}

function normalizeNewsRssValidatorTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_NEWS_RSS_VALIDATOR_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 300, MAX_NEWS_RSS_VALIDATOR_TTL_SECONDS);
}

function isFreeTierModeEnabled(env: WorkerEnv): boolean {
  return normalizeBoolean(env.FREE_TIER_MODE, DEFAULT_FREE_TIER_MODE);
}

function normalizeAiBatchMaxJobs(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_BATCH_MAX_JOBS;
  }
  return clamp(Math.floor(parsed), 1, MAX_AI_BATCH_MAX_JOBS);
}

function normalizeAiBatchStatusTtlSeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_BATCH_STATUS_TTL_SECONDS;
  }
  return clamp(Math.floor(parsed), 300, 30 * 24 * 60 * 60);
}

function normalizeAiBatchPollDelaySeconds(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_BATCH_POLL_DELAY_SECONDS;
  }
  return clamp(Math.floor(parsed), 5, MAX_AI_BATCH_POLL_DELAY_SECONDS);
}

function normalizeAiBatchMaxPollAttempts(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_BATCH_MAX_POLL_ATTEMPTS;
  }
  return clamp(Math.floor(parsed), 1, 10_000);
}

function normalizeAiBatchNamespacePrefix(rawValue: string | undefined): string {
  const value = trimString(rawValue) ?? DEFAULT_AI_BATCH_NAMESPACE_PREFIX;
  return value.endsWith(":") ? value.slice(0, -1) : value;
}

function normalizeAiBatchProvider(rawValue: string | undefined): AiBatchProvider {
  const provider = (trimString(rawValue) ?? DEFAULT_AI_BATCH_PROVIDER).toLowerCase();
  return provider === "groq" ? "groq" : "internal";
}

function normalizeAiDedupeMediaMaxImages(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_AI_DEDUPE_MEDIA_MAX_IMAGES;
  }
  return clamp(Math.floor(parsed), 1, MAX_AI_DEDUPE_MEDIA_MAX_IMAGES);
}

function resolveAiGatewayRouteConfig(args: {
  env: WorkerEnv;
  routeKind?: AiGatewayRouteKind;
  modelOverride?: string;
  urlOverride?: string;
}): AiGatewayRouteConfig | null {
  const routeKind = args.routeKind ?? "default";
  const url =
    trimString(args.urlOverride) ??
    (routeKind === "media"
      ? trimString(args.env.AI_GATEWAY_MEDIA_URL)
      : routeKind === "escalation"
        ? trimString(args.env.AI_GATEWAY_ESCALATION_URL)
        : routeKind === "text"
          ? trimString(args.env.AI_GATEWAY_TEXT_URL)
          : undefined) ??
    trimString(args.env.AI_GATEWAY_URL);
  if (!url) {
    return null;
  }

  const model =
    trimString(args.modelOverride) ??
    (routeKind === "media"
      ? trimString(args.env.AI_GATEWAY_MEDIA_MODEL)
      : routeKind === "escalation"
        ? trimString(args.env.AI_GATEWAY_ESCALATION_MODEL)
        : routeKind === "text"
          ? trimString(args.env.AI_GATEWAY_TEXT_MODEL)
          : undefined) ??
    trimString(args.env.AI_GATEWAY_MODEL) ??
    (routeKind === "media"
      ? DEFAULT_AI_GATEWAY_MEDIA_MODEL
      : routeKind === "escalation"
        ? DEFAULT_AI_GATEWAY_ESCALATION_MODEL
        : DEFAULT_AI_GATEWAY_MODEL);

  return {
    kind: routeKind,
    url,
    model,
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function looksLikeImageUrl(value: string): boolean {
  return /\.(?:avif|bmp|gif|heic|jpeg|jpg|png|svg|tiff|webp)(?:$|[?#])/i.test(value);
}

function pushUniqueMediaUrl(list: string[], value: unknown, maxItems: number, force = false): void {
  const candidate = trimString(value);
  if (!candidate || list.length >= maxItems || !isHttpUrl(candidate)) {
    return;
  }
  if (!force && !looksLikeImageUrl(candidate)) {
    return;
  }
  if (!list.includes(candidate)) {
    list.push(candidate);
  }
}

function extractMediaUrls(value: unknown, maxItems: number): string[] {
  const urls: string[] = [];
  const visited = new Set<unknown>();

  const walk = (input: unknown, hint = ""): void => {
    if (urls.length >= maxItems || input === null || input === undefined || visited.has(input)) {
      return;
    }
    if (typeof input === "object") {
      visited.add(input);
    }

    if (typeof input === "string") {
      const force = /(image|media|photo|thumbnail|screenshot|picture|attachment)/i.test(hint);
      pushUniqueMediaUrl(urls, input, maxItems, force);
      return;
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        walk(item, hint);
        if (urls.length >= maxItems) {
          return;
        }
      }
      return;
    }

    if (!isRecord(input)) {
      return;
    }

    const typeHint = trimString(input.type)?.toLowerCase() ?? "";
    const mediaLikeObject = /(image|photo|picture|screenshot|thumbnail)/i.test(typeHint);

    for (const [key, nested] of Object.entries(input)) {
      const childHint = hint ? `${hint}.${key}` : key;
      if (typeof nested === "string") {
        const force = mediaLikeObject || /(image|media|photo|thumbnail|screenshot|picture|attachment)/i.test(childHint);
        pushUniqueMediaUrl(urls, nested, maxItems, force);
      }
    }

    for (const [key, nested] of Object.entries(input)) {
      walk(nested, hint ? `${hint}.${key}` : key);
      if (urls.length >= maxItems) {
        return;
      }
    }
  };

  walk(value);
  return urls;
}

function resolveAiBatchStateKey(env: WorkerEnv, batchId: string): string {
  return `${normalizeAiBatchNamespacePrefix(env.AI_BATCH_NAMESPACE_PREFIX)}:state:${batchId}`;
}

function resolveAiBatchMetaKey(env: WorkerEnv, batchId: string): string {
  return `${normalizeAiBatchNamespacePrefix(env.AI_BATCH_NAMESPACE_PREFIX)}:meta:${batchId}`;
}

function resolveAiBatchIdempotencyKey(env: WorkerEnv, idempotencyKey: string): string {
  return `${normalizeAiBatchNamespacePrefix(env.AI_BATCH_NAMESPACE_PREFIX)}:idempotency:${idempotencyKey}`;
}

function buildBillingKey(env: WorkerEnv, userId: string): string {
  const prefix = normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX);
  return `${prefix}:account:${userId}`;
}

function buildBillingActivityKey(env: WorkerEnv, userId: string): string {
  const prefix = normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX);
  return `${prefix}:activity:${userId}`;
}

function normalizeBillingActivityHistoryLimit(rawValue: string | undefined): number {
  const parsed = parseFiniteNumber(rawValue);
  if (parsed === undefined) {
    return DEFAULT_BILLING_ACTIVITY_HISTORY_LIMIT;
  }
  return clamp(Math.floor(parsed), 10, MAX_BILLING_ACTIVITY_HISTORY_LIMIT);
}

function normalizeBillingActivityKind(value: unknown): string {
  const raw = (trimString(value) ?? "event").toLowerCase();
  const sanitized = raw.replaceAll(/[^a-z0-9._-]/g, "_");
  return sanitized.length > 0 ? sanitized.slice(0, 64) : "event";
}

function normalizeBillingActivityEvent(value: unknown, userId: string): BillingActivityEvent | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = trimString(value.id);
  const atMs = parseFiniteNumber(value.atMs);
  if (!id || atMs === undefined) {
    return null;
  }
  const sourceRaw = (trimString(value.source) ?? "api").toLowerCase();
  const source: BillingActivityEvent["source"] = sourceRaw === "stripe" ? "stripe" : "api";
  const statusRaw = trimString(value.status);
  const status = statusRaw === "owner" ? "owner" : normalizeBillingStatus(statusRaw);
  const normalizedStatus = status === "none" && statusRaw !== "none" ? undefined : status;
  const eventUserId = trimString(value.userId) ?? userId;
  const stripeEventId = trimString(value.stripeEventId);
  const stripeEventType = trimString(value.stripeEventType);
  const note = trimString(value.note);

  return {
    id,
    userId: eventUserId,
    atMs: Math.max(0, Math.floor(atMs)),
    kind: normalizeBillingActivityKind(value.kind),
    source,
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(stripeEventId ? { stripeEventId } : {}),
    ...(stripeEventType ? { stripeEventType } : {}),
    ...(note ? { note } : {}),
  };
}

function resolveNewsFeedKey(env: WorkerEnv): string {
  const configured = trimString(env.NEWS_FEED_KEY);
  if (configured) {
    return configured;
  }
  return `${normalizeKvPrefix(env.USAGE_KV_PREFIX)}:news:feed`;
}

function resolveNewsFeedStorageKey(env: WorkerEnv, shardName?: string): string {
  const baseKey = resolveNewsFeedKey(env);
  const shardCount = normalizeNewsCoordinatorShardCount(env.NEWS_COORDINATOR_SHARD_COUNT);
  const normalizedShard = trimString(shardName);
  if (shardCount <= 1 || !normalizedShard) {
    return baseKey;
  }

  return `${baseKey}:shard:${normalizedShard.replaceAll(":", "__")}`;
}

function resolveRssSourceValidatorKey(env: WorkerEnv, sourceId: string): string {
  return `${normalizeKvPrefix(env.USAGE_KV_PREFIX)}:news:rss:validator:${sourceId}`;
}

function resolveAirSeaAviationSnapshotKey(env: WorkerEnv): string {
  return `${normalizeKvPrefix(env.USAGE_KV_PREFIX)}:airsea:aviation:snapshot`;
}

async function loadRssSourceValidator(env: WorkerEnv, sourceId: string): Promise<RssSourceValidatorState | null> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return null;
  }
  const raw = await kv.get(resolveRssSourceValidatorKey(env, sourceId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    const etag = trimString(parsed.etag);
    const lastModified = trimString(parsed.lastModified);
    const checkedAtMs = parseFiniteNumber(parsed.checkedAtMs) ?? Date.now();
    return {
      ...(etag ? { etag } : {}),
      ...(lastModified ? { lastModified } : {}),
      checkedAtMs,
    };
  } catch {
    return null;
  }
}

async function storeRssSourceValidator(
  env: WorkerEnv,
  sourceId: string,
  state: RssSourceValidatorState,
  ttlSeconds: number,
): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    return;
  }
  try {
    await kv.put(resolveRssSourceValidatorKey(env, sourceId), JSON.stringify(state), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    // best-effort validator cache write
  }
}

function resolveNewsFeedStorageKeysForRead(env: WorkerEnv): string[] {
  const baseKey = resolveNewsFeedStorageKey(env);
  const shardNames = resolveAllNewsCoordinatorShardNames(env);
  if (shardNames.length <= 1) {
    return [baseKey];
  }

  const keys = new Set<string>();
  for (const shardName of shardNames) {
    keys.add(resolveNewsFeedStorageKey(env, shardName));
  }
  return Array.from(keys);
}

function buildOutboundDedupeKey(env: WorkerEnv, scope: string, channel: string, fingerprint: string): string {
  const prefix = normalizeOutboundNamespacePrefix(env.OUTBOUND_NAMESPACE_PREFIX);
  return `${prefix}:dedupe:${scope}:${channel}:${fingerprint}`;
}

function readAdminToken(env: WorkerEnv): string | undefined {
  return trimString(env.BILLING_ADMIN_TOKEN) ?? trimString(env.USAGE_ADMIN_TOKEN);
}

function readAiJobsAdminToken(env: WorkerEnv): string | undefined {
  return trimString(env.AI_JOBS_ADMIN_TOKEN) ?? readAdminToken(env);
}

function normalizeBillingStatus(value: unknown): BillingStatus {
  if (typeof value !== "string") {
    return "none";
  }
  switch (value) {
    case "trialing":
    case "active":
    case "expired":
    case "canceled":
    case "none":
      return value;
    default:
      return "none";
  }
}

function normalizeBillingAccount(
  value: unknown,
  userId: string,
  monthlyPriceUsd: number,
): BillingAccount | null {
  if (!isRecord(value)) {
    return null;
  }

  const status = normalizeBillingStatus(value.status);
  const trialStartedAtMs = parseFiniteNumber(value.trialStartedAtMs);
  const trialEndsAtMs = parseFiniteNumber(value.trialEndsAtMs);
  const subscribedAtMs = parseFiniteNumber(value.subscribedAtMs);
  const canceledAtMs = parseFiniteNumber(value.canceledAtMs);
  const lastStripeEventCreatedSec = parseFiniteNumber(value.lastStripeEventCreatedSec);
  const stripeCustomerId = trimString(value.stripeCustomerId);
  const stripeSubscriptionId = trimString(value.stripeSubscriptionId);
  const updatedAtMs = parseFiniteNumber(value.updatedAtMs) ?? Date.now();
  const userFromValue = trimString(value.userId) ?? userId;
  const price = parseFiniteNumber(value.monthlyPriceUsd);

  return {
    userId: userFromValue,
    status,
    ...(trialStartedAtMs === undefined ? {} : { trialStartedAtMs }),
    ...(trialEndsAtMs === undefined ? {} : { trialEndsAtMs }),
    ...(subscribedAtMs === undefined ? {} : { subscribedAtMs }),
    ...(canceledAtMs === undefined ? {} : { canceledAtMs }),
    ...(lastStripeEventCreatedSec === undefined ? {} : { lastStripeEventCreatedSec }),
    ...(stripeCustomerId ? { stripeCustomerId } : {}),
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
    monthlyPriceUsd: price === undefined ? monthlyPriceUsd : Number(price.toFixed(2)),
    updatedAtMs,
  };
}

function computeEntitlement(args: {
  nowMs: number;
  account: BillingAccount | null;
}): { tier: EntitlementTier; entitled: boolean } {
  const account = args.account;
  if (!account) {
    return { tier: "free", entitled: false };
  }
  if (account.status === "active") {
    return { tier: "subscriber", entitled: true };
  }
  if (account.status === "trialing") {
    if ((account.trialEndsAtMs ?? 0) > args.nowMs) {
      return { tier: "trial", entitled: false };
    }
    return { tier: "free", entitled: false };
  }
  return { tier: "free", entitled: false };
}

function parseOwnerUserIds(rawValue: string | undefined): string[] {
  const raw = trimString(rawValue) ?? DEFAULT_OWNER_USER_IDS;
  const normalizeOwnerPrincipal = (value: string): string => value.trim().toLowerCase().replace(/^@+/, "");
  return raw
    .split(",")
    .map((value) => normalizeOwnerPrincipal(value))
    .filter((value) => value.length > 0);
}

function isOwnerUser(env: WorkerEnv, userId: string): boolean {
  const ownerIds = parseOwnerUserIds(env.OWNER_USER_IDS);
  const normalizedUserId = userId.trim().toLowerCase().replace(/^@+/, "");
  return ownerIds.includes(normalizedUserId);
}

function computeEntitlementForUser(args: {
  env: WorkerEnv;
  userId: string;
  nowMs: number;
  account: BillingAccount | null;
}): { tier: EntitlementTier; entitled: boolean; owner: boolean } {
  const owner = isOwnerUser(args.env, args.userId);
  if (owner) {
    return {
      tier: "subscriber",
      entitled: true,
      owner: true,
    };
  }

  const base = computeEntitlement({ nowMs: args.nowMs, account: args.account });
  return {
    ...base,
    owner: false,
  };
}

function buildRateLimitKey(env: WorkerEnv, route: string, userId: string, bucketMinute: number): string {
  const prefix = normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX);
  return `${prefix}:ratelimit:${route}:${userId}:${bucketMinute}`;
}

async function enforceTierRateLimit(args: {
  env: WorkerEnv;
  route: string;
  userId: string;
  policy: TierPolicy;
  nowMs: number;
}): Promise<
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetAtMs: number;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  const binding =
    args.policy.tier === "subscriber"
      ? args.env.SUBSCRIBER_TIER_RATE_LIMIT_BINDING
      : args.policy.tier === "trial"
        ? args.env.TRIAL_TIER_RATE_LIMIT_BINDING
        : args.env.FREE_TIER_RATE_LIMIT_BINDING;
  if (binding && typeof binding.limit === "function") {
    const limited = await binding.limit({ key: `${args.route}:${args.userId}` });
    if (!limited.success) {
      return {
        ok: false,
        response: errorJsonWithHeaders(429, "Rate limit exceeded for this tier.", {
          "retry-after": "60",
        }),
      };
    }
    return {
      ok: true,
      limit: args.policy.rateLimitPerMinute,
      remaining: Math.max(0, args.policy.rateLimitPerMinute - 1),
      resetAtMs: (Math.floor(args.nowMs / 60_000) + 1) * 60_000,
    };
  }

  const kv = args.env.USAGE_KV;
  const bucketMinute = Math.floor(args.nowMs / 60_000);
  const resetAtMs = (bucketMinute + 1) * 60_000;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return {
      ok: true,
      limit: args.policy.rateLimitPerMinute,
      remaining: args.policy.rateLimitPerMinute,
      resetAtMs,
    };
  }

  const key = buildRateLimitKey(args.env, args.route, args.userId, bucketMinute);
  const currentRaw = await kv.get(key);
  let currentCount = 0;
  if (currentRaw) {
    try {
      const decoded = JSON.parse(currentRaw) as unknown;
      if (isRecord(decoded)) {
        const parsedCount = parseFiniteNumber(decoded.count);
        if (parsedCount !== undefined) {
          currentCount = Math.max(0, Math.floor(parsedCount));
        }
      }
    } catch {
      currentCount = 0;
    }
  }

  if (currentCount >= args.policy.rateLimitPerMinute) {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - args.nowMs) / 1000));
    return {
      ok: false,
      response: errorJsonWithHeaders(429, "Rate limit exceeded for this tier.", {
        "retry-after": String(retryAfterSeconds),
      }),
    };
  }

  const nextCount = currentCount + 1;
  await kv.put(
    key,
    JSON.stringify({
      count: nextCount,
      updatedAtMs: args.nowMs,
      route: args.route,
      tier: args.policy.tier,
    }),
    { expirationTtl: 120 },
  );

  return {
    ok: true,
    limit: args.policy.rateLimitPerMinute,
    remaining: Math.max(0, args.policy.rateLimitPerMinute - nextCount),
    resetAtMs,
  };
}

function normalizeNewsItems(value: unknown): NewsItem[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value
    .map((entry): NewsItem | null => {
      if (!isRecord(entry)) {
        return null;
      }
      const id = trimString(entry.id);
      const title = trimString(entry.title) ? cleanFeedText(trimString(entry.title)!) : undefined;
      const url = trimString(entry.url);
      const publishedAtMs = parseFiniteNumber(entry.publishedAtMs);
      if (!id || !title || !url || publishedAtMs === undefined) {
        return null;
      }
      const summaryRaw = trimString(entry.summary);
      const summary = summaryRaw ? trimFeedSummary(cleanFeedText(summaryRaw)) : undefined;
      const source = trimString(entry.source);
      const severity = normalizeIntelSeverity(entry.severity);
      const region = normalizeIntelRegion(entry.region);
      const category = normalizeIntelCategory(entry.category);
      const language = normalizeLanguageCode(entry.language);
      const translatedFrom = normalizeLanguageCode(entry.translatedFrom);
      const priorityScore = normalizePriorityScore(entry.priorityScore);
      const classificationConfidence = normalizeScore01(entry.classificationConfidence);
      return {
        id,
        title,
        url,
        publishedAtMs,
        ...(summary ? { summary } : {}),
        ...(source ? { source } : {}),
        ...(severity ? { severity } : {}),
        ...(region ? { region } : {}),
        ...(category ? { category } : {}),
        ...(language ? { language } : {}),
        ...(translatedFrom ? { translatedFrom } : {}),
        ...(priorityScore === undefined ? {} : { priorityScore }),
        ...(classificationConfidence === undefined ? {} : { classificationConfidence }),
      };
    })
    .filter((entry): entry is NewsItem => entry !== null);

  items.sort((left, right) => right.publishedAtMs - left.publishedAtMs);
  return items;
}

function normalizeIntelSeverity(value: unknown): IntelSeverity | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return null;
}

function normalizeIntelRegion(value: unknown): IntelRegion | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (
    normalized === "middle_east" ||
    normalized === "ukraine" ||
    normalized === "europe" ||
    normalized === "pacific" ||
    normalized === "africa" ||
    normalized === "east_asia" ||
    normalized === "central_america" ||
    normalized === "military" ||
    normalized === "global" ||
    normalized === "us"
  ) {
    return normalized;
  }
  return null;
}

function normalizeIntelCategory(value: unknown): IntelCategory | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "news" ||
    normalized === "conflict" ||
    normalized === "notam" ||
    normalized === "military_movement"
  ) {
    return normalized;
  }
  return null;
}

function normalizeScore01(value: unknown): number | undefined {
  const parsed = parseFiniteNumber(value);
  if (parsed === undefined) {
    return undefined;
  }
  return clamp(parsed, 0, 1);
}

function normalizePriorityScore(value: unknown): number | undefined {
  const parsed = parseFiniteNumber(value);
  if (parsed === undefined) {
    return undefined;
  }
  return clamp(Math.round(parsed), 0, 100);
}

function normalizeLanguageCode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.length >= 2 && normalized.length <= 12) {
    return normalized;
  }
  return undefined;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    })
    .replace(/&#(\d+);/g, (_match, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    });
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function cleanFeedText(value: string): string {
  const withoutCdata = stripCdata(value);
  // Decode first, then strip tags, then decode again for doubly-escaped entities.
  const decoded = decodeHtmlEntities(withoutCdata);
  const stripped = stripHtml(decoded);
  return decodeHtmlEntities(stripped).replace(/\s+/g, " ").trim();
}

function trimFeedSummary(value: string, maxChars = NEWS_RSS_SUMMARY_MAX_CHARS): string {
  let normalized = value;
  const markerIndex = normalized.indexOf("Latest Updates");
  if (markerIndex > 40) {
    normalized = normalized.slice(0, markerIndex).trim();
  }
  normalized = normalized
    .replace(/\b[A-Za-z0-9._-]{3,}\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{2}\/\d{2}\/\d{4}\s*-\s*\d{1,2}:\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }
  const sliced = normalized.slice(0, maxChars);
  const boundary = sliced.lastIndexOf(" ");
  const base = boundary > Math.floor(maxChars * 0.65) ? sliced.slice(0, boundary) : sliced;
  return `${base.trim()}...`;
}

function normalizeTextFingerprint(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalizeNewsUrl(rawUrl: string): string {
  const fallback = rawUrl.trim().toLowerCase();
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = "";
    const params = parsed.searchParams;
    const toDelete: string[] = [];
    for (const [key] of params.entries()) {
      const lower = key.toLowerCase();
      if (
        lower.startsWith("utm_") ||
        lower === "gclid" ||
        lower === "fbclid" ||
        lower === "mc_cid" ||
        lower === "mc_eid" ||
        lower === "ref" ||
        lower === "source"
      ) {
        toDelete.push(key);
      }
    }
    for (const key of toDelete) {
      params.delete(key);
    }
    const pathname = parsed.pathname.endsWith("/") && parsed.pathname.length > 1
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
    return `${parsed.hostname.toLowerCase()}${pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
}

function buildNewsIdentityKeys(item: NewsItem): string[] {
  const keys = new Set<string>();
  keys.add(`id:${item.id}`);
  const urlCanonical = canonicalizeNewsUrl(item.url);
  if (urlCanonical) {
    keys.add(`url:${urlCanonical}`);
  }
  const titleFingerprint = normalizeTextFingerprint(item.title);
  if (titleFingerprint.length > 20) {
    keys.add(`title:${titleFingerprint}`);
    const sourceFingerprint = normalizeTextFingerprint(item.source ?? "unknown");
    keys.add(`source-title:${sourceFingerprint}:${titleFingerprint}`);
  }
  return Array.from(keys);
}

function estimateLanguage(text: string, sourceLanguage?: string): string {
  const normalizedSourceLang = normalizeLanguageCode(sourceLanguage);
  if (normalizedSourceLang && normalizedSourceLang !== "en") {
    return normalizedSourceLang;
  }
  if (/[\u0400-\u04FF]/.test(text)) return "ru";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0590-\u05FF]/.test(text)) return "he";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  if (/[\u3040-\u30FF]/.test(text)) return "ja";
  if (/[\uAC00-\uD7AF]/.test(text)) return "ko";
  return "en";
}

function inferSeverityFromText(text: string): IntelSeverity {
  const normalized = text.toLowerCase();
  if (
    /\b(explosion|mass casualty|missile strike|ballistic|airstrike|downed aircraft|chemical|nuclear|invasion|hostage)\b/.test(
      normalized,
    )
  ) {
    return "critical";
  }
  if (/\b(drone strike|attack|offensive|intercepted|sanctions|evacuation|clashes|artillery|incursion)\b/.test(normalized)) {
    return "high";
  }
  if (/\b(alert|deployment|exercise|mobilization|warning|ceasefire|talks)\b/.test(normalized)) {
    return "medium";
  }
  return "low";
}

function inferRegionFromText(text: string): IntelRegion {
  const normalized = text.toLowerCase();
  if (/\b(ukraine|kyiv|kharkiv|donetsk|luhansk|crimea|moscow|russia)\b/.test(normalized)) return "ukraine";
  if (/\b(israel|gaza|west bank|lebanon|iran|iraq|syria|yemen|red sea)\b/.test(normalized)) return "middle_east";
  if (/\b(china|taiwan|south china sea|korea|japan|philippines)\b/.test(normalized)) return "east_asia";
  if (/\b(pacific|australia|new zealand|guam)\b/.test(normalized)) return "pacific";
  if (/\b(sahel|sudan|ethiopia|somalia|congo|africa)\b/.test(normalized)) return "africa";
  if (/\b(mexico|guatemala|honduras|el salvador|nicaragua|costa rica|panama)\b/.test(normalized)) return "central_america";
  if (/\b(united states|u\\.s\\.|usa|washington|pentagon)\b/.test(normalized)) return "us";
  if (/\b(nato|eu|brussels|europe|uk)\b/.test(normalized)) return "europe";
  if (/\b(notam|airspace|navy|fleet|fighter|destroyer|frigate|submarine)\b/.test(normalized)) return "military";
  return "global";
}

function inferCategoryFromText(text: string): IntelCategory {
  const normalized = text.toLowerCase();
  if (/\b(notam|airspace restriction|flight warning)\b/.test(normalized)) return "notam";
  if (/\b(fleet|carrier|destroyer|submarine|air defense|brigade|military exercise|fighter jet)\b/.test(normalized)) {
    return "military_movement";
  }
  if (/\b(clashes|offensive|strike|attack|artillery|battle|incursion|frontline)\b/.test(normalized)) return "conflict";
  return "news";
}

function computePriorityScore(item: NewsItem): number {
  const severity = normalizeIntelSeverity(item.severity) ?? "low";
  const category = normalizeIntelCategory(item.category) ?? "news";
  const base =
    severity === "critical" ? 92
    : severity === "high" ? 76
    : severity === "medium" ? 56
    : 34;
  const categoryBoost =
    category === "conflict" ? 8
    : category === "military_movement" ? 6
    : category === "notam" ? 4
    : 0;
  const ageMinutes = Math.max(0, (Date.now() - item.publishedAtMs) / 60_000);
  const recencyBoost = Math.max(0, 12 - Math.floor(ageMinutes / 30));
  return clamp(base + categoryBoost + recencyBoost, 0, 100);
}

function applyHeuristicEnrichment(item: NewsItem): NewsItem {
  const source = trimString(item.source) ?? "OSINT Desk";
  const summary = trimString(item.summary) ?? item.title;
  const combined = `${item.title}\n${summary}\n${source}`;
  const severity = normalizeIntelSeverity(item.severity) ?? inferSeverityFromText(combined);
  const region = normalizeIntelRegion(item.region) ?? inferRegionFromText(combined);
  const category = normalizeIntelCategory(item.category) ?? inferCategoryFromText(combined);
  const language = normalizeLanguageCode(item.language) ?? estimateLanguage(combined);
  const priorityScore = normalizePriorityScore(item.priorityScore) ?? computePriorityScore({
    ...item,
    source,
    summary,
    severity,
    region,
    category,
  });
  return {
    ...item,
    source,
    summary,
    severity,
    region,
    category,
    language,
    priorityScore,
  };
}

async function enrichNewsItemWithAi(args: {
  env: WorkerEnv;
  item: NewsItem;
}): Promise<NewsItem> {
  const base = applyHeuristicEnrichment(args.item);
  if (!normalizeBoolean(args.env.NEWS_AI_ENRICH_ENABLED, DEFAULT_NEWS_AI_ENRICH_ENABLED)) {
    return base;
  }

  const aiPayload = await invokeAiGateway({
    env: args.env,
    routeKind: "text",
    expectJson: true,
    maxTokens: 224,
    jsonSchema: {
      name: "news_enrichment",
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "language",
          "title_en",
          "summary_en",
          "severity",
          "region",
          "category",
          "priority",
          "confidence",
        ],
        properties: {
          language: { type: "string" },
          title_en: { type: "string" },
          summary_en: { type: "string" },
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          region: {
            type: "string",
            enum: ["middle_east", "ukraine", "europe", "pacific", "africa", "east_asia", "central_america", "military", "global", "us"],
          },
          category: { type: "string", enum: ["news", "conflict", "notam", "military_movement"] },
          priority: { type: "number" },
          confidence: { type: "number" },
        },
      },
    },
    cacheHint: "news-enrich-v1",
    cacheTtlSecondsOverride: resolveAiGatewayCacheTtlSeconds(
      args.env.AI_GATEWAY_CACHE_TTL_NEWS_ENRICH_SECONDS,
      DEFAULT_AI_GATEWAY_CACHE_TTL_NEWS_ENRICH_SECONDS,
    ),
    metadata: {
      pipeline: "news_enrichment",
      mode: "json",
    },
    messages: [
      {
        role: "system",
        content:
          "Return strict JSON with keys language,title_en,summary_en,severity,region,category,priority,confidence. " +
          "Use severity in critical/high/medium/low. Use region in middle_east/ukraine/europe/pacific/africa/east_asia/central_america/military/global/us. " +
          "Use category in news/conflict/notam/military_movement. Translate title_en and summary_en into concise fluent English.",
      },
      {
        role: "user",
        content: JSON.stringify({
          title: base.title,
          summary: base.summary ?? "",
          source: base.source ?? "",
          url: base.url,
          publishedAtMs: base.publishedAtMs,
        }),
      },
    ],
  });

  if (!aiPayload) {
    return base;
  }

  try {
    const parsed = JSON.parse(aiPayload) as unknown;
    if (!isRecord(parsed)) {
      return base;
    }
    const language = normalizeLanguageCode(parsed.language) ?? base.language;
    const titleEn = trimString(parsed.title_en) ?? base.title;
    const summaryEn = trimString(parsed.summary_en) ?? base.summary ?? base.title;
    const severity = normalizeIntelSeverity(parsed.severity) ?? base.severity;
    const region = normalizeIntelRegion(parsed.region) ?? base.region;
    const category = normalizeIntelCategory(parsed.category) ?? base.category;
    const priorityScore = normalizePriorityScore(parsed.priority) ?? base.priorityScore;
    const confidence = normalizeScore01(parsed.confidence);
    const translatedFrom =
      language && language !== "en" && titleEn !== base.title
        ? language
        : base.translatedFrom;
    return {
      ...base,
      title: titleEn,
      summary: summaryEn,
      severity,
      region,
      category,
      priorityScore,
      language,
      ...(translatedFrom ? { translatedFrom } : {}),
      ...(confidence === undefined ? {} : { classificationConfidence: confidence }),
    };
  } catch {
    return base;
  }
}

async function enrichNewsItemsForPublish(args: {
  env: WorkerEnv;
  inputItems: NewsItem[];
}): Promise<NewsItem[]> {
  if (args.inputItems.length < 1) {
    return [];
  }

  const heuristics = args.inputItems.map((item) => applyHeuristicEnrichment(item));
  if (!normalizeBoolean(args.env.NEWS_AI_ENRICH_ENABLED, DEFAULT_NEWS_AI_ENRICH_ENABLED)) {
    return heuristics;
  }

  const aiGatewayConfigured = Boolean(trimString(args.env.AI_GATEWAY_URL));
  if (!aiGatewayConfigured) {
    return heuristics;
  }

  const aiMaxItems = normalizeNewsAiEnrichMaxItems(args.env.NEWS_AI_ENRICH_MAX_ITEMS);
  const aiConnections = normalizeNewsAiEnrichConnections(args.env.NEWS_AI_ENRICH_CONNECTIONS);
  const aiRangeEnd = Math.min(heuristics.length, aiMaxItems);
  if (aiRangeEnd <= 0) {
    return heuristics;
  }

  const aiTargets = heuristics.slice(0, aiRangeEnd);
  const aiEnriched = await mapWithConcurrency(aiTargets, aiConnections, (item) =>
    enrichNewsItemWithAi({ env: args.env, item }),
  );

  return [...aiEnriched, ...heuristics.slice(aiRangeEnd)];
}

function toPublicIntelItem(item: NewsItem): PublicIntelItem {
  const enriched = applyHeuristicEnrichment(item);
  return {
    title: enriched.title,
    summary: enriched.summary ?? enriched.title,
    source: enriched.source ?? "OSINT Desk",
    url: enriched.url,
    timestamp: new Date(enriched.publishedAtMs).toISOString(),
    region: normalizeIntelRegion(enriched.region) ?? "",
    category: normalizeIntelCategory(enriched.category) ?? "",
    severity: normalizeIntelSeverity(enriched.severity) ?? "",
  };
}

function filterAndRankNewsForPublicIntel(args: {
  items: NewsItem[];
  searchParams: URLSearchParams;
  env: WorkerEnv;
}): NewsItem[] {
  const severity = normalizeIntelSeverity(args.searchParams.get("severity"));
  const region = normalizeIntelRegion(args.searchParams.get("region"));
  const category = normalizeIntelCategory(args.searchParams.get("category"));
  const source = trimString(args.searchParams.get("source"))?.toLowerCase();
  const query = trimString(args.searchParams.get("q"))?.toLowerCase();
  const language = normalizeLanguageCode(args.searchParams.get("language"));
  const maxLimit = normalizePublicIntelLimit(args.env.PUBLIC_INTEL_LIMIT);
  const requestedLimitRaw = parseFiniteNumber(args.searchParams.get("limit"));
  const requestedLimit =
    requestedLimitRaw === undefined ? maxLimit : clamp(Math.floor(requestedLimitRaw), 1, MAX_PUBLIC_INTEL_LIMIT);
  const limit = Math.min(requestedLimit, maxLimit);
  const filtered = args.items
    .map((item) => applyHeuristicEnrichment(item))
    .filter((item) => {
      if (severity && item.severity !== severity) return false;
      if (region && item.region !== region) return false;
      if (category && item.category !== category) return false;
      if (source && !(item.source ?? "").toLowerCase().includes(source)) return false;
      if (language && (item.language ?? "en") !== language) return false;
      if (query) {
        const haystack = `${item.title} ${item.summary ?? ""} ${item.source ?? ""} ${item.region ?? ""} ${item.category ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

  filtered.sort((left, right) => {
    const leftScore = normalizePriorityScore(left.priorityScore) ?? 0;
    const rightScore = normalizePriorityScore(right.priorityScore) ?? 0;
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return right.publishedAtMs - left.publishedAtMs;
  });

  return filtered.slice(0, limit);
}

function buildBriefingSeveritySummary(items: NewsItem[]): PublicBriefing["severity_summary"] {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of items) {
    const severity = normalizeIntelSeverity(item.severity) ?? inferSeverityFromText(`${item.title} ${item.summary ?? ""}`);
    summary[severity] += 1;
  }
  return summary;
}

function buildFallbackBriefingContent(items: NewsItem[], windowStartMs: number, windowHours: number): string {
  const severitySummary = buildBriefingSeveritySummary(items);
  const topItems = items
    .map((item) => applyHeuristicEnrichment(item))
    .sort((left, right) => {
      const leftScore = normalizePriorityScore(left.priorityScore) ?? 0;
      const rightScore = normalizePriorityScore(right.priorityScore) ?? 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return right.publishedAtMs - left.publishedAtMs;
    })
    .slice(0, 12);

  const regionCounts = new Map<string, number>();
  for (const item of topItems) {
    const region = item.region ?? "global";
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }
  const topRegions = Array.from(regionCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([region, count]) => `${region.replaceAll("_", " ")} (${count})`);

  const lines: string[] = [];
  lines.push(`INTELLIGENCE BRIEFING — ${new Date(windowStartMs).toISOString()}`);
  lines.push(`Window: ${windowHours}h`);
  lines.push(
    `Event mix: ${severitySummary.critical} critical, ${severitySummary.high} high, ${severitySummary.medium} medium, ${severitySummary.low} low.`,
  );
  if (topRegions.length > 0) {
    lines.push(`Regional concentration: ${topRegions.join(", ")}.`);
  }
  lines.push("");
  lines.push("Priority developments:");
  for (const item of topItems.slice(0, 8)) {
    lines.push(
      `- [${(item.severity ?? "low").toUpperCase()}] ${item.title} (${item.source ?? "OSINT Desk"})`,
    );
  }
  lines.push("");
  lines.push("Operational watchlist:");
  for (const item of topItems.slice(8, 12)) {
    lines.push(`- ${item.title}`);
  }
  return lines.join("\n");
}

async function buildAiBriefingContent(args: {
  env: WorkerEnv;
  items: NewsItem[];
  windowStartMs: number;
  windowHours: number;
}): Promise<string | null> {
  const payloadItems = args.items
    .map((item) => applyHeuristicEnrichment(item))
    .sort((left, right) => {
      const leftScore = normalizePriorityScore(left.priorityScore) ?? 0;
      const rightScore = normalizePriorityScore(right.priorityScore) ?? 0;
      if (leftScore !== rightScore) return rightScore - leftScore;
      return right.publishedAtMs - left.publishedAtMs;
    })
    .slice(0, 20)
    .map((item) => ({
      title: item.title,
      summary: item.summary ?? item.title,
      source: item.source ?? "OSINT Desk",
      severity: item.severity ?? "low",
      region: item.region ?? "global",
      category: item.category ?? "news",
      timestamp: new Date(item.publishedAtMs).toISOString(),
    }));

  const ai = await invokeAiGateway({
    env: args.env,
    routeKind: "text",
    expectJson: false,
    maxTokens: 480,
    cacheHint: "briefing-v1",
    cacheTtlSecondsOverride: resolveAiGatewayCacheTtlSeconds(
      args.env.AI_GATEWAY_CACHE_TTL_BRIEFING_SECONDS,
      DEFAULT_AI_GATEWAY_CACHE_TTL_BRIEFING_SECONDS,
    ),
    metadata: {
      pipeline: "briefing",
      mode: "text",
    },
    messages: [
      {
        role: "system",
        content:
          "Write a concise operational OSINT briefing in English with sections: Executive Summary, Critical Developments, Regional Snapshot, Watchlist. " +
          "Be factual, avoid speculation, and keep the total length under 320 words.",
      },
      {
        role: "user",
        content: JSON.stringify({
          windowStart: new Date(args.windowStartMs).toISOString(),
          windowHours: args.windowHours,
          events: payloadItems,
        }),
      },
    ],
  });
  return trimString(ai) ?? null;
}

async function buildPublicBriefings(args: {
  env: WorkerEnv;
  items: NewsItem[];
}): Promise<PublicBriefing[]> {
  const windowHours = normalizeBriefingWindowHours(args.env.BRIEFING_WINDOW_HOURS);
  const maxWindows = normalizeBriefingMaxWindows(args.env.BRIEFING_MAX_WINDOWS);
  const aiWindows = normalizeBriefingAiWindows(args.env.BRIEFING_AI_WINDOWS);
  const windowMs = windowHours * 60 * 60 * 1000;

  const buckets = new Map<number, NewsItem[]>();
  for (const item of args.items) {
    const bucketStart = Math.floor(item.publishedAtMs / windowMs) * windowMs;
    const list = buckets.get(bucketStart) ?? [];
    list.push(item);
    buckets.set(bucketStart, list);
  }

  const bucketStarts = Array.from(buckets.keys())
    .sort((left, right) => right - left)
    .slice(0, maxWindows);
  const briefings: PublicBriefing[] = [];

  for (let index = 0; index < bucketStarts.length; index += 1) {
    const bucketStart = bucketStarts[index];
    const bucketItems = (buckets.get(bucketStart) ?? [])
      .map((item) => applyHeuristicEnrichment(item))
      .sort((left, right) => right.publishedAtMs - left.publishedAtMs);
    if (bucketItems.length < 1) {
      continue;
    }
    const severitySummary = buildBriefingSeveritySummary(bucketItems);
    let content = buildFallbackBriefingContent(bucketItems, bucketStart, windowHours);
    if (index < aiWindows) {
      const aiContent = await buildAiBriefingContent({
        env: args.env,
        items: bucketItems,
        windowStartMs: bucketStart,
        windowHours,
      });
      if (aiContent) {
        content = aiContent;
      }
    }
    briefings.push({
      id: `briefing-${bucketStart}`,
      timestamp: new Date(bucketStart).toISOString(),
      content,
      severity_summary: severitySummary,
    });
  }

  return briefings;
}

function extractXmlTag(block: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(re);
  if (!match || match.length < 2) {
    return null;
  }
  return cleanFeedText(match[1]);
}

function extractAtomLink(block: string): string | null {
  const match = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return extractXmlTag(block, "id");
}

function parseFeedEntries(xml: string, perSourceLimit: number): Array<{
  title: string;
  url: string;
  summary: string;
  publishedAtMs: number;
}> {
  const items: Array<{ title: string; url: string; summary: string; publishedAtMs: number }> = [];
  const rssItems = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of rssItems) {
    if (items.length >= perSourceLimit) break;
    const title = extractXmlTag(block, "title");
    const url = extractXmlTag(block, "link");
    const rawSummary = extractXmlTag(block, "description") ?? extractXmlTag(block, "content:encoded") ?? title ?? "";
    const summary = trimFeedSummary(cleanFeedText(rawSummary));
    const dateRaw = extractXmlTag(block, "pubDate") ?? extractXmlTag(block, "updated");
    if (!title || !url) {
      continue;
    }
    const dateMs = dateRaw ? Date.parse(dateRaw) : NaN;
    items.push({
      title,
      url,
      summary,
      publishedAtMs: Number.isFinite(dateMs) ? dateMs : Date.now(),
    });
  }

  if (items.length >= perSourceLimit) {
    return items.slice(0, perSourceLimit);
  }

  const atomEntries = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of atomEntries) {
    if (items.length >= perSourceLimit) break;
    const title = extractXmlTag(block, "title");
    const url = extractAtomLink(block);
    const rawSummary = extractXmlTag(block, "summary") ?? extractXmlTag(block, "content") ?? title ?? "";
    const summary = trimFeedSummary(cleanFeedText(rawSummary));
    const dateRaw = extractXmlTag(block, "updated") ?? extractXmlTag(block, "published");
    if (!title || !url) {
      continue;
    }
    const dateMs = dateRaw ? Date.parse(dateRaw) : NaN;
    items.push({
      title,
      url,
      summary,
      publishedAtMs: Number.isFinite(dateMs) ? dateMs : Date.now(),
    });
  }

  return items.slice(0, perSourceLimit);
}

function mapSourceRegionToIntelRegion(sourceRegion: string): IntelRegion {
  const normalized = sourceRegion.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "ukraine") return "ukraine";
  if (normalized === "middle_east") return "middle_east";
  if (normalized === "military") return "military";
  if (normalized === "europe") return "europe";
  if (normalized === "africa") return "africa";
  if (normalized === "east_asia" || normalized === "asia" || normalized === "south_asia" || normalized === "southeast_asia") return "east_asia";
  if (normalized === "pacific" || normalized === "oceania" || normalized === "australia" || normalized === "asia_pacific") return "pacific";
  if (normalized === "latin_america" || normalized === "central_america" || normalized === "south_america") return "central_america";
  if (normalized === "us" || normalized === "north_america") return "us";
  return "global";
}

function mapSourceCategoryToIntelCategory(category: OsintSource["category"]): IntelCategory {
  if (category === "conflict_tracker") return "conflict";
  if (category === "osint_collective" || category === "regional_analyst") return "military_movement";
  return "news";
}

function normalizeSourceRegionBucket(rawRegion: string): string {
  const normalized = rawRegion.trim().toLowerCase().replaceAll("-", "_");
  if (!normalized) return "global";
  if (normalized.includes("middle_east")) return "middle_east";
  if (normalized.includes("south_asia")) return "south_asia";
  if (normalized.includes("east_asia")) return "east_asia";
  if (normalized.includes("latin_america")) return "latin_america";
  if (normalized.includes("central_america")) return "central_america";
  return normalized;
}

function computeSourceSelectionBaseWeight(source: OsintSource): number {
  const reliabilityBoost = source.reliability === "high" ? 20 : 8;
  const categoryBoost =
    source.category === "conflict_tracker" ? 24
    : source.category === "regional_analyst" ? 20
    : source.category === "osint_collective" ? 16
    : source.category === "newsroom" ? 12
    : 10;
  const languageBoost = source.language.toLowerCase() === "en" ? 0 : 4;
  const regionBoost = normalizeSourceRegionBucket(source.region) === "global" ? 0 : 3;
  return reliabilityBoost + categoryBoost + languageBoost + regionBoost;
}

function selectBalancedNonPrioritySources(
  nonPriority: OsintSource[],
  count: number,
  windowIndex: number,
): OsintSource[] {
  if (count <= 0 || nonPriority.length < 1) {
    return [];
  }

  const selected: OsintSource[] = [];
  const regionCounts = new Map<string, number>();
  const categoryCounts = new Map<OsintSource["category"], number>();
  const candidateById = new Map(nonPriority.map((source) => [source.id, source]));

  while (selected.length < count && candidateById.size > 0) {
    let best: OsintSource | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const source of candidateById.values()) {
      const region = normalizeSourceRegionBucket(source.region);
      const base = computeSourceSelectionBaseWeight(source);
      const jitter = stableHash32(`${source.id}:${windowIndex}`) % 17;
      const slotJitter = stableHash32(`${source.id}:${windowIndex}:slot:${selected.length}`) % 11;
      const regionPenalty = (regionCounts.get(region) ?? 0) * 18;
      const categoryPenalty = (categoryCounts.get(source.category) ?? 0) * 12;
      const score = base + jitter + slotJitter - regionPenalty - categoryPenalty;

      if (score > bestScore) {
        bestScore = score;
        best = source;
      }
    }

    if (!best) {
      break;
    }

    selected.push(best);
    candidateById.delete(best.id);
    const region = normalizeSourceRegionBucket(best.region);
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    categoryCounts.set(best.category, (categoryCounts.get(best.category) ?? 0) + 1);
  }

  return selected;
}

function selectFeedSourcesForRun(nowMs: number, perRun: number, rotationWindowSeconds: number): OsintSource[] {
  const feedSources = OSINT_SOURCE_CATALOG.filter((source) => typeof source.feedUrl === "string" && source.feedUrl.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (feedSources.length < 1 || perRun <= 0) {
    return [];
  }
  const count = Math.min(perRun, feedSources.length);
  const selected: OsintSource[] = [];

  const priority = feedSources.filter((source) => PRIORITY_RSS_SOURCE_IDS.has(source.id));
  const nonPriority = feedSources.filter((source) => !PRIORITY_RSS_SOURCE_IDS.has(source.id));
  const priorityCap = Math.min(count, Math.min(8, priority.length));
  for (let index = 0; index < priorityCap; index += 1) {
    selected.push(priority[index]);
  }

  if (selected.length >= count || nonPriority.length < 1) {
    return selected.slice(0, count);
  }

  const remaining = count - selected.length;
  const rotationWindowMs = Math.max(rotationWindowSeconds, 1) * 1_000;
  const windowIndex = Math.floor(nowMs / rotationWindowMs);
  selected.push(...selectBalancedNonPrioritySources(nonPriority, remaining, windowIndex));
  return selected;
}

async function fetchSourceFeedNews(args: {
  env: WorkerEnv;
  source: OsintSource;
  perSourceLimit: number;
  validatorTtlSeconds: number;
}): Promise<NewsItem[]> {
  if (!args.source.feedUrl) {
    return [];
  }
  const validatorState = await loadRssSourceValidator(args.env, args.source.id);
  const requestHeaders: Record<string, string> = {
    "user-agent": "intel-dashboard-backend/1.0",
    accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
  };
  if (validatorState?.etag) {
    requestHeaders["if-none-match"] = validatorState.etag;
  }
  if (validatorState?.lastModified) {
    requestHeaders["if-modified-since"] = validatorState.lastModified;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(args.source.feedUrl, {
      headers: requestHeaders,
      signal: controller.signal,
    });
    const nextEtag = trimString(response.headers.get("etag")) ?? validatorState?.etag;
    const nextLastModified =
      trimString(response.headers.get("last-modified")) ?? validatorState?.lastModified;
    if (response.status === 304) {
      await storeRssSourceValidator(
        args.env,
        args.source.id,
        {
          ...(nextEtag ? { etag: nextEtag } : {}),
          ...(nextLastModified ? { lastModified: nextLastModified } : {}),
          checkedAtMs: Date.now(),
        },
        args.validatorTtlSeconds,
      );
      return [];
    }
    if (!response.ok) {
      return [];
    }
    const xml = await response.text();
    await storeRssSourceValidator(
      args.env,
      args.source.id,
      {
        ...(nextEtag ? { etag: nextEtag } : {}),
        ...(nextLastModified ? { lastModified: nextLastModified } : {}),
        checkedAtMs: Date.now(),
      },
      args.validatorTtlSeconds,
    );
    const parsed = parseFeedEntries(xml, args.perSourceLimit);
    const nowMs = Date.now();
    const minPublishedAtMs = nowMs - NEWS_RSS_MAX_ITEM_AGE_HOURS * 60 * 60 * 1000;
    const items: NewsItem[] = [];
    for (const entry of parsed) {
      const publishedAtMs =
        Number.isFinite(entry.publishedAtMs) && entry.publishedAtMs > 0 && entry.publishedAtMs < nowMs + DAY_MS
          ? entry.publishedAtMs
          : nowMs;
      if (publishedAtMs < minPublishedAtMs) {
        continue;
      }
      const normalizedTitle = cleanFeedText(entry.title);
      const normalizedSummary = trimFeedSummary(cleanFeedText(entry.summary || normalizedTitle));
      if (!normalizedTitle) {
        continue;
      }
      const idSeed = `${args.source.id}:${canonicalizeNewsUrl(entry.url)}:${publishedAtMs}`;
      items.push({
        id: `${args.source.id}-${stableHash32(idSeed).toString(16)}`,
        title: normalizedTitle,
        url: entry.url,
        publishedAtMs,
        summary: normalizedSummary,
        source: args.source.name,
        category: mapSourceCategoryToIntelCategory(args.source.category),
        region: mapSourceRegionToIntelRegion(args.source.region),
        language: args.source.language,
      });
    }
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function ingestNewsFromSourceCatalog(env: WorkerEnv): Promise<{
  selectedSources: number;
  fetchedItems: number;
  publishedItems: number;
}> {
  if (!normalizeBoolean(env.NEWS_RSS_INGEST_ENABLED, DEFAULT_NEWS_RSS_INGEST_ENABLED)) {
    return { selectedSources: 0, fetchedItems: 0, publishedItems: 0 };
  }
  let perRun = normalizeNewsRssSourcesPerRun(env.NEWS_RSS_SOURCES_PER_RUN);
  let perSourceLimit = normalizeNewsRssItemsPerSource(env.NEWS_RSS_ITEMS_PER_SOURCE);
  const rotationWindowSeconds = normalizeNewsRssRotationWindowSeconds(env.NEWS_RSS_ROTATION_WINDOW_SECONDS);
  const validatorTtlSeconds = normalizeNewsRssValidatorTtlSeconds(env.NEWS_RSS_VALIDATOR_TTL_SECONDS);
  if (isFreeTierModeEnabled(env)) {
    perRun = Math.min(perRun, FREE_TIER_HARD_MAX_NEWS_RSS_SOURCES_PER_RUN);
    perSourceLimit = Math.min(perSourceLimit, FREE_TIER_HARD_MAX_NEWS_RSS_ITEMS_PER_SOURCE);
  }
  const selectedSources = selectFeedSourcesForRun(Date.now(), perRun, rotationWindowSeconds);
  if (selectedSources.length < 1) {
    return { selectedSources: 0, fetchedItems: 0, publishedItems: 0 };
  }

  const batches = await mapWithConcurrency(selectedSources, 4, (source) =>
    fetchSourceFeedNews({ env, source, perSourceLimit, validatorTtlSeconds }),
  );
  const fetchedItems = batches.flat();
  if (fetchedItems.length < 1) {
    return { selectedSources: selectedSources.length, fetchedItems: 0, publishedItems: 0 };
  }

  const dedupedByUrl = new Map<string, NewsItem>();
  for (const item of fetchedItems) {
    const key = canonicalizeNewsUrl(item.url);
    const current = dedupedByUrl.get(key);
    if (!current || item.publishedAtMs > current.publishedAtMs) {
      dedupedByUrl.set(key, item);
    }
  }
  const dedupedItems = Array.from(dedupedByUrl.values()).sort((left, right) => right.publishedAtMs - left.publishedAtMs);
  const enriched = await enrichNewsItemsForPublish({ env, inputItems: dedupedItems });
  const publish = await publishNewsWithCoordinator({
    env,
    inputItems: enriched,
    merge: true,
    shardKey: `rss-ingest-${Math.floor(Date.now() / (Math.max(rotationWindowSeconds, 1) * 1_000))}`,
  });
  return {
    selectedSources: selectedSources.length,
    fetchedItems: dedupedItems.length,
    publishedItems: publish.published,
  };
}

function normalizeOutboundTarget(value: unknown): OutboundTarget | null {
  if (!isRecord(value)) {
    return null;
  }
  const channel = trimString(value.channel)?.toLowerCase();
  const endpointUrl = trimString(value.endpointUrl);
  if (!channel || !endpointUrl) {
    return null;
  }

  let method: "POST" | "PUT" = "POST";
  const rawMethod = trimString(value.method)?.toUpperCase();
  if (rawMethod === "PUT") {
    method = "PUT";
  }

  const headers: Record<string, string> = {};
  if (isRecord(value.headers)) {
    for (const [key, headerValue] of Object.entries(value.headers)) {
      const normalizedKey = trimString(key);
      const normalizedValue = trimString(headerValue);
      if (normalizedKey && normalizedValue) {
        headers[normalizedKey] = normalizedValue;
      }
    }
  }

  return {
    channel,
    endpointUrl,
    method,
    headers,
  };
}

function normalizeOutboundPublishPayload(value: unknown, env: WorkerEnv): OutboundPublishPayload | null {
  if (!isRecord(value) || !Array.isArray(value.targets)) {
    return null;
  }
  if (value.targets.length < 1 || value.targets.length > MAX_OUTBOUND_TARGETS) {
    return null;
  }

  const targets = value.targets
    .map((target) => normalizeOutboundTarget(target))
    .filter((target): target is OutboundTarget => target !== null);
  if (targets.length < 1) {
    return null;
  }

  const dedupeScope = trimString(value.dedupeScope) ?? "default";
  const dedupeTtlSeconds = normalizeOutboundDedupeTtlSeconds(
    trimString(value.dedupeTtlSeconds) ?? env.OUTBOUND_DEDUPE_TTL_SECONDS,
  );

  return {
    targets,
    dedupeScope,
    dedupeTtlSeconds,
  };
}

function normalizeAiJobRequest(value: unknown): AiJobRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  const type = trimString(value.type)?.toLowerCase();
  if (!type) {
    return null;
  }

  if (type === "dedupe") {
    return {
      type: "dedupe",
      payload: value.payload,
      ...(trimString(value.channel) ? { channel: trimString(value.channel) } : {}),
      ...(typeof value.preferEscalation === "boolean" ? { preferEscalation: value.preferEscalation } : {}),
    };
  }

  if (type === "translate") {
    const text = trimString(value.text);
    const targetLanguage = trimString(value.targetLanguage);
    if (!text || !targetLanguage) {
      return null;
    }
    return {
      type: "translate",
      text,
      targetLanguage,
    };
  }

  if (type === "classify") {
    const text = trimString(value.text);
    if (!text || !Array.isArray(value.labels) || value.labels.length < 1 || value.labels.length > 20) {
      return null;
    }
    const labels = value.labels
      .map((label) => trimString(label))
      .filter((label): label is string => Boolean(label));
    if (labels.length < 1) {
      return null;
    }
    return {
      type: "classify",
      text,
      labels,
    };
  }

  return null;
}

function canonicalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeForHash(item));
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalizeForHash(child)] as const);
    const output: Record<string, unknown> = {};
    for (const [key, child] of entries) {
      output[key] = child;
    }
    return output;
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeForHash(value));
}

async function sha256Hex(payload: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  const bytes = new Uint8Array(hashBuffer);
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  if (items.length < 1) {
    return [];
  }

  const maxWorkers = clamp(Math.floor(concurrency), 1, items.length);
  const results = new Array<U>(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(Array.from({ length: maxWorkers }, () => worker()));
  return results;
}

type AiGatewayContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

type AiGatewayMessage = {
  role: "system" | "user" | "assistant";
  content: string | AiGatewayContentPart[];
};

type AiGatewayRouteKind = "default" | "text" | "media" | "escalation";

type AiGatewayRouteConfig = {
  kind: AiGatewayRouteKind;
  url: string;
  model: string;
};

type AiGatewayInvocationResult = {
  content: string | null;
  route: AiGatewayRouteConfig | null;
  status?: number;
  errorCode?: string;
  errorMessage?: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  cacheStatus?: string;
  durationMs?: number;
};

type AiGatewayJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

function isCerebrasRouteModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith("cerebras/");
}

function shouldUseLowReasoningEffort(args: {
  routeKind: AiGatewayRouteKind;
  model: string;
  expectJson: boolean;
}): boolean {
  if (!isCerebrasRouteModel(args.model)) {
    return false;
  }
  if (args.routeKind === "media" || args.routeKind === "escalation") {
    return false;
  }
  return args.expectJson;
}

function estimateCompletionTokensFromText(text: string, args: {
  min: number;
  max: number;
  multiplier: number;
  padding: number;
}): number {
  const approxInputTokens = Math.ceil(text.trim().length / 4);
  return clamp(
    Math.ceil(approxInputTokens * args.multiplier) + args.padding,
    args.min,
    args.max,
  );
}

function estimateTranslateMaxTokens(text: string): number {
  return estimateCompletionTokensFromText(text, {
    min: 48,
    max: 640,
    multiplier: 1.15,
    padding: 24,
  });
}

async function invokeAiGatewayDetailed(args: {
  env: WorkerEnv;
  messages: AiGatewayMessage[];
  maxTokens: number;
  expectJson: boolean;
  jsonSchema?: AiGatewayJsonSchema;
  routeKind?: AiGatewayRouteKind;
  modelOverride?: string;
  urlOverride?: string;
  cacheHint?: string;
  cacheTtlSecondsOverride?: number;
  metadata?: Record<string, string>;
}): Promise<AiGatewayInvocationResult> {
  const route = resolveAiGatewayRouteConfig({
    env: args.env,
    routeKind: args.routeKind,
    modelOverride: args.modelOverride,
    urlOverride: args.urlOverride,
  });
  if (!route) {
    return {
      content: null,
      route: null,
      errorCode: "gateway_unconfigured",
      errorMessage: "AI gateway URL is not configured.",
    };
  }

  const timeoutMs = normalizeAiGatewayTimeoutMs(args.env.AI_GATEWAY_TIMEOUT_MS);
  const gatewayTimeoutMs = Math.max(250, timeoutMs - 100);
  const cacheTtlSeconds = args.cacheTtlSecondsOverride ?? normalizeAiGatewayCacheTtlSeconds(args.env.AI_GATEWAY_CACHE_TTL_SECONDS);
  const maxAttempts = normalizeAiGatewayMaxAttempts(args.env.AI_GATEWAY_MAX_ATTEMPTS);
  const retryDelayMs = normalizeAiGatewayRetryDelayMs(args.env.AI_GATEWAY_RETRY_DELAY_MS);
  const backoff = normalizeAiGatewayBackoff(args.env.AI_GATEWAY_BACKOFF);
  const collectLog = normalizeBoolean(args.env.AI_GATEWAY_COLLECT_LOG, DEFAULT_AI_GATEWAY_COLLECT_LOG);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  const normalizedMessagesForCache = args.messages.map((message) => ({
    ...message,
    content:
      typeof message.content === "string"
        ? message.content.replace(/\s+/g, " ").trim()
        : message.content.map((part) =>
            part.type === "text"
              ? {
                  ...part,
                  text: part.text.replace(/\s+/g, " ").trim(),
                }
              : part,
          ),
  }));

  let cacheKey: string | undefined;
  if (cacheTtlSeconds > 0) {
    const schemaCacheKey =
      args.jsonSchema === undefined
        ? null
        : {
            name: args.jsonSchema.name,
            hash: await sha256Hex(stableStringify(args.jsonSchema.schema)),
          };
    const cachePayload = stableStringify({
      model: route.model,
      expectJson: args.expectJson,
      hint: args.cacheHint ?? "default",
      schema: schemaCacheKey,
      messages: normalizedMessagesForCache,
    });
    cacheKey = `intel:${await sha256Hex(cachePayload)}`;
  }

  let metadataHeader: string | undefined;
  if (args.metadata && Object.keys(args.metadata).length > 0) {
    try {
      metadataHeader = JSON.stringify(args.metadata);
    } catch {
      metadataHeader = undefined;
    }
  }

  try {
    const requestBody: Record<string, unknown> = {
      model: route.model,
      temperature: 0,
      ...(isCerebrasRouteModel(route.model)
        ? { max_completion_tokens: Math.max(32, Math.floor(args.maxTokens)) }
        : { max_tokens: Math.max(32, Math.floor(args.maxTokens)) }),
      ...(args.expectJson
        ? args.jsonSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: args.jsonSchema.name,
                  strict: true,
                  schema: args.jsonSchema.schema,
                },
              },
            }
          : { response_format: { type: "json_object" } }
        : {}),
      messages: args.messages,
    };
    if (shouldUseLowReasoningEffort({
      routeKind: args.routeKind ?? "default",
      model: route.model,
      expectJson: args.expectJson,
    })) {
      requestBody.reasoning_effort = "low";
    }

    const response = await fetch(route.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(trimString(args.env.AI_GATEWAY_TOKEN)
          ? { authorization: `Bearer ${trimString(args.env.AI_GATEWAY_TOKEN)}` }
          : {}),
        ...(cacheKey ? { "cf-aig-cache-key": cacheKey } : {}),
        ...(cacheTtlSeconds > 0 ? { "cf-aig-cache-ttl": String(cacheTtlSeconds) } : {}),
        "cf-aig-request-timeout": String(gatewayTimeoutMs),
        "cf-aig-max-attempts": String(maxAttempts),
        ...(maxAttempts > 1 && retryDelayMs > 0 ? { "cf-aig-retry-delay": String(retryDelayMs) } : {}),
        ...(maxAttempts > 1 ? { "cf-aig-backoff": backoff } : {}),
        "cf-aig-collect-log": collectLog ? "true" : "false",
        ...(metadataHeader ? { "cf-aig-metadata": metadataHeader } : {}),
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const cacheStatus = normalizeAiCacheStatus(response.headers.get("cf-aig-cache-status"));
    if (!response.ok) {
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      try {
        const decoded = (await response.json()) as unknown;
        if (isRecord(decoded)) {
          const errorValue = decoded.error;
          if (Array.isArray(errorValue) && errorValue.length > 0) {
            const firstError = errorValue[0];
            if (isRecord(firstError)) {
              errorCode =
                firstError.code === undefined ? undefined : trimString(String(firstError.code));
              errorMessage = trimString(firstError.message);
            }
          } else if (isRecord(errorValue)) {
            errorCode =
              errorValue.code === undefined ? undefined : trimString(String(errorValue.code));
            errorMessage = trimString(errorValue.message);
          }
        }
      } catch {
        // ignore provider payload parse failures and fall back to HTTP status
      }
      writeAiTelemetry({
        env: args.env,
        source: "backend",
        pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
        lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
        model: route.model,
        provider: resolveAiProvider(route.model),
        outcome: "error",
        cacheStatus,
        status: response.status,
        durationMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputInputRatio: 0,
        mediaCount: normalizeAiMediaCount(args.metadata?.media),
      });
      return {
        content: null,
        route,
        status: response.status,
        cacheStatus,
        durationMs: Date.now() - startedAt,
        ...(errorCode ? { errorCode } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      };
    }

    let decoded: unknown;
    try {
      decoded = (await response.json()) as unknown;
    } catch {
      writeAiTelemetry({
        env: args.env,
        source: "backend",
        pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
        lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
        model: route.model,
        provider: resolveAiProvider(route.model),
        outcome: "invalid_json",
        cacheStatus,
        status: response.status,
        durationMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputInputRatio: 0,
        mediaCount: normalizeAiMediaCount(args.metadata?.media),
      });
      return {
        content: null,
        route,
        cacheStatus,
        durationMs: Date.now() - startedAt,
        errorCode: "invalid_json",
        errorMessage: "AI gateway returned invalid JSON.",
      };
    }
    if (!isRecord(decoded) || !Array.isArray(decoded.choices) || decoded.choices.length < 1) {
      writeAiTelemetry({
        env: args.env,
        source: "backend",
        pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
        lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
        model: route.model,
        provider: resolveAiProvider(route.model),
        outcome: "empty_choices",
        cacheStatus,
        status: 200,
        durationMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputInputRatio: 0,
        mediaCount: normalizeAiMediaCount(args.metadata?.media),
      });
      return {
        content: null,
        route,
        cacheStatus,
        durationMs: Date.now() - startedAt,
        errorCode: "empty_choices",
        errorMessage: "AI gateway response did not include choices.",
      };
    }
    const firstChoice = decoded.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
      writeAiTelemetry({
        env: args.env,
        source: "backend",
        pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
        lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
        model: route.model,
        provider: resolveAiProvider(route.model),
        outcome: "invalid_choice",
        cacheStatus,
        status: 200,
        durationMs: Date.now() - startedAt,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        outputInputRatio: 0,
        mediaCount: normalizeAiMediaCount(args.metadata?.media),
      });
      return {
        content: null,
        route,
        cacheStatus,
        durationMs: Date.now() - startedAt,
        errorCode: "invalid_choice",
        errorMessage: "AI gateway response was missing the message payload.",
      };
    }
    const usage = isRecord(decoded.usage) ? decoded.usage : null;
    const promptTokens = usage ? readOptionalAiTokenCount(usage.prompt_tokens) : null;
    const completionTokens = usage ? readOptionalAiTokenCount(usage.completion_tokens) : null;
    const totalTokens =
      usage === null
        ? 0
        : readOptionalAiTokenCount(usage.total_tokens) ?? ((promptTokens ?? 0) + (completionTokens ?? 0));
    const outputInputRatio =
      promptTokens && completionTokens !== null && promptTokens > 0
        ? Number((completionTokens / promptTokens).toFixed(4))
        : 0;
    writeAiTelemetry({
      env: args.env,
      source: "backend",
      pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
      lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
      model: route.model,
      provider: resolveAiProvider(route.model),
      outcome: "ok",
      cacheStatus,
      status: 200,
      durationMs: Date.now() - startedAt,
      promptTokens: promptTokens ?? 0,
      completionTokens: completionTokens ?? 0,
      totalTokens,
      outputInputRatio,
      mediaCount: normalizeAiMediaCount(args.metadata?.media),
    });
    return {
      content: trimString(firstChoice.message.content) ?? null,
      route,
      promptTokens,
      completionTokens,
      cacheStatus,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timed out/i.test(error.message));
    writeAiTelemetry({
      env: args.env,
      source: "backend",
      pipeline: trimString(args.metadata?.pipeline) ?? "unknown",
      lane: trimString(args.metadata?.lane) ?? (args.routeKind ?? "default"),
      model: route.model,
      provider: resolveAiProvider(route.model),
      outcome: aborted ? "timeout" : "fetch_failed",
      cacheStatus: "unknown",
      status: 0,
      durationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      outputInputRatio: 0,
      mediaCount: normalizeAiMediaCount(args.metadata?.media),
    });
    return {
      content: null,
      route,
      durationMs: Date.now() - startedAt,
      errorCode: aborted ? "gateway_timeout" : "gateway_fetch_failed",
      errorMessage: aborted ? "AI gateway request timed out." : "AI gateway request failed.",
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function invokeAiGateway(args: {
  env: WorkerEnv;
  messages: AiGatewayMessage[];
  maxTokens: number;
  expectJson: boolean;
  jsonSchema?: AiGatewayJsonSchema;
  routeKind?: AiGatewayRouteKind;
  modelOverride?: string;
  urlOverride?: string;
  cacheHint?: string;
  cacheTtlSecondsOverride?: number;
  metadata?: Record<string, string>;
}): Promise<string | null> {
  const result = await invokeAiGatewayDetailed(args);
  return result.content;
}

type DedupeAiResult = {
  key: string;
  aiGatewayUsed: boolean;
  lane: "text" | "media" | "escalation" | "fallback_hash";
  model?: string;
  escalationUsed: boolean;
  mediaUsed: boolean;
  mediaCount: number;
  fallbackReason?: string;
  gatewayStatus?: number;
  gatewayErrorCode?: string;
  gatewayErrorMessage?: string;
};

function parseDedupeKey(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    return trimString(parsed.dedupe_key) ?? null;
  } catch {
    return null;
  }
}

async function deriveDedupeKeyWithAi(args: {
  env: WorkerEnv;
  canonicalPayload: string;
  sourcePayload?: unknown;
  preferEscalation?: boolean;
}): Promise<DedupeAiResult> {
  const mediaUrls = extractMediaUrls(
    args.sourcePayload,
    normalizeAiDedupeMediaMaxImages(args.env.AI_DEDUPE_MEDIA_MAX_IMAGES),
  );
  const mediaUsed = mediaUrls.length > 0;
  const shouldAllowEscalation = normalizeBoolean(
    args.env.AI_DEDUPE_ESCALATION_ENABLED,
    DEFAULT_AI_DEDUPE_ESCALATION_ENABLED,
  );

  const fallbackResult = async (): Promise<DedupeAiResult> => ({
    key: await sha256Hex(args.canonicalPayload),
    aiGatewayUsed: false,
    lane: "fallback_hash",
    escalationUsed: false,
    mediaUsed,
    mediaCount: mediaUrls.length,
  });

  const buildMessages = (routeKind: "text" | "media" | "escalation"): AiGatewayMessage[] => {
    const systemContent =
      routeKind === "media"
        ? "Return compact JSON object with only one key named dedupe_key. Use both the payload text and the attached images to derive a stable normalized dedupe_key for near-duplicate reports."
        : "Return compact JSON object with only one key named dedupe_key. dedupe_key must be stable and normalized for near-duplicate news payloads.";

    if (routeKind !== "media" || mediaUrls.length < 1) {
      return [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: args.canonicalPayload,
        },
      ];
    }

    return [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Use this canonical payload as the primary text context. Attached images are part of the same report and should influence dedupe_key generation only if they materially affect duplicate detection.\n" +
              args.canonicalPayload,
          },
          ...mediaUrls.map(
            (url): AiGatewayContentPart => ({
              type: "image_url",
              image_url: { url },
            }),
          ),
        ],
      },
    ];
  };

  const invokeLane = async (
    lane: "text" | "media" | "escalation",
  ): Promise<{
    dedupeKey: string | null;
    model?: string;
    status?: number;
    errorCode?: string;
    errorMessage?: string;
  }> => {
    const result = await invokeAiGatewayDetailed({
      env: args.env,
      routeKind: lane,
      maxTokens: 48,
      expectJson: true,
      jsonSchema: {
        name: "dedupe_key",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["dedupe_key"],
          properties: {
            dedupe_key: { type: "string" },
          },
        },
      },
      cacheHint: "dedupe-key-v2",
      cacheTtlSecondsOverride: resolveAiGatewayCacheTtlSeconds(
        args.env.AI_GATEWAY_CACHE_TTL_DEDUPE_SECONDS,
        DEFAULT_AI_GATEWAY_CACHE_TTL_DEDUPE_SECONDS,
      ),
      metadata: {
        pipeline: "dedupe",
        mode: "json",
        lane,
        media: mediaUrls.length > 0 ? "true" : "false",
      },
      messages: buildMessages(lane),
    });
    return {
      dedupeKey: result.content ? parseDedupeKey(result.content) : null,
      ...(result.route ? { model: result.route.model } : {}),
      ...(result.status === undefined ? {} : { status: result.status }),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
    };
  };

  const primaryLane: "text" | "media" | "escalation" = args.preferEscalation
    ? "escalation"
    : mediaUsed
      ? "media"
      : "text";

  const primary = await invokeLane(primaryLane);
  if (primary.dedupeKey) {
    return {
      key: await sha256Hex(primary.dedupeKey),
      aiGatewayUsed: true,
      lane: primaryLane,
      ...(primary.model ? { model: primary.model } : {}),
      escalationUsed: primaryLane === "escalation",
      mediaUsed,
      mediaCount: mediaUrls.length,
    };
  }

  if (!shouldAllowEscalation || primaryLane === "escalation") {
    return {
      ...(await fallbackResult()),
      fallbackReason:
        primary.errorCode ??
        (primary.status === undefined ? "missing_dedupe_key" : `gateway_http_${primary.status}`),
      ...(primary.status === undefined ? {} : { gatewayStatus: primary.status }),
      ...(primary.errorCode ? { gatewayErrorCode: primary.errorCode } : {}),
      ...(primary.errorMessage ? { gatewayErrorMessage: primary.errorMessage } : {}),
    };
  }

  const escalated = await invokeLane("escalation");
  if (escalated.dedupeKey) {
    return {
      key: await sha256Hex(escalated.dedupeKey),
      aiGatewayUsed: true,
      lane: "escalation",
      ...(escalated.model ? { model: escalated.model } : {}),
      escalationUsed: true,
      mediaUsed,
      mediaCount: mediaUrls.length,
    };
  }

  return {
    ...(await fallbackResult()),
    fallbackReason:
      escalated.errorCode ??
      primary.errorCode ??
      (escalated.status === undefined && primary.status === undefined
        ? "missing_dedupe_key"
        : `gateway_http_${escalated.status ?? primary.status}`),
    ...(escalated.status === undefined && primary.status === undefined
      ? {}
      : { gatewayStatus: escalated.status ?? primary.status }),
    ...(escalated.errorCode || primary.errorCode
      ? { gatewayErrorCode: escalated.errorCode ?? primary.errorCode }
      : {}),
    ...(escalated.errorMessage || primary.errorMessage
      ? { gatewayErrorMessage: escalated.errorMessage ?? primary.errorMessage }
      : {}),
  };
}

async function maybeAIGatewayCanonicalKey(args: {
  env: WorkerEnv;
  item: NewsItem;
}): Promise<{ key: string; aiGatewayUsed: boolean }> {
  const fallbackPayload = stableStringify({
    item: {
      id: args.item.id,
      title: args.item.title,
      url: args.item.url,
      summary: args.item.summary,
      source: args.item.source,
      publishedAtMs: args.item.publishedAtMs,
      severity: args.item.severity,
      region: args.item.region,
      category: args.item.category,
    },
  });

  return deriveDedupeKeyWithAi({ env: args.env, canonicalPayload: fallbackPayload });
}

async function deliverOutboundTargets(args: {
  env: WorkerEnv;
  items: NewsItem[];
  payload: OutboundPublishPayload;
}): Promise<{
  attempted: number;
  delivered: number;
  skippedDuplicate: number;
  failed: number;
  aiGatewayUsed: boolean;
  failures: Array<{ channel: string; status: number; error: string }>;
}> {
  const kv = args.env.USAGE_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new Error("USAGE_KV binding with get()/put() is required for outbound dedupe.");
  }
  const kvGet = kv.get.bind(kv);
  const kvPut = kv.put.bind(kv);

  let attempted = 0;
  let delivered = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  let aiGatewayUsed = false;
  const failures: Array<{ channel: string; status: number; error: string }> = [];
  const fingerprintByItemId = new Map<string, Promise<{ key: string; aiGatewayUsed: boolean }>>();

  const timeoutMs = normalizeDeliveryTimeoutMs(args.env.OUTBOUND_DELIVERY_TIMEOUT_MS);
  const pipelineConnections = normalizeAiPipelineMaxConnections(args.env.AI_PIPELINE_MAX_CONNECTIONS);
  const jobs: Array<{ item: NewsItem; target: OutboundTarget }> = [];
  for (const item of args.items) {
    for (const target of args.payload.targets) {
      jobs.push({ item, target });
    }
  }

  attempted = jobs.length;
  const requestSeenDedupeKeys = new Set<string>();
  const results = await mapWithConcurrency(jobs, pipelineConnections, async ({ item, target }) => {
    const itemCacheKey = item.id;
    let fingerprintPromise = fingerprintByItemId.get(itemCacheKey);
    if (!fingerprintPromise) {
      fingerprintPromise = maybeAIGatewayCanonicalKey({ env: args.env, item });
      fingerprintByItemId.set(itemCacheKey, fingerprintPromise);
    }
    const fingerprint = await fingerprintPromise;
    const dedupeKey = buildOutboundDedupeKey(args.env, args.payload.dedupeScope, target.channel, fingerprint.key);
    if (requestSeenDedupeKeys.has(dedupeKey)) {
      return {
        aiGatewayUsed: fingerprint.aiGatewayUsed,
        delivered: 0,
        skippedDuplicate: 1,
        failed: 0,
        failure: undefined as { channel: string; status: number; error: string } | undefined,
      };
    }
    requestSeenDedupeKeys.add(dedupeKey);

    let existing: string | null;
    try {
      existing = await kvGet(dedupeKey);
    } catch {
      return {
        aiGatewayUsed: fingerprint.aiGatewayUsed,
        delivered: 0,
        skippedDuplicate: 0,
        failed: 1,
        failure: {
          channel: target.channel,
          status: 0,
          error: "Outbound dedupe read failed.",
        },
      };
    }
    if (existing) {
      return {
        aiGatewayUsed: fingerprint.aiGatewayUsed,
        delivered: 0,
        skippedDuplicate: 1,
        failed: 0,
        failure: undefined as { channel: string; status: number; error: string } | undefined,
      };
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(target.endpointUrl, {
        method: target.method,
        headers: {
          "content-type": "application/json",
          ...target.headers,
        },
        body: JSON.stringify({
          event: "intel_dashboard_news_publish",
          channel: target.channel,
          dedupeKey,
          item,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          aiGatewayUsed: fingerprint.aiGatewayUsed,
          delivered: 0,
          skippedDuplicate: 0,
          failed: 1,
          failure: {
            channel: target.channel,
            status: response.status,
            error: `Outbound endpoint returned HTTP ${response.status}`,
          },
        };
      }

      await kvPut(
        dedupeKey,
        JSON.stringify({ channel: target.channel, itemId: item.id, deliveredAtMs: Date.now() }),
        { expirationTtl: args.payload.dedupeTtlSeconds },
      );

      return {
        aiGatewayUsed: fingerprint.aiGatewayUsed,
        delivered: 1,
        skippedDuplicate: 0,
        failed: 0,
        failure: undefined as { channel: string; status: number; error: string } | undefined,
      };
    } catch (error) {
      return {
        aiGatewayUsed: fingerprint.aiGatewayUsed,
        delivered: 0,
        skippedDuplicate: 0,
        failed: 1,
        failure: {
          channel: target.channel,
          status: 0,
          error: `Outbound delivery failed: ${String(error)}`,
        },
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  });

  for (const result of results) {
    aiGatewayUsed ||= result.aiGatewayUsed;
    delivered += result.delivered;
    skippedDuplicate += result.skippedDuplicate;
    failed += result.failed;
    if (result.failure) {
      failures.push(result.failure);
    }
  }

  return {
    attempted,
    delivered,
    skippedDuplicate,
    failed,
    aiGatewayUsed,
    failures,
  };
}

async function loadBillingAccount(env: WorkerEnv, userId: string): Promise<BillingAccount | null> {
  const kv = env.USAGE_KV;
  if (!kv) {
    return null;
  }
  const raw = await kv.get(buildBillingKey(env, userId));
  if (!raw) {
    return null;
  }
  try {
    const decoded = JSON.parse(raw) as unknown;
    return normalizeBillingAccount(decoded, userId, normalizeMonthlyPriceUsd(env.BILLING_MONTHLY_PRICE_USD));
  } catch {
    return null;
  }
}

async function saveBillingAccount(env: WorkerEnv, account: BillingAccount): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    throw new Error("USAGE_KV binding with put() is required for billing updates.");
  }
  await kv.put(buildBillingKey(env, account.userId), JSON.stringify(account));
  await Promise.all([
    deleteCachedCrmSummary(env),
    deleteCachedStripeCrmSummary(env),
    deleteCachedCrmCustomerStripeSnapshot(env, account.userId),
  ]);
}

function buildCrmStripeSummaryKey(env: WorkerEnv): string {
  return `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:crm:stripe-summary`;
}

function normalizeStripeCrmLiveSummary(value: unknown): StripeCrmLiveSummary | null {
  if (!isRecord(value) || value.live !== true || !isRecord(value.statuses)) {
    return null;
  }

  const source = value.source === "stripe_live" || value.source === "stripe_cache" ? value.source : null;
  const syncedAtMs = parseFiniteNumber(value.syncedAtMs);
  const subscriptionsTotal = parseFiniteNumber(value.subscriptionsTotal);
  const customersTotal = parseFiniteNumber(value.customersTotal);
  const mrrActiveUsd = parseFiniteNumber(value.mrrActiveUsd);
  const mrrBillableUsd = parseFiniteNumber(value.mrrBillableUsd);
  const arrActiveUsd = parseFiniteNumber(value.arrActiveUsd);
  const arrBillableUsd = parseFiniteNumber(value.arrBillableUsd);
  const apiBase = trimString(value.apiBase);
  if (
    !source ||
    syncedAtMs === undefined ||
    subscriptionsTotal === undefined ||
    customersTotal === undefined ||
    mrrActiveUsd === undefined ||
    mrrBillableUsd === undefined ||
    arrActiveUsd === undefined ||
    arrBillableUsd === undefined ||
    !apiBase
  ) {
    return null;
  }

  const statuses = createEmptyStripeCrmStatusCounts();
  for (const key of Object.keys(statuses) as Array<keyof StripeCrmStatusCounts>) {
    statuses[key] = Math.max(0, Math.floor(parseFiniteNumber(value.statuses[key]) ?? 0));
  }

  const currenciesRaw = Array.isArray(value.currencies) ? value.currencies : [];
  const currencies = currenciesRaw
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const currency = trimString(entry.currency);
      const mrrMonthly = parseFiniteNumber(entry.mrrMonthly);
      if (!currency || mrrMonthly === undefined) return null;
      return {
        currency,
        mrrMonthly: Number(mrrMonthly.toFixed(2)),
      };
    })
    .filter((entry): entry is { currency: string; mrrMonthly: number } => entry !== null);

  return {
    live: true,
    source,
    syncedAtMs: Math.max(0, Math.floor(syncedAtMs)),
    subscriptionsTotal: Math.max(0, Math.floor(subscriptionsTotal)),
    customersTotal: Math.max(0, Math.floor(customersTotal)),
    statuses,
    mrrActiveUsd: Number(mrrActiveUsd.toFixed(2)),
    mrrBillableUsd: Number(mrrBillableUsd.toFixed(2)),
    arrActiveUsd: Number(arrActiveUsd.toFixed(2)),
    arrBillableUsd: Number(arrBillableUsd.toFixed(2)),
    currencies,
    apiBase,
  };
}

async function loadCachedStripeCrmSummary(env: WorkerEnv): Promise<StripeCrmLiveSummary | null> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return null;
  }
  const raw = await kv.get(buildCrmStripeSummaryKey(env));
  if (!raw) {
    return null;
  }
  try {
    return normalizeStripeCrmLiveSummary(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function saveCachedStripeCrmSummary(env: WorkerEnv, summary: StripeCrmLiveSummary): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    return;
  }
  const ttlSeconds = normalizeCrmStripeCacheTtlSeconds(env.CRM_STRIPE_CACHE_TTL_SECONDS);
  await kv.put(buildCrmStripeSummaryKey(env), JSON.stringify(summary), {
    expirationTtl: ttlSeconds > 0 ? ttlSeconds * 3 : undefined,
  });
}

async function deleteCachedCrmSummary(env: WorkerEnv): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.delete !== "function") {
    return;
  }
  await kv.delete(buildCrmSummaryKey(env));
}

async function deleteCachedStripeCrmSummary(env: WorkerEnv): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.delete !== "function") {
    return;
  }
  await kv.delete(buildCrmStripeSummaryKey(env));
}

function buildCrmCustomerSnapshotKey(env: WorkerEnv, userId: string): string {
  return `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:crm:customer:${userId}`;
}

function normalizeCrmCustomerStripeSnapshot(value: unknown): CrmCustomerStripeSnapshot | null {
  if (!isRecord(value) || !isRecord(value.stripe) || !isRecord(value.stripe.customer)) {
    return null;
  }
  const fetchedAtMs = parseFiniteNumber(value.fetchedAtMs);
  const accountUpdatedAtMs = parseFiniteNumber(value.accountUpdatedAtMs);
  const customerId = trimString(value.stripe.customer.id);
  if (fetchedAtMs === undefined || accountUpdatedAtMs === undefined || !customerId) {
    return null;
  }

  const invoicesRaw = Array.isArray(value.stripe.invoices) ? value.stripe.invoices : [];
  const chargesRaw = Array.isArray(value.stripe.charges) ? value.stripe.charges : [];

  return {
    fetchedAtMs: Math.max(0, Math.floor(fetchedAtMs)),
    accountUpdatedAtMs: Math.max(0, Math.floor(accountUpdatedAtMs)),
    stripe: {
      customer: {
        id: customerId,
        email: trimString(value.stripe.customer.email) ?? null,
        name: trimString(value.stripe.customer.name) ?? null,
        currency: trimString(value.stripe.customer.currency) ?? "usd",
        delinquent: value.stripe.customer.delinquent === true,
        createdAtMs: Math.floor((parseFiniteNumber(value.stripe.customer.createdAtMs) ?? 0)) || null,
        balanceUsd: Number((parseFiniteNumber(value.stripe.customer.balanceUsd) ?? 0).toFixed(2)),
      },
      subscription: isRecord(value.stripe.subscription)
        ? {
            id: trimString(value.stripe.subscription.id) ?? null,
            status: trimString(value.stripe.subscription.status) ?? null,
            cancelAtPeriodEnd: value.stripe.subscription.cancelAtPeriodEnd === true,
            cancelAtMs: Math.floor((parseFiniteNumber(value.stripe.subscription.cancelAtMs) ?? 0)) || null,
            currentPeriodEndMs: Math.floor((parseFiniteNumber(value.stripe.subscription.currentPeriodEndMs) ?? 0)) || null,
            canceledAtMs: Math.floor((parseFiniteNumber(value.stripe.subscription.canceledAtMs) ?? 0)) || null,
          }
        : null,
      invoices: invoicesRaw
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const id = trimString(entry.id);
          const status = trimString(entry.status) ?? "unknown";
          const amountDueUsd = parseFiniteNumber(entry.amountDueUsd);
          const amountPaidUsd = parseFiniteNumber(entry.amountPaidUsd);
          const createdAtMs = parseFiniteNumber(entry.createdAtMs);
          if (!id || amountDueUsd === undefined || amountPaidUsd === undefined || createdAtMs === undefined) {
            return null;
          }
          return {
            id,
            status,
            amountDueUsd: Number(amountDueUsd.toFixed(2)),
            amountPaidUsd: Number(amountPaidUsd.toFixed(2)),
            paid: entry.paid === true,
            createdAtMs: Math.max(0, Math.floor(createdAtMs)),
            hostedInvoiceUrl: trimString(entry.hostedInvoiceUrl) ?? null,
            invoicePdf: trimString(entry.invoicePdf) ?? null,
          };
        })
        .filter((entry): entry is CrmCustomerStripeSnapshot["stripe"]["invoices"][number] => entry !== null),
      charges: chargesRaw
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const id = trimString(entry.id);
          const status = trimString(entry.status) ?? "unknown";
          const amountUsd = parseFiniteNumber(entry.amountUsd);
          const refundedUsd = parseFiniteNumber(entry.refundedUsd);
          const createdAtMs = parseFiniteNumber(entry.createdAtMs);
          if (!id || amountUsd === undefined || refundedUsd === undefined || createdAtMs === undefined) {
            return null;
          }
          return {
            id,
            status,
            amountUsd: Number(amountUsd.toFixed(2)),
            refundedUsd: Number(refundedUsd.toFixed(2)),
            paid: entry.paid === true,
            refunded: entry.refunded === true,
            createdAtMs: Math.max(0, Math.floor(createdAtMs)),
            receiptUrl: trimString(entry.receiptUrl) ?? null,
            paymentIntentId: trimString(entry.paymentIntentId) ?? null,
          };
        })
        .filter((entry): entry is CrmCustomerStripeSnapshot["stripe"]["charges"][number] => entry !== null),
    },
  };
}

async function loadCachedCrmCustomerStripeSnapshot(env: WorkerEnv, userId: string): Promise<CrmCustomerStripeSnapshot | null> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return null;
  }
  const raw = await kv.get(buildCrmCustomerSnapshotKey(env, userId));
  if (!raw) {
    return null;
  }
  try {
    return normalizeCrmCustomerStripeSnapshot(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function saveCachedCrmCustomerStripeSnapshot(env: WorkerEnv, userId: string, snapshot: CrmCustomerStripeSnapshot): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    return;
  }
  const ttlSeconds = normalizeCrmCustomerCacheTtlSeconds(env.CRM_CUSTOMER_CACHE_TTL_SECONDS);
  await kv.put(buildCrmCustomerSnapshotKey(env, userId), JSON.stringify(snapshot), {
    expirationTtl: ttlSeconds > 0 ? ttlSeconds * 3 : undefined,
  });
}

async function deleteCachedCrmCustomerStripeSnapshot(env: WorkerEnv, userId: string): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.delete !== "function") {
    return;
  }
  await kv.delete(buildCrmCustomerSnapshotKey(env, userId));
}

async function loadBillingActivityEvents(env: WorkerEnv, userId: string): Promise<BillingActivityEvent[]> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return [];
  }
  const raw = await kv.get(buildBillingActivityKey(env, userId));
  if (!raw) {
    return [];
  }
  try {
    const decoded = JSON.parse(raw) as unknown;
    if (!Array.isArray(decoded)) {
      return [];
    }
    return decoded
      .map((entry) => normalizeBillingActivityEvent(entry, userId))
      .filter((entry): entry is BillingActivityEvent => entry !== null)
      .sort((left, right) => right.atMs - left.atMs);
  } catch {
    return [];
  }
}

async function listKvKeyNamesByPrefix(args: {
  kv: KvLike;
  prefix: string;
  maxKeys: number;
}): Promise<string[]> {
  if (typeof args.kv.list !== "function") {
    return [];
  }

  const collected: string[] = [];
  let cursor: string | undefined;
  for (;;) {
    const remaining = args.maxKeys - collected.length;
    if (remaining <= 0) {
      break;
    }
    const page = await args.kv.list({
      prefix: args.prefix,
      cursor,
      limit: Math.min(100, remaining),
    });
    for (const key of page.keys) {
      const name = trimString(key.name);
      if (name) {
        collected.push(name);
      }
    }
    if (page.list_complete || !page.cursor || page.cursor === cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return collected;
}

async function loadCrmAccountSnapshots(env: WorkerEnv): Promise<CrmAccountSnapshot[]> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return [];
  }

  const prefix = `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:account:`;
  const keys = await listKvKeyNamesByPrefix({
    kv,
    prefix,
    maxKeys: 2500,
  });
  if (keys.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(keys.map(async (keyName) => {
    const userId = keyName.startsWith(prefix) ? keyName.slice(prefix.length) : "";
    if (!userId) {
      return null;
    }
    const raw = await kv.get(keyName);
    if (!raw) {
      return null;
    }
    try {
      const decoded = JSON.parse(raw) as unknown;
      const account = normalizeBillingAccount(decoded, userId, normalizeMonthlyPriceUsd(env.BILLING_MONTHLY_PRICE_USD));
      if (!account) {
        return null;
      }
      return {
        userId,
        status: account.status,
        monthlyPriceUsd: account.monthlyPriceUsd,
        updatedAtMs: account.updatedAtMs,
        ...(account.trialEndsAtMs === undefined ? {} : { trialEndsAtMs: account.trialEndsAtMs }),
      } satisfies CrmAccountSnapshot;
    } catch {
      return null;
    }
  }));

  return snapshots
    .filter((snapshot): snapshot is CrmAccountSnapshot => snapshot !== null)
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

async function summarizeCrmTelemetry(env: WorkerEnv): Promise<{
  telemetry: CrmTelemetrySummary;
  latestEvents: BillingActivityEvent[];
}> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return {
      telemetry: {
        events24h: 0,
        events7d: 0,
        uniqueUsers24h: 0,
        uniqueUsers7d: 0,
        trialStarts7d: 0,
        paidStarts7d: 0,
        cancellations7d: 0,
        cancellations30d: 0,
        topKinds7d: [],
      },
      latestEvents: [],
    };
  }

  const prefix = `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:activity:`;
  const keys = await listKvKeyNamesByPrefix({
    kv,
    prefix,
    maxKeys: 2500,
  });

  const nowMs = Date.now();
  const min24h = nowMs - DAY_MS;
  const min7d = nowMs - 7 * DAY_MS;
  const min30d = nowMs - 30 * DAY_MS;

  let events24h = 0;
  let events7d = 0;
  const users24h = new Set<string>();
  const users7d = new Set<string>();
  let trialStarts7d = 0;
  let paidStarts7d = 0;
  let cancellations7d = 0;
  let cancellations30d = 0;
  const kindCounts7d = new Map<string, number>();
  const latestEvents: BillingActivityEvent[] = [];

  await Promise.all(keys.map(async (keyName) => {
    const userId = keyName.startsWith(prefix) ? keyName.slice(prefix.length) : "";
    if (!userId) {
      return;
    }
    const events = await loadBillingActivityEvents(env, userId);
    for (const event of events) {
      latestEvents.push(event);
      if (event.atMs >= min24h) {
        events24h += 1;
        users24h.add(event.userId);
      }
      if (event.atMs >= min7d) {
        events7d += 1;
        users7d.add(event.userId);
        kindCounts7d.set(event.kind, (kindCounts7d.get(event.kind) ?? 0) + 1);
        if (event.kind === "trial_started" || event.kind === "trial_restarted") {
          trialStarts7d += 1;
        }
        if (
          event.kind === "subscription_set_active" ||
          event.kind === "stripe_checkout_completed" ||
          event.kind === "stripe_subscription_updated"
        ) {
          paidStarts7d += 1;
        }
        if (event.kind.includes("canceled") || event.kind.includes("deleted")) {
          cancellations7d += 1;
        }
      }
      if (event.atMs >= min30d && (event.kind.includes("canceled") || event.kind.includes("deleted"))) {
        cancellations30d += 1;
      }
    }
  }));

  latestEvents.sort((left, right) => right.atMs - left.atMs);
  const topKinds7d = [...kindCounts7d.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  return {
    telemetry: {
      events24h,
      events7d,
      uniqueUsers24h: users24h.size,
      uniqueUsers7d: users7d.size,
      trialStarts7d,
      paidStarts7d,
      cancellations7d,
      cancellations30d,
      topKinds7d,
    },
    latestEvents: latestEvents.slice(0, 60),
  };
}

type AiTelemetryWindowKey = "15m" | "1h" | "24h" | "7d" | "30d";

type AiTelemetrySummaryRow = {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  outputInputRatio: number;
  avgDurationMs: number;
  p95DurationMs: number;
  failures: number;
  cacheHits: number;
  cacheMisses: number;
};

type AiTelemetryBreakdownRow = {
  label: string;
  calls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  outputInputRatio: number;
  avgDurationMs: number;
  p95DurationMs: number;
  failures: number;
  cacheHits: number;
  cacheMisses: number;
};

type AiTelemetrySeriesRow = {
  bucket: string;
  calls: number;
  totalTokens: number;
  completionTokens: number;
};

function normalizeAiTelemetryWindow(value: unknown): {
  key: AiTelemetryWindowKey;
} {
  const normalized = trimString(value)?.toLowerCase();
  if (normalized === "15m") return { key: "15m" };
  if (normalized === "1h") return { key: "1h" };
  if (normalized === "7d") return { key: "7d" };
  if (normalized === "30d") return { key: "30d" };
  if (normalized === "24h") return { key: "24h" };
  return { key: "24h" };
}

function normalizeAiTelemetryDataset(rawValue: string | undefined): string {
  const value = trimString(rawValue) ?? "intel_dashboard_ai";
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error("AI_TELEMETRY_DATASET must be a valid Analytics Engine dataset name.");
  }
  return value;
}

async function queryAiTelemetrySql(env: WorkerEnv, sql: string): Promise<Record<string, unknown>[]> {
  const accountId = trimString(env.AI_TELEMETRY_QUERY_ACCOUNT_ID);
  const apiToken = trimString(env.AI_TELEMETRY_QUERY_API_TOKEN);
  if (!accountId || !apiToken) {
    throw new Error("AI telemetry query credentials are not configured.");
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiToken}`,
      "content-type": "text/plain",
    },
    body: sql,
    signal: AbortSignal.timeout(15_000),
  });

  const decoded = (await response.json().catch(() => null)) as unknown;
  const rows =
    isRecord(decoded) && Array.isArray(decoded.data)
      ? decoded.data
      : isRecord(decoded) && isRecord(decoded.result) && Array.isArray(decoded.result.data)
        ? decoded.result.data
        : [];
  if (!response.ok || !Array.isArray(rows)) {
    throw new Error(`Analytics Engine SQL query failed with HTTP ${response.status}.`);
  }
  return rows.filter((row): row is Record<string, unknown> => isRecord(row));
}

function buildAiTelemetrySummaryQuery(dataset: string, intervalSql: string): string {
  return `SELECT
    sum(_sample_interval) AS calls,
    sum(double3 * _sample_interval) AS prompt_tokens,
    sum(double4 * _sample_interval) AS completion_tokens,
    sum(double5 * _sample_interval) AS total_tokens,
    if(sum(double3 * _sample_interval) > 0, sum(double4 * _sample_interval) / sum(double3 * _sample_interval), 0) AS output_input_ratio,
    if(sum(_sample_interval) > 0, sum(double2 * _sample_interval) / sum(_sample_interval), 0) AS avg_duration_ms,
    quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_duration_ms,
    sum(double9 * _sample_interval) AS failures,
    sum(double11 * _sample_interval) AS cache_hits,
    sum(double12 * _sample_interval) AS cache_misses
  FROM ${dataset}
  WHERE timestamp > NOW() - INTERVAL ${intervalSql}`;
}

function buildAiTelemetryBreakdownQuery(args: {
  dataset: string;
  intervalSql: string;
  labelColumn: "blob3" | "blob4" | "blob6" | "blob7";
  limit?: number;
  orderBy?: "total_tokens" | "calls";
}): string {
  return `SELECT
    ${args.labelColumn} AS label,
    sum(_sample_interval) AS calls,
    sum(double5 * _sample_interval) AS total_tokens,
    sum(double3 * _sample_interval) AS prompt_tokens,
    sum(double4 * _sample_interval) AS completion_tokens,
    if(sum(double3 * _sample_interval) > 0, sum(double4 * _sample_interval) / sum(double3 * _sample_interval), 0) AS output_input_ratio,
    if(sum(_sample_interval) > 0, sum(double2 * _sample_interval) / sum(_sample_interval), 0) AS avg_duration_ms,
    quantileExactWeighted(0.95)(double2, _sample_interval) AS p95_duration_ms,
    sum(double9 * _sample_interval) AS failures,
    sum(double11 * _sample_interval) AS cache_hits,
    sum(double12 * _sample_interval) AS cache_misses
  FROM ${args.dataset}
  WHERE timestamp > NOW() - INTERVAL ${args.intervalSql}
  GROUP BY label
  ORDER BY ${args.orderBy ?? "calls"} DESC${args.limit ? ` LIMIT ${args.limit}` : ""}`;
}

function buildAiTelemetrySeriesQuery(dataset: string, intervalSql: string, bucketSql: string): string {
  return `SELECT
    toString(toStartOfInterval(timestamp, INTERVAL ${bucketSql})) AS bucket,
    sum(_sample_interval) AS calls,
    sum(double5 * _sample_interval) AS total_tokens,
    sum(double4 * _sample_interval) AS completion_tokens
  FROM ${dataset}
  WHERE timestamp > NOW() - INTERVAL ${intervalSql}
  GROUP BY bucket
  ORDER BY bucket`;
}

async function handleAdminCrmAiTelemetry(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  let userId: string;
  try {
    userId = await validateUserId(args.body, args.env);
  } catch (error) {
    return errorJson(400, error instanceof Error ? error.message : "Invalid request.");
  }
  if (!isOwnerUser(args.env, userId)) {
    return errorJson(403, "Forbidden.");
  }
  const body = isRecord(args.body) ? args.body : {};
  const window = normalizeAiTelemetryWindow(body.window);
  const dataset = normalizeAiTelemetryDataset(args.env.AI_TELEMETRY_DATASET);

  const intervalSqlByWindow: Record<AiTelemetryWindowKey, string> = {
    "15m": "15 MINUTE",
    "1h": "1 HOUR",
    "24h": "24 HOUR",
    "7d": "7 DAY",
    "30d": "30 DAY",
  };
  const bucketSqlByWindow: Record<AiTelemetryWindowKey, string> = {
    "15m": "1 MINUTE",
    "1h": "5 MINUTE",
    "24h": "1 HOUR",
    "7d": "6 HOUR",
    "30d": "1 DAY",
  };
  const intervalSql = intervalSqlByWindow[window.key];
  const bucketSql = bucketSqlByWindow[window.key];

  const queries = {
    summary: buildAiTelemetrySummaryQuery(dataset, intervalSql),
    lanes: buildAiTelemetryBreakdownQuery({ dataset, intervalSql, labelColumn: "blob3", orderBy: "total_tokens", limit: 8 }),
    models: buildAiTelemetryBreakdownQuery({ dataset, intervalSql, labelColumn: "blob4", orderBy: "total_tokens", limit: 8 }),
    outcomes: buildAiTelemetryBreakdownQuery({ dataset, intervalSql, labelColumn: "blob6", orderBy: "calls" }),
    cacheStatuses: buildAiTelemetryBreakdownQuery({ dataset, intervalSql, labelColumn: "blob7", orderBy: "calls" }),
    series: buildAiTelemetrySeriesQuery(dataset, intervalSql, bucketSql),
  } as const;

  try {
    const [summaryRows, laneRows, modelRows, outcomeRows, cacheRows, seriesRows] = await Promise.all([
      queryAiTelemetrySql(args.env, queries.summary),
      queryAiTelemetrySql(args.env, queries.lanes),
      queryAiTelemetrySql(args.env, queries.models),
      queryAiTelemetrySql(args.env, queries.outcomes),
      queryAiTelemetrySql(args.env, queries.cacheStatuses),
      queryAiTelemetrySql(args.env, queries.series),
    ]);

    const summarySource = summaryRows[0] ?? {};
    const summary: AiTelemetrySummaryRow = {
      calls: Math.max(0, Math.floor(parseFiniteNumber(summarySource.calls) ?? 0)),
      promptTokens: Math.max(0, Math.floor(parseFiniteNumber(summarySource.prompt_tokens) ?? 0)),
      completionTokens: Math.max(0, Math.floor(parseFiniteNumber(summarySource.completion_tokens) ?? 0)),
      totalTokens: Math.max(0, Math.floor(parseFiniteNumber(summarySource.total_tokens) ?? 0)),
      outputInputRatio: Number((parseFiniteNumber(summarySource.output_input_ratio) ?? 0).toFixed(4)),
      avgDurationMs: Number((parseFiniteNumber(summarySource.avg_duration_ms) ?? 0).toFixed(2)),
      p95DurationMs: Number((parseFiniteNumber(summarySource.p95_duration_ms) ?? 0).toFixed(2)),
      failures: Math.max(0, Math.floor(parseFiniteNumber(summarySource.failures) ?? 0)),
      cacheHits: Math.max(0, Math.floor(parseFiniteNumber(summarySource.cache_hits) ?? 0)),
      cacheMisses: Math.max(0, Math.floor(parseFiniteNumber(summarySource.cache_misses) ?? 0)),
    };

    const normalizeBreakdown = (rows: Record<string, unknown>[]): AiTelemetryBreakdownRow[] =>
      rows.map((row) => ({
        label: trimString(row.label) ?? "unknown",
        calls: Math.max(0, Math.floor(parseFiniteNumber(row.calls) ?? 0)),
        totalTokens: Math.max(0, Math.floor(parseFiniteNumber(row.total_tokens) ?? 0)),
        promptTokens: Math.max(0, Math.floor(parseFiniteNumber(row.prompt_tokens) ?? 0)),
        completionTokens: Math.max(0, Math.floor(parseFiniteNumber(row.completion_tokens) ?? 0)),
        outputInputRatio: Number((parseFiniteNumber(row.output_input_ratio) ?? 0).toFixed(4)),
        avgDurationMs: Number((parseFiniteNumber(row.avg_duration_ms) ?? 0).toFixed(2)),
        p95DurationMs: Number((parseFiniteNumber(row.p95_duration_ms) ?? 0).toFixed(2)),
        failures: Math.max(0, Math.floor(parseFiniteNumber(row.failures) ?? 0)),
        cacheHits: Math.max(0, Math.floor(parseFiniteNumber(row.cache_hits) ?? 0)),
        cacheMisses: Math.max(0, Math.floor(parseFiniteNumber(row.cache_misses) ?? 0)),
      }));

    const series: AiTelemetrySeriesRow[] = seriesRows.map((row) => ({
      bucket: trimString(row.bucket) ?? "",
      calls: Math.max(0, Math.floor(parseFiniteNumber(row.calls) ?? 0)),
      totalTokens: Math.max(0, Math.floor(parseFiniteNumber(row.total_tokens) ?? 0)),
      completionTokens: Math.max(0, Math.floor(parseFiniteNumber(row.completion_tokens) ?? 0)),
    }));

    return responseJson(200, {
      ok: true,
      result: {
        generatedAtMs: Date.now(),
        window: window.key,
        summary,
        lanes: normalizeBreakdown(laneRows),
        models: normalizeBreakdown(modelRows),
        outcomes: normalizeBreakdown(outcomeRows),
        cacheStatuses: normalizeBreakdown(cacheRows),
        series,
      },
    });
  } catch (error) {
    return errorJson(503, error instanceof Error ? error.message : "AI telemetry unavailable.");
  }
}

function createEmptyStripeCrmStatusCounts(): StripeCrmStatusCounts {
  return {
    active: 0,
    trialing: 0,
    pastDue: 0,
    unpaid: 0,
    canceled: 0,
    incomplete: 0,
    incompleteExpired: 0,
    paused: 0,
    other: 0,
  };
}

function normalizeStripeCrmStatus(rawStatus: unknown): keyof StripeCrmStatusCounts {
  const status = (trimString(rawStatus) ?? "").toLowerCase();
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due") return "pastDue";
  if (status === "unpaid") return "unpaid";
  if (status === "canceled") return "canceled";
  if (status === "incomplete") return "incomplete";
  if (status === "incomplete_expired") return "incompleteExpired";
  if (status === "paused") return "paused";
  return "other";
}

function normalizeStripeCustomerId(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = trimString(value);
    return normalized ?? null;
  }
  if (isRecord(value)) {
    const nested = trimString(value.id);
    return nested ?? null;
  }
  return null;
}

function normalizeStripeRecurringMonthlyAmount(args: {
  amount: number;
  interval: unknown;
  intervalCount: unknown;
}): number | null {
  const interval = (trimString(args.interval) ?? "").toLowerCase();
  const intervalCount = Math.max(1, Math.floor(parseFiniteNumber(args.intervalCount) ?? 1));
  if (interval === "month") {
    return args.amount / intervalCount;
  }
  if (interval === "year") {
    return args.amount / (12 * intervalCount);
  }
  if (interval === "week") {
    return args.amount * (52 / 12) / intervalCount;
  }
  if (interval === "day") {
    return args.amount * (365.2425 / 12) / intervalCount;
  }
  return null;
}

function normalizeStripeUnitAmount(value: unknown): number | null {
  const direct = parseFiniteNumber(value);
  if (direct !== undefined) {
    return direct;
  }
  const asString = trimString(value);
  if (!asString) {
    return null;
  }
  const parsed = Number(asString);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function collectStripeSubscriptionMrrByCurrency(subscription: Record<string, unknown>): Map<string, number> {
  const output = new Map<string, number>();
  const items = isRecord(subscription.items) && Array.isArray(subscription.items.data) ? subscription.items.data : [];
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.price)) {
      continue;
    }
    const price = item.price;
    const recurring = isRecord(price.recurring) ? price.recurring : {};
    const recurringMonthlyAmount = normalizeStripeRecurringMonthlyAmount({
      amount: 1,
      interval: recurring.interval,
      intervalCount: recurring.interval_count,
    });
    if (recurringMonthlyAmount === null) {
      continue;
    }
    const unitAmountMinor = normalizeStripeUnitAmount(price.unit_amount ?? price.unit_amount_decimal);
    if (unitAmountMinor === null) {
      continue;
    }
    const quantity = Math.max(1, Math.floor(parseFiniteNumber(item.quantity) ?? 1));
    const amountMonthly = (unitAmountMinor / 100) * quantity * recurringMonthlyAmount;
    const currency = (trimString(price.currency) ?? "usd").toLowerCase();
    output.set(currency, (output.get(currency) ?? 0) + amountMonthly);
  }
  return output;
}

async function fetchStripeLiveCrmSummary(env: WorkerEnv): Promise<
  | { ok: true; summary: StripeCrmLiveSummary }
  | { ok: false; error: string }
> {
  const stripeSecretKey = trimString(env.STRIPE_SECRET_KEY);
  if (!stripeSecretKey) {
    return { ok: false, error: "Stripe live sync unavailable: STRIPE_SECRET_KEY is not configured." };
  }

  const apiBase = (trimString(env.STRIPE_API_BASE_URL) ?? DEFAULT_STRIPE_API_BASE).replace(/\/+$/, "");
  const timeoutMs = normalizeCrmStripeSyncTimeoutMs(env.CRM_STRIPE_SYNC_TIMEOUT_MS);
  const maxSubscriptions = normalizeCrmStripeMaxSubscriptions(env.CRM_STRIPE_MAX_SUBSCRIPTIONS);
  const statusCounts = createEmptyStripeCrmStatusCounts();
  const uniqueCustomers = new Set<string>();
  const activeByCurrency = new Map<string, number>();
  const billableByCurrency = new Map<string, number>();
  let processed = 0;
  let hasMore = true;
  let startingAfter: string | null = null;

  while (hasMore && processed < maxSubscriptions) {
    const remaining = maxSubscriptions - processed;
    const pageLimit = Math.max(1, Math.min(100, remaining));
    const search = new URLSearchParams();
    search.set("status", "all");
    search.set("limit", String(pageLimit));
    if (startingAfter) {
      search.set("starting_after", startingAfter);
    }
    search.append("expand[]", "data.items.data.price");
    const url = `${apiBase}/v1/subscriptions?${search.toString()}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          authorization: `Bearer ${stripeSecretKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return {
        ok: false,
        error: `Stripe live sync request failed: ${String(error)}`,
      };
    }

    const rawBody = await response.text().catch(() => "");
    if (!response.ok) {
      return {
        ok: false,
        error: `Stripe live sync failed with HTTP ${response.status}${rawBody ? `: ${rawBody.slice(0, 240)}` : ""}`,
      };
    }

    let decoded: unknown;
    try {
      decoded = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return {
        ok: false,
        error: "Stripe live sync returned invalid JSON.",
      };
    }
    if (!isRecord(decoded) || !Array.isArray(decoded.data)) {
      return {
        ok: false,
        error: "Stripe live sync response missing data array.",
      };
    }

    let lastSubscriptionId: string | null = null;
    for (const entry of decoded.data) {
      if (!isRecord(entry)) {
        continue;
      }
      const subscriptionId = trimString(entry.id);
      if (subscriptionId) {
        lastSubscriptionId = subscriptionId;
      }

      const statusKey = normalizeStripeCrmStatus(entry.status);
      statusCounts[statusKey] += 1;
      processed += 1;

      const customerId = normalizeStripeCustomerId(entry.customer);
      if (customerId) {
        uniqueCustomers.add(customerId);
      }

      const subscriptionMrrByCurrency = collectStripeSubscriptionMrrByCurrency(entry);
      for (const [currency, amountMonthly] of subscriptionMrrByCurrency.entries()) {
        if (statusKey === "active") {
          activeByCurrency.set(currency, (activeByCurrency.get(currency) ?? 0) + amountMonthly);
        }
        if (statusKey === "active" || statusKey === "pastDue" || statusKey === "unpaid") {
          billableByCurrency.set(currency, (billableByCurrency.get(currency) ?? 0) + amountMonthly);
        }
      }

      if (processed >= maxSubscriptions) {
        break;
      }
    }

    hasMore = decoded.has_more === true && processed < maxSubscriptions;
    if (!hasMore) {
      break;
    }
    if (!lastSubscriptionId) {
      break;
    }
    startingAfter = lastSubscriptionId;
  }

  const roundCurrency = (value: number): number => Number(value.toFixed(2));
  const mrrActiveUsd = roundCurrency(activeByCurrency.get("usd") ?? 0);
  const mrrBillableUsd = roundCurrency(billableByCurrency.get("usd") ?? mrrActiveUsd);
  const currencies = [...billableByCurrency.entries()]
    .map(([currency, mrrMonthly]) => ({
      currency,
      mrrMonthly: roundCurrency(mrrMonthly),
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency));

  return {
    ok: true,
    summary: {
      live: true,
      source: "stripe_live",
      syncedAtMs: Date.now(),
      subscriptionsTotal: processed,
      customersTotal: uniqueCustomers.size,
      statuses: statusCounts,
      mrrActiveUsd,
      mrrBillableUsd,
      arrActiveUsd: roundCurrency(mrrActiveUsd * 12),
      arrBillableUsd: roundCurrency(mrrBillableUsd * 12),
      currencies,
      apiBase,
    },
  };
}

async function resolveStripeCrmSummary(env: WorkerEnv): Promise<
  | { live: StripeCrmLiveSummary; cacheHit: boolean }
  | { fallback: StripeCrmLiveFallback; cacheHit: boolean }
  | { none: true }
> {
  if (!isCrmStripeLiveEnabled(env) || !trimString(env.STRIPE_SECRET_KEY)) {
    return { none: true };
  }

  const nowMs = Date.now();
  const ttlMs = normalizeCrmStripeCacheTtlSeconds(env.CRM_STRIPE_CACHE_TTL_SECONDS) * 1000;
  const cached = await loadCachedStripeCrmSummary(env);
  if (cached && (ttlMs <= 0 || nowMs - cached.syncedAtMs <= ttlMs)) {
    return {
      live: {
        ...cached,
        source: "stripe_cache",
      },
      cacheHit: true,
    };
  }

  const stripeResult = await fetchStripeLiveCrmSummary(env);
  if (stripeResult.ok) {
    await saveCachedStripeCrmSummary(env, stripeResult.summary);
    return {
      live: stripeResult.summary,
      cacheHit: false,
    };
  }

  if (cached) {
    return {
      fallback: {
        live: false,
        source: "stripe_cache_stale",
        syncedAtMs: cached.syncedAtMs,
        error: stripeResult.error,
      },
      cacheHit: true,
    };
  }

  return {
    fallback: {
      live: false,
      source: "internal_snapshot",
      syncedAtMs: nowMs,
      error: stripeResult.error,
    },
    cacheHit: false,
  };
}

function normalizeOwnerActionTargetUserId(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }
  return trimString(body.targetUserId) ?? trimString(body.customerUserId) ?? null;
}

function normalizeStripeRefundReason(value: unknown): "requested_by_customer" | "duplicate" | "fraudulent" {
  const normalized = (trimString(value) ?? "requested_by_customer").toLowerCase();
  if (normalized === "duplicate") return "duplicate";
  if (normalized === "fraudulent") return "fraudulent";
  return "requested_by_customer";
}

async function resolveOwnerActionBillingContext(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<
  | {
      ok: true;
      actingUserId: string;
      targetUserId: string;
      account: BillingAccount;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
    }
  | {
      ok: false;
      response: Response;
    }
> {
  let actingUserId: string;
  try {
    actingUserId = await validateUserId(args.body, args.env);
  } catch (error) {
    return {
      ok: false,
      response: errorJson(400, error instanceof Error ? error.message : "Invalid request."),
    };
  }
  if (!isOwnerUser(args.env, actingUserId)) {
    return {
      ok: false,
      response: errorJson(403, "Forbidden."),
    };
  }

  const targetUserId = normalizeOwnerActionTargetUserId(args.body);
  if (!targetUserId) {
    return {
      ok: false,
      response: errorJson(400, "Expected non-empty targetUserId."),
    };
  }

  const account = await loadBillingAccount(args.env, targetUserId);
  if (!account) {
    return {
      ok: false,
      response: errorJson(404, "Billing account not found for target user."),
    };
  }

  return {
    ok: true,
    actingUserId,
    targetUserId,
    account,
    stripeCustomerId: trimString(account.stripeCustomerId) ?? null,
    stripeSubscriptionId: trimString(account.stripeSubscriptionId) ?? null,
  };
}

async function stripeApiJson(args: {
  env: WorkerEnv;
  method: "GET" | "POST" | "DELETE";
  path: string;
  form?: Record<string, string>;
  timeoutMs?: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const stripeSecretKey = trimString(args.env.STRIPE_SECRET_KEY);
  if (!stripeSecretKey) {
    return { ok: false, response: errorJson(500, "Stripe secret key is not configured.") };
  }
  const apiBase = (trimString(args.env.STRIPE_API_BASE_URL) ?? DEFAULT_STRIPE_API_BASE).replace(/\/+$/, "");
  const timeoutMs = args.timeoutMs ?? normalizeCrmStripeSyncTimeoutMs(args.env.CRM_STRIPE_SYNC_TIMEOUT_MS);
  const url = `${apiBase}${args.path.startsWith("/") ? args.path : `/${args.path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: args.method,
      headers: {
        authorization: `Bearer ${stripeSecretKey}`,
        ...(args.form ? { "content-type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(args.form ? { body: formEncode(args.form) } : {}),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    return {
      ok: false,
      response: errorJson(502, `Stripe request failed: ${String(error)}`),
    };
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    decoded = undefined;
  }
  if (!response.ok) {
    const message =
      isRecord(decoded) && isRecord(decoded.error) && typeof decoded.error.message === "string"
        ? decoded.error.message
        : `Stripe request failed with HTTP ${response.status}`;
    return { ok: false, response: errorJson(502, message) };
  }
  if (!isRecord(decoded)) {
    return { ok: false, response: errorJson(502, "Stripe returned invalid payload.") };
  }
  return { ok: true, data: decoded };
}

async function resolveStripeSubscriptionIdForTarget(args: {
  env: WorkerEnv;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  cachedSnapshot?: CrmCustomerStripeSnapshot | null;
}): Promise<string | null> {
  if (args.stripeSubscriptionId) {
    return args.stripeSubscriptionId;
  }
  if (args.cachedSnapshot?.stripe.subscription?.id) {
    return args.cachedSnapshot.stripe.subscription.id;
  }
  if (!args.stripeCustomerId) {
    return null;
  }
  const listResult = await stripeApiJson({
    env: args.env,
    method: "GET",
    path: `/v1/subscriptions?${new URLSearchParams({
      customer: args.stripeCustomerId,
      status: "all",
      limit: "1",
    }).toString()}`,
  });
  if (!listResult.ok) {
    return null;
  }
  const data = Array.isArray(listResult.data.data) ? listResult.data.data : [];
  const first = data.find((entry) => isRecord(entry)) as Record<string, unknown> | undefined;
  return first ? trimString(first.id) ?? null : null;
}

async function handleAdminCrmCustomer(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const context = await resolveOwnerActionBillingContext(args);
  if (!context.ok) {
    return context.response;
  }

  if (!context.stripeCustomerId) {
    return errorJson(409, "Target user has no Stripe customer id yet.");
  }
  const cachedSnapshot = await loadCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId);

  const subscriptionId =
    trimString((isRecord(args.body) ? args.body.subscriptionId : undefined)) ??
    (await resolveStripeSubscriptionIdForTarget({
      env: args.env,
      stripeCustomerId: context.stripeCustomerId,
      stripeSubscriptionId: context.stripeSubscriptionId,
      cachedSnapshot,
    }));

  const [customerResult, invoicesResult, chargesResult, subscriptionResult] = await Promise.all([
    stripeApiJson({
      env: args.env,
      method: "GET",
      path: `/v1/customers/${encodeURIComponent(context.stripeCustomerId)}`,
    }),
    stripeApiJson({
      env: args.env,
      method: "GET",
      path: `/v1/invoices?${new URLSearchParams({
        customer: context.stripeCustomerId,
        limit: "10",
      }).toString()}`,
    }),
    stripeApiJson({
      env: args.env,
      method: "GET",
      path: `/v1/charges?${new URLSearchParams({
        customer: context.stripeCustomerId,
        limit: "10",
      }).toString()}`,
    }),
    subscriptionId
      ? stripeApiJson({
          env: args.env,
          method: "GET",
          path: `/v1/subscriptions/${encodeURIComponent(subscriptionId)}?expand%5B%5D=default_payment_method`,
        })
      : Promise.resolve({ ok: true as const, data: null as unknown as Record<string, unknown> }),
  ]);

  if (!customerResult.ok) return customerResult.response;
  if (!invoicesResult.ok) return invoicesResult.response;
  if (!chargesResult.ok) return chargesResult.response;
  if (!subscriptionResult.ok) return subscriptionResult.response;

  const invoicesRaw = Array.isArray(invoicesResult.data.data) ? invoicesResult.data.data : [];
  const chargesRaw = Array.isArray(chargesResult.data.data) ? chargesResult.data.data : [];

  const invoices = invoicesRaw
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: trimString(entry.id) ?? "",
      status: trimString(entry.status) ?? "unknown",
      amountDueUsd: Number(((parseFiniteNumber(entry.amount_due) ?? 0) / 100).toFixed(2)),
      amountPaidUsd: Number(((parseFiniteNumber(entry.amount_paid) ?? 0) / 100).toFixed(2)),
      paid: entry.paid === true,
      createdAtMs: Math.floor((parseFiniteNumber(entry.created) ?? 0) * 1000),
      hostedInvoiceUrl: trimString(entry.hosted_invoice_url) ?? null,
      invoicePdf: trimString(entry.invoice_pdf) ?? null,
    }))
    .filter((entry) => entry.id.length > 0);

  const charges = chargesRaw
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: trimString(entry.id) ?? "",
      status: trimString(entry.status) ?? "unknown",
      amountUsd: Number(((parseFiniteNumber(entry.amount) ?? 0) / 100).toFixed(2)),
      refundedUsd: Number(((parseFiniteNumber(entry.amount_refunded) ?? 0) / 100).toFixed(2)),
      paid: entry.paid === true,
      refunded: entry.refunded === true,
      createdAtMs: Math.floor((parseFiniteNumber(entry.created) ?? 0) * 1000),
      receiptUrl: trimString(entry.receipt_url) ?? null,
      paymentIntentId: trimString(entry.payment_intent) ?? null,
    }))
    .filter((entry) => entry.id.length > 0);

  const subscription = subscriptionResult.data
    ? {
        id: trimString(subscriptionResult.data.id) ?? subscriptionId ?? null,
        status: trimString(subscriptionResult.data.status) ?? null,
        cancelAtPeriodEnd: subscriptionResult.data.cancel_at_period_end === true,
        cancelAtMs: Math.floor((parseFiniteNumber(subscriptionResult.data.cancel_at) ?? 0) * 1000) || null,
        currentPeriodEndMs: Math.floor((parseFiniteNumber(subscriptionResult.data.current_period_end) ?? 0) * 1000) || null,
        canceledAtMs: Math.floor((parseFiniteNumber(subscriptionResult.data.canceled_at) ?? 0) * 1000) || null,
      }
    : null;

  const snapshot: CrmCustomerStripeSnapshot = {
    fetchedAtMs: Date.now(),
    accountUpdatedAtMs: context.account.updatedAtMs,
    stripe: {
      customer: {
        id: trimString(customerResult.data.id) ?? context.stripeCustomerId,
        email: trimString(customerResult.data.email) ?? null,
        name: trimString(customerResult.data.name) ?? null,
        currency: trimString(customerResult.data.currency) ?? "usd",
        delinquent: customerResult.data.delinquent === true,
        createdAtMs: Math.floor((parseFiniteNumber(customerResult.data.created) ?? 0) * 1000) || null,
        balanceUsd: Number(((parseFiniteNumber(customerResult.data.balance) ?? 0) / 100).toFixed(2)),
      },
      subscription,
      invoices,
      charges,
    },
  };
  await saveCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId, snapshot);

  return responseJson(200, {
    ok: true,
    result: {
      targetUserId: context.targetUserId,
      account: context.account,
      stripe: snapshot.stripe,
    },
  });
}

async function handleAdminCrmCancelSubscription(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const context = await resolveOwnerActionBillingContext(args);
  if (!context.ok) {
    return context.response;
  }
  if (!context.stripeCustomerId) {
    return errorJson(409, "Target user has no Stripe customer id yet.");
  }

  const body = isRecord(args.body) ? args.body : {};
  const atPeriodEnd = body.atPeriodEnd !== false;
  const cachedSnapshot = await loadCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId);
  const subscriptionId =
    trimString(body.subscriptionId) ??
    (await resolveStripeSubscriptionIdForTarget({
      env: args.env,
      stripeCustomerId: context.stripeCustomerId,
      stripeSubscriptionId: context.stripeSubscriptionId,
      cachedSnapshot,
    }));
  if (!subscriptionId) {
    return errorJson(409, "No Stripe subscription id was found for this customer.");
  }

  const stripeResult = atPeriodEnd
    ? await stripeApiJson({
        env: args.env,
        method: "POST",
        path: `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
        form: {
          cancel_at_period_end: "true",
        },
      })
    : await stripeApiJson({
        env: args.env,
        method: "DELETE",
        path: `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      });
  if (!stripeResult.ok) {
    return stripeResult.response;
  }

  const nowMs = Date.now();
  const stripeStatus = trimString(stripeResult.data.status);
  const mappedStatus = atPeriodEnd ? context.account.status : mapStripeSubscriptionStatus(stripeStatus);
  const next: BillingAccount = {
    ...context.account,
    status: mappedStatus,
    ...(atPeriodEnd ? {} : { canceledAtMs: nowMs }),
    stripeCustomerId: context.stripeCustomerId,
    stripeSubscriptionId: subscriptionId,
    updatedAtMs: nowMs,
  };
  await saveBillingAccount(args.env, next);
  await appendBillingActivityEvent({
    env: args.env,
    userId: context.targetUserId,
    kind: atPeriodEnd ? "admin_cancel_at_period_end" : "admin_cancel_immediately",
    source: "api",
    status: next.status,
    note: atPeriodEnd
      ? `Owner ${context.actingUserId} scheduled cancellation at period end.`
      : `Owner ${context.actingUserId} canceled subscription immediately.`,
    atMs: nowMs,
  });
  await deleteCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId);

  return responseJson(200, {
    ok: true,
    result: {
      targetUserId: context.targetUserId,
      subscriptionId,
      atPeriodEnd,
      status: trimString(stripeResult.data.status) ?? next.status,
      canceled: stripeResult.data.canceled === true || !atPeriodEnd,
      cancelAtMs: Math.floor((parseFiniteNumber(stripeResult.data.cancel_at) ?? 0) * 1000) || null,
      currentPeriodEndMs: Math.floor((parseFiniteNumber(stripeResult.data.current_period_end) ?? 0) * 1000) || null,
      updatedAtMs: nowMs,
    },
  });
}

async function handleAdminCrmRefund(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const context = await resolveOwnerActionBillingContext(args);
  if (!context.ok) {
    return context.response;
  }
  if (!context.stripeCustomerId) {
    return errorJson(409, "Target user has no Stripe customer id yet.");
  }

  const body = isRecord(args.body) ? args.body : {};
  let chargeId = trimString(body.chargeId) ?? null;
  const paymentIntentId = trimString(body.paymentIntentId) ?? null;
  const cachedSnapshot = await loadCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId);
  if (!chargeId && !paymentIntentId) {
    chargeId = cachedSnapshot?.stripe.charges[0]?.id ?? null;
    if (!chargeId) {
      const latestCharge = await stripeApiJson({
        env: args.env,
        method: "GET",
        path: `/v1/charges?${new URLSearchParams({
          customer: context.stripeCustomerId,
          limit: "1",
        }).toString()}`,
      });
      if (!latestCharge.ok) {
        return latestCharge.response;
      }
      const first = Array.isArray(latestCharge.data.data)
        ? latestCharge.data.data.find((entry) => isRecord(entry)) as Record<string, unknown> | undefined
        : undefined;
      chargeId = first ? trimString(first.id) ?? null : null;
    }
  }
  if (!chargeId && !paymentIntentId) {
    return errorJson(409, "No refundable Stripe charge/payment intent was found.");
  }

  const amountUsd = parseFiniteNumber(body.amountUsd);
  const amountCents = amountUsd === undefined ? null : Math.max(1, Math.floor(amountUsd * 100));
  const reason = normalizeStripeRefundReason(body.reason);
  const refundResult = await stripeApiJson({
    env: args.env,
    method: "POST",
    path: "/v1/refunds",
    form: {
      ...(chargeId ? { charge: chargeId } : {}),
      ...(paymentIntentId ? { payment_intent: paymentIntentId } : {}),
      ...(amountCents ? { amount: String(amountCents) } : {}),
      reason,
      "metadata[source]": "owner_crm",
      "metadata[target_user_id]": context.targetUserId,
      "metadata[owner_user_id]": context.actingUserId,
    },
  });
  if (!refundResult.ok) {
    return refundResult.response;
  }

  const nowMs = Date.now();
  const refundId = trimString(refundResult.data.id) ?? null;
  const refundAmountUsd = Number(((parseFiniteNumber(refundResult.data.amount) ?? 0) / 100).toFixed(2));
  await appendBillingActivityEvent({
    env: args.env,
    userId: context.targetUserId,
    kind: "admin_refund_created",
    source: "api",
    status: context.account.status,
    note: `Owner ${context.actingUserId} created Stripe refund ${refundId ?? "unknown"} for $${refundAmountUsd.toFixed(2)}.`,
    atMs: nowMs,
  });
  await deleteCachedCrmCustomerStripeSnapshot(args.env, context.targetUserId);

  return responseJson(200, {
    ok: true,
    result: {
      targetUserId: context.targetUserId,
      refundId,
      status: trimString(refundResult.data.status) ?? "unknown",
      amountUsd: refundAmountUsd,
      chargeId: trimString(refundResult.data.charge) ?? chargeId,
      paymentIntentId: trimString(refundResult.data.payment_intent) ?? paymentIntentId,
      reason: trimString(refundResult.data.reason) ?? reason,
      createdAtMs: Math.floor((parseFiniteNumber(refundResult.data.created) ?? 0) * 1000) || nowMs,
    },
  });
}

async function appendBillingActivityEvent(args: {
  env: WorkerEnv;
  userId: string;
  kind: string;
  source?: "api" | "stripe";
  status?: BillingStatus | "owner";
  stripeEventId?: string;
  stripeEventType?: string;
  note?: string;
  atMs?: number;
}): Promise<void> {
  const kv = args.env.USAGE_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return;
  }
  try {
    const activityKey = buildBillingActivityKey(args.env, args.userId);
    const existing = await loadBillingActivityEvents(args.env, args.userId);
    const atMs = Math.max(0, Math.floor(args.atMs ?? Date.now()));
    const event: BillingActivityEvent = {
      id: crypto.randomUUID(),
      userId: args.userId,
      atMs,
      kind: normalizeBillingActivityKind(args.kind),
      source: args.source ?? "api",
      ...(args.status ? { status: args.status } : {}),
      ...(trimString(args.stripeEventId) ? { stripeEventId: trimString(args.stripeEventId)! } : {}),
      ...(trimString(args.stripeEventType) ? { stripeEventType: trimString(args.stripeEventType)! } : {}),
      ...(trimString(args.note) ? { note: trimString(args.note)! } : {}),
    };
    const maxEvents = normalizeBillingActivityHistoryLimit(args.env.BILLING_ACTIVITY_HISTORY_LIMIT);
    const next = [event, ...existing]
      .sort((left, right) => right.atMs - left.atMs)
      .slice(0, maxEvents);
    await kv.put(activityKey, JSON.stringify(next));
  } catch {
    // billing activity writes are best-effort and should not block entitlements
  }
}

async function validateUserId(payload: unknown, env?: WorkerEnv): Promise<string> {
  if (!isRecord(payload)) {
    throw new Error("Expected params object.");
  }
  const userId = trimString(payload.userId);
  if (!userId) {
    throw new Error("Expected non-empty userId.");
  }

  if (env && normalizeBoolean(env.REQUIRE_SIGNED_USER_ID, false)) {
    const secret = trimString(env.USER_ID_SIGNING_SECRET);
    if (!secret) {
      throw new Error("User signature verification is enabled but USER_ID_SIGNING_SECRET is missing.");
    }
    const providedSignature = trimString(payload.userSig) ?? trimString(payload.userSignature);
    if (!providedSignature) {
      throw new Error("Expected userSig for signed user identity verification.");
    }
    const expectedSignature = await hmacSha256Hex(secret, userId);
    if (!constantTimeEqualHex(providedSignature.toLowerCase(), expectedSignature)) {
      throw new Error("Invalid userSig for userId.");
    }
  }

  return userId;
}

async function readNewsFeedFromStorageKey(env: WorkerEnv, storageKey: string): Promise<NewsItem[]> {
  const kv = env.USAGE_KV;
  if (!kv) {
    return [];
  }
  const cacheKey = resolveNewsFeedCacheKey(env, storageKey);
  const cacheTtlMs = normalizeNewsReadCacheMs(env.NEWS_READ_CACHE_MS);
  const cacheEntry = newsFeedMemoryCache.get(cacheKey);
  const nowMs = Date.now();
  if (cacheTtlMs > 0 && cacheEntry && nowMs - cacheEntry.cachedAtMs <= cacheTtlMs) {
    return cacheEntry.items;
  }

  const raw = await kv.get(storageKey);
  if (!raw) {
    if (cacheTtlMs > 0) {
      newsFeedMemoryCache.set(cacheKey, { cachedAtMs: nowMs, items: [] });
    }
    return [];
  }
  try {
    const normalized = normalizeNewsItems(JSON.parse(raw));
    const trimmed = normalized.slice(0, normalizeNewsFeedMaxItems(env.NEWS_FEED_MAX_ITEMS));
    if (cacheTtlMs > 0) {
      newsFeedMemoryCache.set(cacheKey, { cachedAtMs: nowMs, items: trimmed });
    }
    return trimmed;
  } catch {
    return [];
  }
}

async function readNewsFeed(env: WorkerEnv): Promise<NewsItem[]> {
  const storageKeys = resolveNewsFeedStorageKeysForRead(env);
  const maxFeedItems = normalizeNewsFeedMaxItems(env.NEWS_FEED_MAX_ITEMS);
  const cacheTtlMs = normalizeNewsReadCacheMs(env.NEWS_READ_CACHE_MS);

  if (storageKeys.length <= 1) {
    return readNewsFeedFromStorageKey(env, storageKeys[0]);
  }

  const mergedCacheKey = `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:news-merged:${storageKeys.join("|")}:${maxFeedItems}`;
  const nowMs = Date.now();
  const mergedEntry = newsFeedMergedMemoryCache.get(mergedCacheKey);
  if (cacheTtlMs > 0 && mergedEntry && nowMs - mergedEntry.cachedAtMs <= cacheTtlMs) {
    return mergedEntry.items;
  }

  const shardFeeds = await Promise.all(
    storageKeys.map((storageKey) => readNewsFeedFromStorageKey(env, storageKey)),
  );

  let merged: NewsItem[] = [];
  for (const shardFeed of shardFeeds) {
    merged = mergeNewsStreamsDescending(merged, shardFeed, maxFeedItems);
  }
  if (cacheTtlMs > 0) {
    newsFeedMergedMemoryCache.set(mergedCacheKey, {
      cachedAtMs: nowMs,
      items: merged,
    });
  }
  return merged;
}

async function writeNewsFeed(env: WorkerEnv, items: NewsItem[], storageKey?: string): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    throw new Error("USAGE_KV binding with put() is required for news writes.");
  }
  const targetStorageKey = storageKey ?? resolveNewsFeedStorageKey(env);
  const cacheKey = resolveNewsFeedCacheKey(env, targetStorageKey);
  const trimmed = items.slice(0, normalizeNewsFeedMaxItems(env.NEWS_FEED_MAX_ITEMS));
  await kv.put(targetStorageKey, JSON.stringify(trimmed));
  newsFeedMemoryCache.set(cacheKey, {
    cachedAtMs: Date.now(),
    items: trimmed,
  });
  newsFeedMergedMemoryCache.clear();
  newsHotOverlayMemoryCache.clear();
}

function mergeNewsStreamsDescending(primary: NewsItem[], secondary: NewsItem[], maxItems: number): NewsItem[] {
  const output: NewsItem[] = [];
  const seen = new Set<string>();
  let primaryIndex = 0;
  let secondaryIndex = 0;

  while (output.length < maxItems && (primaryIndex < primary.length || secondaryIndex < secondary.length)) {
    const primaryItem = primary[primaryIndex];
    const secondaryItem = secondary[secondaryIndex];

    let candidate: NewsItem | undefined;
    if (primaryItem && secondaryItem) {
      if (primaryItem.publishedAtMs >= secondaryItem.publishedAtMs) {
        candidate = primaryItem;
        primaryIndex += 1;
      } else {
        candidate = secondaryItem;
        secondaryIndex += 1;
      }
    } else if (primaryItem) {
      candidate = primaryItem;
      primaryIndex += 1;
    } else if (secondaryItem) {
      candidate = secondaryItem;
      secondaryIndex += 1;
    }

    if (!candidate) {
      continue;
    }
    const identityKeys = buildNewsIdentityKeys(candidate);
    if (identityKeys.some((key) => seen.has(key))) {
      continue;
    }
    for (const key of identityKeys) {
      seen.add(key);
    }
    output.push(candidate);
  }

  return output;
}

async function publishNewsFeed(args: {
  env: WorkerEnv;
  inputItems: NewsItem[];
  merge: boolean;
  shardName?: string;
}): Promise<NewsPublishMergeResult> {
  const maxFeedItems = normalizeNewsFeedMaxItems(args.env.NEWS_FEED_MAX_ITEMS);
  const storageKey = resolveNewsFeedStorageKey(args.env, args.shardName);
  const minRetentionMs = Date.now() - NEWS_FEED_RETENTION_HOURS * 60 * 60 * 1000;
  const existing = args.merge
    ? (await readNewsFeedFromStorageKey(args.env, storageKey))
      .filter((item) => item.publishedAtMs >= minRetentionMs)
      .slice(0, maxFeedItems)
    : [];
  const inputItems = args.inputItems.filter((item) => item.publishedAtMs >= minRetentionMs);
  const merged = mergeNewsStreamsDescending(inputItems, existing, maxFeedItems);
  await writeNewsFeed(args.env, merged, storageKey);
  return {
    published: inputItems.length,
    totalStored: merged.length,
    merged: args.merge,
  };
}

async function publishNewsWithCoordinator(args: {
  env: WorkerEnv;
  inputItems: NewsItem[];
  merge: boolean;
  shardKey?: string;
}): Promise<NewsPublishMergeResult> {
  const shardKey = trimString(args.shardKey) ?? deriveNewsShardKey(args.inputItems);
  const coordinatorName = resolveNewsCoordinatorShardName(args.env, shardKey);
  const shardCount = normalizeNewsCoordinatorShardCount(args.env.NEWS_COORDINATOR_SHARD_COUNT);
  const allowFallback = normalizeBoolean(
    args.env.NEWS_COORDINATOR_ALLOW_FALLBACK,
    DEFAULT_NEWS_COORDINATOR_ALLOW_FALLBACK && shardCount <= 1,
  );
  const coordinatorEnabled = normalizeBoolean(
    args.env.NEWS_COORDINATOR_ENABLED,
    DEFAULT_NEWS_COORDINATOR_ENABLED,
  );
  const namespace = args.env.NEWS_INGEST_COORDINATOR;
  if (!coordinatorEnabled || !namespace) {
    if (!allowFallback) {
      throw new Error("News coordinator is required but unavailable.");
    }
    return publishNewsFeed({
      ...args,
      shardName: coordinatorName,
    });
  }

  try {
    const objectId = namespace.idFromName(coordinatorName);
    const stub = namespace.get(objectId);
    const response = await stub.fetch("https://news-ingest.internal/publish", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        entries: args.inputItems,
        merge: args.merge,
        shardName: coordinatorName,
      }),
    });
    if (!response.ok) {
      throw new Error(`Coordinator returned HTTP ${response.status}`);
    }

    const decoded = (await response.json()) as unknown;
    if (!isRecord(decoded) || decoded.ok !== true || !isRecord(decoded.result)) {
      throw new Error("Coordinator returned invalid payload.");
    }

    const published = parseFiniteNumber(decoded.result.published);
    const totalStored = parseFiniteNumber(decoded.result.totalStored);
    if (published === undefined || totalStored === undefined) {
      throw new Error("Coordinator result is missing publish counters.");
    }

    return {
      published: Math.max(0, Math.floor(published)),
      totalStored: Math.max(0, Math.floor(totalStored)),
      merged: decoded.result.merged !== false,
    };
  } catch {
    if (!allowFallback) {
      throw new Error("News coordinator failed and fallback is disabled.");
    }
    return publishNewsFeed({
      ...args,
      shardName: coordinatorName,
    });
  }
}

async function readCoordinatorHotFeed(env: WorkerEnv, limit: number): Promise<NewsItem[]> {
  const hotOverlayEnabled = normalizeBoolean(
    env.NEWS_HOT_OVERLAY_ENABLED,
    DEFAULT_NEWS_HOT_OVERLAY_ENABLED,
  );
  const namespace = env.NEWS_INGEST_COORDINATOR;
  if (!hotOverlayEnabled || !namespace || limit < 1) {
    return [];
  }

  const shardNames = resolveNewsCoordinatorShardNamesForOverlay(env);
  const maxLimit = normalizeNewsHotOverlayLimit(env.NEWS_HOT_OVERLAY_LIMIT);
  const finalLimit = Math.min(limit, maxLimit);
  const perShardLimit = Math.max(1, Math.ceil(finalLimit / Math.max(1, shardNames.length)) + 2);
  const overlayCacheTtlMs = normalizeNewsHotOverlayCacheMs(env.NEWS_HOT_OVERLAY_CACHE_MS);
  const overlayCacheKey = `${normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX)}:news-hot:${shardNames.join("|")}:${finalLimit}:${perShardLimit}`;
  const cached = newsHotOverlayMemoryCache.get(overlayCacheKey);
  const nowMs = Date.now();
  if (overlayCacheTtlMs > 0 && cached && nowMs - cached.cachedAtMs <= overlayCacheTtlMs) {
    return cached.items;
  }

  const results = await Promise.all(
    shardNames.map(async (coordinatorName) => {
      const timeoutMs = normalizeNewsHotOverlayTimeoutMs(env.NEWS_HOT_OVERLAY_TIMEOUT_MS);
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const objectId = namespace.idFromName(coordinatorName);
        const stub = namespace.get(objectId);
        const response = await stub.fetch(
          `https://news-ingest.internal/hot?limit=${encodeURIComponent(String(perShardLimit))}`,
          {
            method: "GET",
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          return [] as NewsItem[];
        }

        const decoded = (await response.json()) as unknown;
        if (
          !isRecord(decoded) ||
          decoded.ok !== true ||
          !isRecord(decoded.result) ||
          !Array.isArray(decoded.result.items)
        ) {
          return [] as NewsItem[];
        }

        return normalizeNewsItems(decoded.result.items).slice(0, perShardLimit);
      } catch {
        return [] as NewsItem[];
      } finally {
        clearTimeout(timeoutHandle);
      }
    }),
  );

  let merged: NewsItem[] = [];
  for (const shardItems of results) {
    merged = mergeNewsStreamsDescending(merged, shardItems, finalLimit);
  }
  const output = merged.slice(0, finalLimit);
  if (overlayCacheTtlMs > 0) {
    newsHotOverlayMemoryCache.set(overlayCacheKey, {
      cachedAtMs: nowMs,
      items: output,
    });
  }
  return output;
}

function resolveNewsFeedCacheKey(env: WorkerEnv, storageKey?: string): string {
  const baseKey = storageKey ?? resolveNewsFeedStorageKey(env);
  const kvBinding = env.USAGE_KV;
  if (!kvBinding || typeof kvBinding !== "object") {
    return `none:${baseKey}`;
  }

  let bindingId = kvBindingCacheIds.get(kvBinding as object);
  if (!bindingId) {
    kvBindingCacheIdCounter += 1;
    bindingId = String(kvBindingCacheIdCounter);
    kvBindingCacheIds.set(kvBinding as object, bindingId);
  }
  return `${bindingId}:${baseKey}`;
}

function findFirstUnlockedIndexDescending(items: NewsItem[], cutoffMs: number): number {
  let left = 0;
  let right = items.length - 1;
  let answer = -1;
  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    if (items[middle].publishedAtMs <= cutoffMs) {
      answer = middle;
      right = middle - 1;
    } else {
      left = middle + 1;
    }
  }
  return answer;
}

function responseJson(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "geolocation=(), camera=(), microphone=()",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
      "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://github.com https://x.com https://twitter.com",
    },
  });
}

function applyDefaultSecurityHeaders(response: Response): Response {
  const defaults: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(), camera=(), microphone=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-src 'self' https://challenges.cloudflare.com; media-src 'self' data: blob: https:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self' https://github.com https://x.com https://twitter.com",
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (!response.headers.has(name)) {
      response.headers.set(name, value);
    }
  }
  return response;
}

function errorJson(status: number, message: string): Response {
  return responseJson(status, { ok: false, error: message });
}

function errorJsonWithHeaders(status: number, message: string, headers: Record<string, string>): Response {
  const response = errorJson(status, message);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  return Boolean(contentType && contentType.toLowerCase().includes("application/json"));
}

function readContentLength(request: Request): number | undefined {
  const raw = request.headers.get("content-length");
  const value = parseFiniteNumber(raw);
  if (value === undefined || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

async function parseJsonRequestBody(
  request: Request,
  maxRequestBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  if (!isJsonRequest(request)) {
    return { ok: false, response: errorJson(415, "Content-Type must be application/json.") };
  }

  const contentLength = readContentLength(request);
  if (contentLength !== undefined && contentLength > maxRequestBytes) {
    return { ok: false, response: errorJson(413, `Request body exceeds ${maxRequestBytes} bytes.`) };
  }

  const raw = await readRequestBodyWithLimit(request, maxRequestBytes);
  if (!raw.ok) {
    return raw;
  }
  const rawBody = raw.rawBody;

  try {
    return { ok: true, body: JSON.parse(rawBody) };
  } catch {
    return { ok: false, response: errorJson(400, "Invalid JSON body.") };
  }
}

function parseBearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }
  return trimString(token);
}

function getDefaultCache(): Cache | null {
  if (typeof caches === "undefined") {
    return null;
  }
  return "default" in caches ? (caches as CacheStorage & { default?: Cache }).default ?? null : null;
}

function shouldSample(rate: number): boolean {
  if (rate <= 0) {
    return false;
  }
  if (rate >= 1) {
    return true;
  }
  const randomBytes = new Uint32Array(1);
  crypto.getRandomValues(randomBytes);
  return randomBytes[0] / 0x1_0000_0000 <= rate;
}

function writeUsageAnalytics(args: {
  env: WorkerEnv;
  path: string;
  method: string;
  rpcMethod: string;
  mode: string;
  cacheHit: boolean;
  status: number;
  durationMs: number;
  outcome: string;
  extraDoubles?: number[];
}): void {
  const analytics = args.env.USAGE_ANALYTICS;
  if (!analytics || typeof analytics.writeDataPoint !== "function") {
    return;
  }

  const sampleRate = normalizeSampleRate(args.env.USAGE_ANALYTICS_SAMPLE_RATE);
  if (!shouldSample(sampleRate)) {
    return;
  }

  try {
    analytics.writeDataPoint({
      indexes: [new Date().toISOString().slice(0, 10)],
      blobs: [
        args.path,
        args.method,
        args.rpcMethod,
        args.mode,
        args.outcome,
        args.cacheHit ? "cache-hit" : "cache-miss",
      ],
      doubles: [args.status, args.durationMs, ...(args.extraDoubles ?? [])],
    });
  } catch {
    // best-effort analytics; never break request path
  }
}

function normalizeAiCacheStatus(value: string | null): string {
  const normalized = trimString(value)?.toLowerCase();
  if (!normalized) return "unknown";
  if (normalized.includes("hit")) return "hit";
  if (normalized.includes("miss")) return "miss";
  if (normalized.includes("bypass")) return "bypass";
  return normalized;
}

function normalizeAiTokenCount(value: unknown): number {
  const parsed = parseFiniteNumber(value);
  return parsed === undefined ? 0 : Math.max(0, Math.floor(parsed));
}

function readOptionalAiTokenCount(value: unknown): number | null {
  const parsed = parseFiniteNumber(value);
  return parsed === undefined ? null : Math.max(0, Math.floor(parsed));
}

function resolveAiProvider(model: string): string {
  return trimString(model.split("/")[0]) ?? "unknown";
}

function normalizeAiMediaCount(value: unknown): number {
  const normalized = trimString(value);
  if (!normalized) return 0;
  if (normalized.toLowerCase() === "true") return 1;
  if (normalized.toLowerCase() === "false") return 0;
  const parsed = parseFiniteNumber(normalized);
  return parsed === undefined ? 0 : Math.max(0, Math.floor(parsed));
}

function writeAiTelemetry(args: {
  env: WorkerEnv;
  source: "backend" | "edge";
  pipeline: string;
  lane: string;
  model: string;
  provider: string;
  outcome: string;
  cacheStatus: string;
  status: number;
  durationMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  outputInputRatio: number;
  callCount?: number;
  translatedCount?: number;
  failedCount?: number;
  mediaCount?: number;
  cacheHitCount?: number;
  cacheMissCount?: number;
}): void {
  const analytics = args.env.AI_TELEMETRY;
  if (!analytics || typeof analytics.writeDataPoint !== "function") {
    return;
  }

  const sampleRate = normalizeSampleRate(args.env.AI_TELEMETRY_SAMPLE_RATE);
  if (!shouldSample(sampleRate)) {
    return;
  }

  try {
    analytics.writeDataPoint({
      indexes: [`${args.source}:${args.pipeline}`],
      blobs: [
        args.source,
        args.pipeline,
        args.lane,
        args.model,
        args.provider,
        args.outcome,
        args.cacheStatus,
      ],
      doubles: [
        args.status,
        args.durationMs,
        args.promptTokens,
        args.completionTokens,
        args.totalTokens,
        args.outputInputRatio,
        args.callCount ?? 1,
        args.translatedCount ?? 0,
        args.failedCount ?? (args.outcome === "ok" ? 0 : 1),
        args.mediaCount ?? 0,
        args.cacheHitCount ?? (args.cacheStatus === "hit" ? 1 : 0),
        args.cacheMissCount ?? (args.cacheStatus === "miss" ? 1 : 0),
      ],
    });
  } catch {
    // best-effort only
  }
}

function isRpcMethod(value: unknown): value is RpcMethod {
  return typeof value === "string" && RPC_METHODS.includes(value as RpcMethod);
}

function validateRangeParams(params: unknown): { startMs: number; endMs: number } {
  if (!isRecord(params)) {
    throw new Error("Expected params object.");
  }
  const startMs = parseFiniteNumber(params.startMs);
  const endMs = parseFiniteNumber(params.endMs);
  if (startMs === undefined || endMs === undefined) {
    throw new Error("Expected numeric startMs and endMs.");
  }
  return { startMs, endMs };
}

function validateSessionParams(params: unknown): { sessionId: string; agentId?: string } {
  if (!isRecord(params)) {
    throw new Error("Expected params object.");
  }
  const sessionId = trimString(params.sessionId);
  if (!sessionId) {
    throw new Error("Expected non-empty sessionId.");
  }
  const agentId = trimString(params.agentId);
  return agentId ? { sessionId, agentId } : { sessionId };
}

function sanitizeRpcParams(method: RpcMethod, params: unknown): JsonRecord {
  switch (method) {
    case "sessionExists": {
      return validateSessionParams(params);
    }
    case "discoverSessionsForRange":
    case "loadCostUsageSummary": {
      return validateRangeParams(params);
    }
    case "loadSessionCostSummary": {
      const base = validateSessionParams(params);
      const range = validateRangeParams(params);
      return { ...base, ...range };
    }
    case "loadSessionUsageTimeSeries": {
      if (!isRecord(params)) {
        throw new Error("Expected params object.");
      }
      const base = validateSessionParams(params);
      const maxPointsRaw = parseFiniteNumber(params.maxPoints) ?? DEFAULT_MAX_POINTS;
      return {
        ...base,
        maxPoints: clamp(Math.floor(maxPointsRaw), 1, MAX_BOUNDED_LIMIT),
      };
    }
    case "loadSessionLogs": {
      if (!isRecord(params)) {
        throw new Error("Expected params object.");
      }
      const base = validateSessionParams(params);
      const limitRaw = parseFiniteNumber(params.limit) ?? DEFAULT_LOG_LIMIT;
      return {
        ...base,
        limit: clamp(Math.floor(limitRaw), 1, MAX_BOUNDED_LIMIT),
      };
    }
  }
}

function resolveBackendUrl(env: WorkerEnv): URL {
  const base = trimString(env.USAGE_BACKEND_BASE_URL);
  if (!base) {
    throw new Error("USAGE_BACKEND_BASE_URL is required.");
  }

  let backendUrl: URL;
  try {
    backendUrl = new URL(base);
  } catch {
    throw new Error("USAGE_BACKEND_BASE_URL must be an absolute URL.");
  }

  const path = normalizePath(env.USAGE_BACKEND_PATH, DEFAULT_ENDPOINT_PATH);
  backendUrl.pathname = path;
  backendUrl.search = "";
  backendUrl.hash = "";
  return backendUrl;
}

function computeDaysFromRange(startMs: number, endMs: number): number {
  const spanMs = Math.max(0, endMs - startMs);
  return Math.max(1, Math.ceil(spanMs / DAY_MS) + 1);
}

function buildKvKey(args: {
  prefix: string;
  method: RpcMethod;
  params: JsonRecord;
}): string {
  const prefix = normalizeKvPrefix(args.prefix);
  const agent = trimString(args.params.agentId) ?? "unknown";
  const sessionId = trimString(args.params.sessionId) ?? "unknown";
  const startMs = parseFiniteNumber(args.params.startMs) ?? 0;
  const endMs = parseFiniteNumber(args.params.endMs) ?? 0;

  switch (args.method) {
    case "sessionExists":
      return `${prefix}:session-meta:${agent}:${sessionId}`;
    case "discoverSessionsForRange":
      return `${prefix}:discover:${startMs}:${endMs}`;
    case "loadCostUsageSummary":
      return `${prefix}:cost-summary:${startMs}:${endMs}`;
    case "loadSessionCostSummary":
      return `${prefix}:session-cost:${agent}:${sessionId}:${startMs}:${endMs}`;
    case "loadSessionUsageTimeSeries":
      return `${prefix}:session-timeseries:${agent}:${sessionId}`;
    case "loadSessionLogs":
      return `${prefix}:session-logs:${agent}:${sessionId}`;
  }
}

function normalizeKvFallback(method: RpcMethod, params: JsonRecord): unknown {
  switch (method) {
    case "sessionExists":
      return { exists: false };
    case "discoverSessionsForRange":
      return { sessions: [] };
    case "loadCostUsageSummary": {
      const startMs = parseFiniteNumber(params.startMs) ?? Date.now();
      const endMs = parseFiniteNumber(params.endMs) ?? startMs;
      return {
        updatedAt: Date.now(),
        days: computeDaysFromRange(startMs, endMs),
        daily: [],
        totals: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          totalCost: 0,
          inputCost: 0,
          outputCost: 0,
          cacheReadCost: 0,
          cacheWriteCost: 0,
          missingCostEntries: 0,
        },
      };
    }
    case "loadSessionCostSummary":
      return null;
    case "loadSessionUsageTimeSeries":
      return null;
    case "loadSessionLogs":
      return [];
  }
}

function normalizeKvValue(method: RpcMethod, raw: unknown, params: JsonRecord): unknown {
  if (method === "sessionExists") {
    if (typeof raw === "boolean") {
      return { exists: raw };
    }
    if (isRecord(raw)) {
      if (typeof raw.exists === "boolean") {
        return { exists: raw.exists };
      }
      if (typeof raw.sessionExists === "boolean") {
        return { exists: raw.sessionExists };
      }
    }
    return { exists: false };
  }

  if (method === "loadSessionUsageTimeSeries") {
    if (!isRecord(raw)) {
      return null;
    }
    if (!Array.isArray(raw.points)) {
      return raw;
    }
    const maxPoints = parseFiniteNumber(params.maxPoints) ?? DEFAULT_MAX_POINTS;
    const bounded = clamp(Math.floor(maxPoints), 1, MAX_BOUNDED_LIMIT);
    const points = raw.points.slice(0, bounded);
    return { ...raw, points };
  }

  if (method === "loadSessionLogs") {
    const limit = clamp(
      Math.floor(parseFiniteNumber(params.limit) ?? DEFAULT_LOG_LIMIT),
      1,
      MAX_BOUNDED_LIMIT,
    );
    if (Array.isArray(raw)) {
      return raw.slice(0, limit);
    }
    if (isRecord(raw) && Array.isArray(raw.logs)) {
      return { ...raw, logs: raw.logs.slice(0, limit) };
    }
    return [];
  }

  return raw;
}

async function callKvStorage(args: {
  env: WorkerEnv;
  method: RpcMethod;
  params: JsonRecord;
}): Promise<Response> {
  const kv = args.env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return errorJson(500, "USAGE_KV binding is required when USAGE_STORAGE_MODE=kv.");
  }

  const key = buildKvKey({
    prefix: args.env.USAGE_KV_PREFIX ?? DEFAULT_KV_PREFIX,
    method: args.method,
    params: args.params,
  });

  try {
    const rawValue = await kv.get(key);
    if (rawValue === null) {
      return responseJson(200, { ok: true, result: normalizeKvFallback(args.method, args.params) });
    }

    let decoded: unknown;
    try {
      decoded = JSON.parse(rawValue);
    } catch {
      return errorJson(502, `Invalid JSON stored for usage key '${key}'.`);
    }

    return responseJson(200, {
      ok: true,
      result: normalizeKvValue(args.method, decoded, args.params),
    });
  } catch (error) {
    return errorJson(502, `USAGE_KV read failed: ${String(error)}`);
  }
}

function resolveSeedEndpointPath(basePath: string, explicitSeedPath: string | undefined): string {
  return normalizePath(explicitSeedPath, `${basePath}${DEFAULT_SEED_PATH_SUFFIX}`);
}

type SeedEntry = {
  key: string;
  value: unknown;
  ttlSeconds?: number;
};

function parseSeedEntries(payload: unknown): SeedEntry[] {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    throw new Error("Seed payload must include an entries array.");
  }

  if (payload.entries.length < 1 || payload.entries.length > MAX_SEED_ENTRIES) {
    throw new Error(`Seed entries must contain between 1 and ${MAX_SEED_ENTRIES} items.`);
  }

  return payload.entries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Seed entry ${index + 1} must be an object.`);
    }
    const key = trimString(entry.key);
    if (!key) {
      throw new Error(`Seed entry ${index + 1} requires a non-empty key.`);
    }
    const ttlSeconds = normalizeTtlSeconds(entry.ttlSeconds);
    return ttlSeconds === undefined
      ? { key, value: entry.value }
      : { key, value: entry.value, ttlSeconds };
  });
}

function validateSeedEntry(args: {
  keyPrefix: string;
  entry: SeedEntry;
}): { ok: true; encoded: string; expirationTtl?: number } | { ok: false; response: Response } {
  if (!args.entry.key.startsWith(args.keyPrefix)) {
    return {
      ok: false,
      response: errorJson(400, `Seed key '${args.entry.key}' must start with '${args.keyPrefix}'.`),
    };
  }

  const encoded = JSON.stringify(args.entry.value);
  if (encoded.length > MAX_SEED_VALUE_BYTES) {
    return {
      ok: false,
      response: errorJson(
        400,
        `Seed value for key '${args.entry.key}' exceeds ${MAX_SEED_VALUE_BYTES} bytes after JSON encoding.`,
      ),
    };
  }

  return {
    ok: true,
    encoded,
    ...(args.entry.ttlSeconds === undefined ? {} : { expirationTtl: args.entry.ttlSeconds }),
  };
}

function decodeQueueBody(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

async function seedKvStorage(args: { env: WorkerEnv; request: Request; endpointPath: string }): Promise<Response> {
  const expectedAdminToken = trimString(args.env.USAGE_ADMIN_TOKEN);
  if (!expectedAdminToken) {
    return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const providedToken = parseBearerToken(args.request);
  if (!providedToken || providedToken !== expectedAdminToken) {
    return errorJson(401, "Unauthorized.");
  }

  const kv = args.env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    return errorJson(500, "USAGE_KV binding with put() is required for seed endpoint.");
  }

  let payload: unknown;
  try {
    payload = await args.request.json();
  } catch {
    return errorJson(400, "Invalid JSON body.");
  }

  let entries: SeedEntry[];
  try {
    entries = parseSeedEntries(payload);
  } catch (error) {
    return errorJson(400, (error as Error).message);
  }

  const kvPrefix = normalizeKvPrefix(args.env.USAGE_KV_PREFIX);
  const keyPrefix = `${kvPrefix}:`;
  const defaultTtlSeconds = normalizeTtlSeconds(args.env.USAGE_KV_SEED_TTL_SECONDS);
  const asyncMode = normalizeBoolean(args.env.USAGE_SEED_ASYNC, false);

  if (asyncMode) {
    const queue = args.env.USAGE_SEED_QUEUE;
    if (!queue || typeof queue.sendBatch !== "function") {
      return errorJson(500, "USAGE_SEED_QUEUE binding is required when USAGE_SEED_ASYNC=true.");
    }

    const normalizedEntries = entries.map((entry) =>
      defaultTtlSeconds === undefined || entry.ttlSeconds !== undefined
        ? entry
        : { ...entry, ttlSeconds: defaultTtlSeconds },
    );

    for (const entry of normalizedEntries) {
      const validation = validateSeedEntry({ keyPrefix, entry });
      if (!validation.ok) {
        return validation.response;
      }
    }

    const batchSize = normalizeSeedAsyncBatchSize(args.env.USAGE_SEED_ASYNC_BATCH_SIZE);
    const batches = splitSeedEntries(normalizedEntries, batchSize);
    try {
      for (const batch of batches) {
        await queue.sendBatch(batch.map((entry) => ({ body: entry })));
      }
    } catch (error) {
      return errorJson(502, `USAGE_SEED_QUEUE send failed: ${String(error)}`);
    }

    return responseJson(202, {
      ok: true,
      result: {
        queued: normalizedEntries.length,
        batches: batches.length,
        endpointPath: args.endpointPath,
      },
    });
  }

  try {
    for (const entry of entries) {
      const expirationTtl = entry.ttlSeconds ?? defaultTtlSeconds;
      const normalized = expirationTtl === undefined ? entry : { ...entry, ttlSeconds: expirationTtl };
      const validation = validateSeedEntry({ keyPrefix, entry: normalized });
      if (!validation.ok) {
        return validation.response;
      }

      if (validation.expirationTtl !== undefined) {
        await kv.put(normalized.key, validation.encoded, { expirationTtl: validation.expirationTtl });
      } else {
        await kv.put(normalized.key, validation.encoded);
      }
    }
  } catch (error) {
    return errorJson(502, `USAGE_KV write failed for seed endpoint: ${String(error)}`);
  }

  return responseJson(200, {
    ok: true,
    result: {
      written: entries.length,
      endpointPath: args.endpointPath,
    },
  });
}

async function callUsageBackend(args: {
  env: WorkerEnv;
  method: RpcMethod;
  params: JsonRecord;
}): Promise<Response> {
  const timeoutMs = normalizeTimeoutMs(args.env.USAGE_BACKEND_TIMEOUT_MS);
  const maxRetries = normalizeBackendMaxRetries(args.env.USAGE_BACKEND_MAX_RETRIES);
  const backendUrl = resolveBackendUrl(args.env);
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const backendResponse = await fetch(backendUrl.toString(), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          ...(trimString(args.env.USAGE_BACKEND_TOKEN)
            ? { authorization: `Bearer ${trimString(args.env.USAGE_BACKEND_TOKEN)}` }
            : {}),
        },
        body: JSON.stringify({ method: args.method, params: args.params }),
        signal: controller.signal,
      });

      if (!backendResponse.ok) {
        if (backendResponse.status >= 500 && attempt < maxRetries) {
          continue;
        }
        const details = (await backendResponse.text().catch(() => "")).trim();
        const suffix = details ? `: ${details.slice(0, 300)}` : "";
        return errorJson(502, `Usage backend returned HTTP ${backendResponse.status}${suffix}`);
      }

      let decoded: unknown;
      try {
        decoded = await backendResponse.json();
      } catch {
        return errorJson(502, "Usage backend returned a non-JSON response.");
      }

      if (isRecord(decoded) && typeof decoded.ok === "boolean") {
        return responseJson(200, decoded);
      }
      return responseJson(200, { ok: true, result: decoded });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        if (attempt < maxRetries) {
          continue;
        }
        return errorJson(504, `Usage backend timed out after ${timeoutMs}ms.`);
      }
      if (attempt < maxRetries) {
        continue;
      }
      return errorJson(502, `Usage backend request failed: ${String(error)}`);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return errorJson(502, "Usage backend request failed after retries.");
}

function cacheRequestKey(args: {
  request: Request;
  endpointPath: string;
  namespace: string;
  method: RpcMethod;
  params: JsonRecord;
}): Request {
  const base = new URL(args.request.url);
  base.pathname = `${args.endpointPath}/cache/${encodeURIComponent(args.namespace)}/${args.method}`;
  const sortedEntries = Object.entries(args.params).sort(([left], [right]) => left.localeCompare(right));
  for (const [key, value] of sortedEntries) {
    if (value === null || value === undefined) {
      continue;
    }
    base.searchParams.set(key, String(value));
  }
  return new Request(base.toString(), { method: "GET" });
}

async function warmCacheFromKv(args: {
  env: WorkerEnv;
  endpointPath: string;
  cacheNamespace: string;
  cacheTtlSeconds: number;
}): Promise<number> {
  const edgeCache = getDefaultCache();
  if (!edgeCache) {
    return 0;
  }

  const windowsDays = parseWarmWindowsDays(args.env.USAGE_CACHE_WARM_WINDOWS_DAYS);
  const warmMethods: RpcMethod[] = ["loadCostUsageSummary", "discoverSessionsForRange"];
  const now = Date.now();
  const baseRequest = new Request(`https://warmup.internal${args.endpointPath}`, { method: "POST" });

  let warmed = 0;
  for (const windowDays of windowsDays) {
    const endMs = now;
    const startMs = endMs - windowDays * DAY_MS;
    const params: JsonRecord = { startMs, endMs };

    for (const method of warmMethods) {
      const liveResponse = await callKvStorage({
        env: args.env,
        method,
        params,
      });

      if (!liveResponse.ok || liveResponse.status !== 200) {
        continue;
      }

      const cacheKey = cacheRequestKey({
        request: baseRequest,
        endpointPath: args.endpointPath,
        namespace: args.cacheNamespace,
        method,
        params,
      });
      const cacheable = liveResponse.clone();
      cacheable.headers.set("cache-control", `public, max-age=${args.cacheTtlSeconds}`);
      await edgeCache.put(cacheKey, cacheable);
      warmed += 1;
    }
  }

  return warmed;
}

function requireAdminToken(request: Request, env: WorkerEnv): Response | null {
  const expected = readAdminToken(env);
  if (!expected) {
    return errorJson(500, "Admin token is not configured.");
  }
  const provided = parseBearerToken(request);
  if (!matchesBearerToken(provided, expected)) {
    return errorJson(401, "Unauthorized.");
  }
  return null;
}

function requireAiJobsAdminToken(request: Request, env: WorkerEnv): Response | null {
  const expected = readAiJobsAdminToken(env);
  if (!expected) {
    return errorJson(500, "AI jobs admin token is not configured.");
  }
  const provided = parseBearerToken(request);
  if (!matchesBearerToken(provided, expected)) {
    return errorJson(401, "Unauthorized.");
  }
  return null;
}

async function handleBillingStatus(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const monthlyPriceUsd = normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD);
  const trialDays = normalizeTrialDays(args.env.BILLING_TRIAL_DAYS);
  const account = await loadBillingAccount(args.env, userId);
  const nowMs = Date.now();
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "billing.status",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const trialEndsAtMs = account?.trialEndsAtMs;

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      tier: entitlement.tier,
      entitled: entitlement.entitled,
      role: entitlement.owner ? "owner" : entitlement.tier === "subscriber" ? "subscriber" : entitlement.tier,
      ownerLifetimeAccess: entitlement.owner,
      delayMinutes: entitlement.entitled ? 0 : normalizeNewsDelayMinutes(args.env.NEWS_DELAY_MINUTES),
      trialDays,
      trialEndsAtMs,
      trialRemainingMs:
        trialEndsAtMs && trialEndsAtMs > nowMs ? Math.max(0, trialEndsAtMs - nowMs) : 0,
      subscription: {
        status: entitlement.owner ? "owner" : account?.status ?? "none",
        expiresAtMs: entitlement.owner ? null : account?.status === "trialing" ? (account?.trialEndsAtMs ?? null) : null,
        expiresLabel: entitlement.owner ? "never" : null,
        monthsRemaining: entitlement.owner ? "infinite" : null,
        stripeCustomerPresent: Boolean(account?.stripeCustomerId),
        portalAvailable: !entitlement.owner && Boolean(account?.stripeCustomerId),
      },
      monthlyPriceUsd,
      policy: {
        rateLimitPerMinute: policy.rateLimitPerMinute,
        maxNewsItems: policy.maxNewsItems,
      },
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAtMs: rateLimit.resetAtMs,
      },
      status: account?.status ?? "none",
      updatedAtMs: account?.updatedAtMs ?? nowMs,
    },
  });
}

async function handleBillingActivity(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const payload = isRecord(args.body) ? args.body : {};
  const nowMs = Date.now();
  const account = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "billing.activity",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const requestedLimit = parseFiniteNumber(payload.limit);
  const maxAvailable = normalizeBillingActivityHistoryLimit(args.env.BILLING_ACTIVITY_HISTORY_LIMIT);
  const limit =
    requestedLimit === undefined
      ? Math.min(40, maxAvailable)
      : clamp(Math.floor(requestedLimit), 1, maxAvailable);
  const events = await loadBillingActivityEvents(args.env, userId);

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      events: events.slice(0, limit),
      total: events.length,
      limit,
      maxAvailable,
      role: entitlement.owner ? "owner" : entitlement.tier === "subscriber" ? "subscriber" : entitlement.tier,
      tier: entitlement.tier,
      entitled: entitlement.entitled,
      status: entitlement.owner ? "owner" : account?.status ?? "none",
      updatedAtMs: account?.updatedAtMs ?? nowMs,
    },
  });
}

async function handleFeatureGates(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const account = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "feature-gates",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const delayMinutes = normalizeNewsDelayMinutes(args.env.NEWS_DELAY_MINUTES);

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      tier: entitlement.tier,
      entitled: entitlement.entitled,
      role: entitlement.owner ? "owner" : entitlement.tier === "subscriber" ? "subscriber" : entitlement.tier,
      ownerLifetimeAccess: entitlement.owner,
      status: account?.status ?? "none",
      policy: {
        rateLimitPerMinute: policy.rateLimitPerMinute,
        maxNewsItems: policy.maxNewsItems,
        delayMinutes: entitlement.entitled ? 0 : delayMinutes,
      },
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAtMs: rateLimit.resetAtMs,
      },
      features: {
        instantNews: entitlement.entitled,
        trialAvailable: (account?.trialStartedAtMs ?? 0) === 0 || normalizeBoolean(args.env.BILLING_ALLOW_RETRIAL, false),
        outboundDedupe: true,
        aiGatewayDedupeConfigured: Boolean(trimString(args.env.AI_GATEWAY_URL)),
      },
      account: account
        ? {
            updatedAtMs: account.updatedAtMs,
            trialEndsAtMs: account.trialEndsAtMs ?? null,
            subscribedAtMs: account.subscribedAtMs ?? null,
          }
        : null,
    },
  });
}

async function handleAdminCrmSummary(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  let userId: string;
  try {
    userId = await validateUserId(args.body, args.env);
  } catch (error) {
    return errorJson(400, error instanceof Error ? error.message : "Invalid request.");
  }
  if (!isOwnerUser(args.env, userId)) {
    return errorJson(403, "Forbidden.");
  }

  const accounts = await loadCrmAccountSnapshots(args.env);
  const statusCounts = {
    active: 0,
    trialing: 0,
    canceled: 0,
    expired: 0,
    none: 0,
  };
  let kvMrrActiveUsd = 0;
  for (const account of accounts) {
    if (account.status === "active") {
      statusCounts.active += 1;
      kvMrrActiveUsd += account.monthlyPriceUsd;
      continue;
    }
    if (account.status === "trialing") {
      statusCounts.trialing += 1;
      continue;
    }
    if (account.status === "canceled") {
      statusCounts.canceled += 1;
      continue;
    }
    if (account.status === "expired") {
      statusCounts.expired += 1;
      continue;
    }
    statusCounts.none += 1;
  }

  const { telemetry, latestEvents } = await summarizeCrmTelemetry(args.env);
  let stripeLive: StripeCrmLiveSummary | StripeCrmLiveFallback | undefined;
  const stripeResult = await resolveStripeCrmSummary(args.env);
  if ("live" in stripeResult) {
    stripeLive = stripeResult.live;
  } else if ("fallback" in stripeResult) {
    stripeLive = stripeResult.fallback;
  }

  const revenueMrrActiveUsd = stripeLive?.live ? stripeLive.mrrActiveUsd : kvMrrActiveUsd;
  const revenueArrActiveUsd = Number((revenueMrrActiveUsd * 12).toFixed(2));
  const activeSubscribersForRevenue = stripeLive?.live ? stripeLive.statuses.active : statusCounts.active;
  const safePct = (numerator: number, denominator: number): number => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }
    return Number(((numerator / denominator) * 100).toFixed(2));
  };
  const safeRatio = (numerator: number, denominator: number): number => {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }
    return Number((numerator / denominator).toFixed(2));
  };
  const trackedUsers = accounts.length;
  const arpuActiveUsd = safeRatio(revenueMrrActiveUsd, activeSubscribersForRevenue);
  const trialToPaidRate7dPct = safePct(telemetry.paidStarts7d, telemetry.trialStarts7d);
  const ratioDenominator = Math.max(trackedUsers, activeSubscribersForRevenue + statusCounts.trialing);
  const subscriberPenetrationPct = safePct(activeSubscribersForRevenue, ratioDenominator);
  const trialingSharePct = safePct(statusCounts.trialing, ratioDenominator);
  const churnRate30dPct = safePct(telemetry.cancellations30d, activeSubscribersForRevenue);
  const netSubscriberDelta7d = telemetry.paidStarts7d - telemetry.cancellations7d;

  return responseJson(200, {
    ok: true,
    result: {
      generatedAtMs: Date.now(),
      billing: {
        trackedUsers,
        statuses: statusCounts,
        mrrActiveUsd: Number(revenueMrrActiveUsd.toFixed(2)),
        arrActiveUsd: revenueArrActiveUsd,
        accounts,
        ...(stripeLive
          ? {
              stripe: stripeLive,
            }
          : {}),
      },
      telemetry,
      commandCenter: {
        revenue: {
          mrrActiveUsd: Number(revenueMrrActiveUsd.toFixed(2)),
          arrActiveUsd: revenueArrActiveUsd,
          arpuActiveUsd,
          ...(stripeLive?.live
            ? {
                mrrBillableUsd: stripeLive.mrrBillableUsd,
                arrBillableUsd: stripeLive.arrBillableUsd,
                source: stripeLive.source,
              }
            : {
                source: "internal_snapshot",
              }),
        },
        funnel: {
          trialStarts7d: telemetry.trialStarts7d,
          paidStarts7d: telemetry.paidStarts7d,
          trialToPaidRate7dPct,
          subscriberPenetrationPct,
          trialingSharePct,
        },
        risk: {
          cancellations7d: telemetry.cancellations7d,
          cancellations30d: telemetry.cancellations30d,
          churnRate30dPct,
          netSubscriberDelta7d,
        },
        activity: {
          events24h: telemetry.events24h,
          events7d: telemetry.events7d,
          uniqueUsers24h: telemetry.uniqueUsers24h,
          uniqueUsers7d: telemetry.uniqueUsers7d,
        },
      },
      latestEvents,
    },
  });
}

async function handleUserInfo(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const account = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account,
  });
  const delayMinutes = normalizeNewsDelayMinutes(args.env.NEWS_DELAY_MINUTES);

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      role: entitlement.owner ? "owner" : entitlement.tier === "subscriber" ? "subscriber" : entitlement.tier,
      tier: entitlement.tier,
      entitled: entitlement.entitled,
      ownerLifetimeAccess: entitlement.owner,
      subscription: {
        status: entitlement.owner ? "owner" : account?.status ?? "none",
        expiresAtMs: entitlement.owner ? null : account?.status === "trialing" ? (account?.trialEndsAtMs ?? null) : null,
        expiresLabel: entitlement.owner ? "never" : null,
        monthsRemaining: entitlement.owner ? "infinite" : null,
        stripeCustomerPresent: Boolean(account?.stripeCustomerId),
        portalAvailable: !entitlement.owner && Boolean(account?.stripeCustomerId),
      },
      delayMinutes: entitlement.entitled ? 0 : delayMinutes,
      account: account
        ? {
            status: account.status,
            trialEndsAtMs: account.trialEndsAtMs ?? null,
            subscribedAtMs: account.subscribedAtMs ?? null,
            updatedAtMs: account.updatedAtMs,
          }
        : null,
    },
  });
}

function renderLandingPage(env: WorkerEnv): Response {
  const brandName = trimString(env.LANDING_BRAND_NAME) ?? DEFAULT_LANDING_BRAND_NAME;
  const tagline = trimString(env.LANDING_TAGLINE) ?? DEFAULT_LANDING_TAGLINE;
  const xAuthLoginUrl = trimString(env.X_AUTH_LOGIN_URL) ?? buildAbsoluteAuthProviderUrl("x", "login", null);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brandName} | ${tagline}</title>
  <style>
    :root {
      --bg-0: #050a14;
      --bg-1: #0a1326;
      --bg-2: #132641;
      --panel: rgba(12, 24, 42, 0.78);
      --line: rgba(148, 184, 236, 0.26);
      --ink: #eef4ff;
      --muted: #afc4df;
      --brand: #44d0ff;
      --brand-2: #7af3c7;
      --warn: #ffcc66;
      --danger: #ff8f8f;
      --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(900px 500px at 8% -10%, rgba(68, 208, 255, 0.18), transparent 70%),
        radial-gradient(750px 420px at 90% 2%, rgba(122, 243, 199, 0.16), transparent 72%),
        linear-gradient(160deg, var(--bg-2) 0%, var(--bg-1) 42%, var(--bg-0) 100%);
      min-height: 100vh;
    }

    .shell {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 20px 90px;
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 26px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }

    .brand-badge {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: linear-gradient(140deg, var(--brand), var(--brand-2));
      box-shadow: 0 10px 26px rgba(68, 208, 255, 0.35);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 22px;
      align-items: stretch;
    }

    .panel {
      border: 1px solid var(--line);
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 65%), var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(6px);
      padding: 20px;
    }

    .tag {
      display: inline-block;
      font-size: 11px;
      letter-spacing: 0.11em;
      text-transform: uppercase;
      color: var(--brand);
      border: 1px solid rgba(68, 208, 255, 0.44);
      border-radius: 999px;
      padding: 6px 10px;
    }

    h1 {
      margin: 12px 0 10px;
      font-size: clamp(36px, 6vw, 66px);
      line-height: 0.95;
      letter-spacing: -0.03em;
      max-width: 16ch;
    }

    p { color: var(--muted); line-height: 1.58; }

    .cta-row {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .btn {
      appearance: none;
      border: 1px solid transparent;
      border-radius: 12px;
      padding: 11px 15px;
      font-weight: 700;
      letter-spacing: 0.01em;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      color: #042234;
      background: linear-gradient(95deg, var(--brand), #82e6ff);
    }

    .btn-secondary {
      color: var(--ink);
      border-color: var(--line);
      background: rgba(255, 255, 255, 0.02);
    }

    .stats {
      margin-top: 16px;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stat {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .stat-value { font-size: 22px; font-weight: 800; }
    .stat-label { font-size: 12px; color: var(--muted); }

    .ops-title { margin: 0 0 8px; }
    .ops-grid { display: grid; gap: 10px; }
    .field-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }

    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 12px;
      color: var(--ink);
      background: rgba(0, 0, 0, 0.24);
      font: inherit;
    }

    .ops-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-top: 2px;
    }

    .result {
      min-height: 24px;
      font-weight: 700;
      color: var(--brand-2);
    }

    .result.warn { color: var(--warn); }
    .result.error { color: var(--danger); }

    .sources {
      margin-top: 8px;
      display: grid;
      gap: 8px;
    }

    .source-item {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 10px 11px;
      background: rgba(255,255,255,0.02);
    }

    .source-name { font-weight: 700; }
    .source-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }

    .sections {
      margin-top: 20px;
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .sections h3 { margin-top: 0; margin-bottom: 6px; }

    .pricing {
      margin-top: 16px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: center;
    }

    .price-figure { font-size: 42px; font-weight: 900; letter-spacing: -0.02em; }

    .muted { color: var(--muted); }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
      .sections { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ops-actions { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr 1fr; }
    }

    @media (max-width: 640px) {
      .sections { grid-template-columns: 1fr; }
      .stats { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="nav">
      <div class="brand">
        <div class="brand-badge" aria-hidden="true"></div>
        <div>${brandName}</div>
      </div>
      <a class="btn btn-secondary" href="${xAuthLoginUrl}">${BACKEND_LANDING_HERO.signInLabel}</a>
    </header>

    <section class="hero">
      <article class="panel">
        <span class="tag">${tagline}</span>
        <h1>${BACKEND_LANDING_HERO.title}</h1>
        <p>${BACKEND_LANDING_HERO.lead}</p>
        <div class="cta-row">
          <a class="btn btn-primary" href="${xAuthLoginUrl}">${BACKEND_LANDING_HERO.continueLabel}</a>
          <button class="btn btn-secondary" id="checkoutBtn" type="button">${BACKEND_LANDING_HERO.trialButtonLabel}</button>
        </div>
        <div class="stats">
          ${BACKEND_LANDING_HERO.stats.map((item) => `<div class="stat"><div class="stat-value">${item.value}</div><div class="stat-label">${item.label}</div></div>`).join("")}
        </div>
      </article>

      <aside class="panel">
        <h3 class="ops-title">${BACKEND_OPERATOR_PANEL.heading}</h3>
        <p class="muted">${BACKEND_OPERATOR_PANEL.intro}</p>
        <div class="ops-grid">
          <label class="field-label" for="userId">${BACKEND_OPERATOR_PANEL.userIdLabel}</label>
          <input id="userId" placeholder="${BACKEND_OPERATOR_PANEL.userIdPlaceholder}" autocomplete="off" />
          <label class="field-label" for="apiToken">${BACKEND_OPERATOR_PANEL.apiTokenLabel}</label>
          <input id="apiToken" placeholder="${BACKEND_OPERATOR_PANEL.apiTokenPlaceholder}" autocomplete="off" />
          <div class="ops-actions">
            ${BACKEND_OPERATOR_PANEL.actions.map((action, index) => `<button class="btn ${index === 0 ? "btn-primary" : "btn-secondary"}" id="${action.id}" type="button">${action.label}</button>`).join("")}
          </div>
          <div id="result" class="result"></div>
          <div id="sources" class="sources" aria-live="polite"></div>
        </div>
      </aside>
    </section>

    <section class="sections">
      ${BACKEND_OPERATOR_CARDS.map((item) => `<article class="panel"><h3>${item.title}</h3><p class="muted">${item.copy}</p></article>`).join("")}
    </section>

    <section class="panel pricing">
      <div>
        <div class="tag">${BACKEND_OPERATOR_PRICING.heading}</div>
        <div class="price-figure">${BACKEND_OPERATOR_PRICING.priceMain}<span style="font-size:18px;font-weight:700"> ${BACKEND_OPERATOR_PRICING.priceSuffix}</span></div>
        <p class="muted">${BACKEND_OPERATOR_PRICING.summary}</p>
      </div>
      <button class="btn btn-primary" id="checkoutBtnBottom" type="button">${BACKEND_OPERATOR_PRICING.launchCheckoutLabel}</button>
    </section>
  </div>

  <script>
    const resultEl = document.getElementById("result");
    const sourcesEl = document.getElementById("sources");
    const userIdEl = document.getElementById("userId");
    const tokenEl = document.getElementById("apiToken");

    function setResult(message, level) {
      resultEl.textContent = message || "";
      resultEl.className = "result";
      if (level === "warn") resultEl.classList.add("warn");
      if (level === "error") resultEl.classList.add("error");
    }

    async function apiPost(path, body) {
      const token = tokenEl.value.trim();
      const headers = { "content-type": "application/json" };
      if (token) headers.authorization = "Bearer " + token;
      const res = await fetch(path, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const json = await res.json().catch(function () {
        return { ok: false, error: { message: "Invalid response" } };
      });
      if (!res.ok || !json.ok) {
        throw new Error((json && json.error && json.error.message) || ("HTTP " + res.status));
      }
      return json;
    }

    async function checkAccess() {
      try {
        const userId = userIdEl.value.trim();
        if (!userId) throw new Error("Enter userId first.");
        const info = await apiPost("/api/intel-dashboard/user-info", { userId: userId });
        const line = String(info.result.role).toUpperCase() + " | tier=" + info.result.tier + " | entitled=" + info.result.entitled;
        setResult(line, "ok");
      } catch (error) {
        setResult(String(error.message || error), "warn");
      }
    }

    async function launchCheckout() {
      try {
        const userId = userIdEl.value.trim();
        if (!userId) throw new Error("Enter userId first.");
        const checkout = await apiPost("/api/intel-dashboard/billing/checkout", { userId: userId });
        if (checkout.result && checkout.result.bypassCheckout) {
          setResult("Owner account detected: checkout bypass active.", "ok");
          return;
        }
        const url = checkout && checkout.result ? checkout.result.url : null;
        if (!url) throw new Error("Checkout URL unavailable.");
        window.location.href = url;
      } catch (error) {
        setResult(String(error.message || error), "warn");
      }
    }

    async function loadSources() {
      try {
        const payload = await apiPost("/api/intel-dashboard/sources", {
          region: "global",
          tags: ["analysis"],
          limit: 4
        });
        const items = payload && payload.result && Array.isArray(payload.result.items)
          ? payload.result.items
          : [];
        sourcesEl.innerHTML = "";
        if (items.length < 1) {
          sourcesEl.innerHTML = "<div class=\"source-item\"><div class=\"source-meta\">No sources returned.</div></div>";
          return;
        }
        for (const source of items) {
          const node = document.createElement("div");
          node.className = "source-item";
          const name = document.createElement("div");
          name.className = "source-name";
          name.textContent = source.name;
          const meta = document.createElement("div");
          meta.className = "source-meta";
          meta.textContent = source.category + " | " + source.region + " | reliability=" + source.reliability;
          node.appendChild(name);
          node.appendChild(meta);
          sourcesEl.appendChild(node);
        }
        setResult("Loaded " + items.length + " high-signal sources.", "ok");
      } catch (error) {
        setResult(String(error.message || error), "warn");
      }
    }

    document.getElementById("statusBtn").addEventListener("click", checkAccess);
    document.getElementById("ownerBtn").addEventListener("click", checkAccess);
    document.getElementById("checkoutBtn").addEventListener("click", launchCheckout);
    document.getElementById("checkoutBtnBottom").addEventListener("click", launchCheckout);
    document.getElementById("sourcesBtn").addEventListener("click", loadSources);
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "geolocation=(), camera=(), microphone=()",
      "strict-transport-security": "max-age=31536000; includeSubDomains",
    },
  });
}

async function handleSourcesCatalog(args: {
  body: unknown;
}): Promise<Response> {
  const payload = isRecord(args.body) ? args.body : {};
  const query = trimString(payload.q)?.toLowerCase();
  const category = trimString(payload.category)?.toLowerCase();
  const region = trimString(payload.region)?.toLowerCase();
  const language = trimString(payload.language)?.toLowerCase();
  const sourceType = trimString(payload.sourceType)?.toLowerCase();
  const trustTier = trimString(payload.trustTier)?.toLowerCase();
  const latencyTier = trimString(payload.latencyTier)?.toLowerCase();
  const acquisitionMethod = trimString(payload.acquisitionMethod)?.toLowerCase();
  const limit = clamp(Math.floor(parseFiniteNumber(payload.limit) ?? 100), 1, 500);

  const requestedTags = Array.isArray(payload.tags)
    ? payload.tags.map((tag) => trimString(tag)?.toLowerCase()).filter((tag): tag is string => Boolean(tag))
    : trimString(payload.tags)
      ?.split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0) ?? [];

  const items = OSINT_SOURCE_CATALOG.filter((source) => {
    if (category && source.category.toLowerCase() !== category) {
      return false;
    }
    if (region && source.region.toLowerCase() !== region) {
      return false;
    }
    if (language && source.language.toLowerCase() !== language) {
      return false;
    }
    if (sourceType && source.sourceType.toLowerCase() !== sourceType) {
      return false;
    }
    if (trustTier && source.trustTier.toLowerCase() !== trustTier) {
      return false;
    }
    if (latencyTier && source.latencyTier.toLowerCase() !== latencyTier) {
      return false;
    }
    if (acquisitionMethod && source.acquisitionMethod.toLowerCase() !== acquisitionMethod) {
      return false;
    }
    if (requestedTags.length > 0) {
      const tagSet = new Set(source.tags.map((tag) => tag.toLowerCase()));
      for (const requested of requestedTags) {
        if (!tagSet.has(requested)) {
          return false;
        }
      }
    }
    if (query) {
      const haystack = `${source.name} ${source.description} ${source.region} ${source.tags.join(" ")} ${source.sourceType} ${source.trustTier} ${source.latencyTier} ${source.acquisitionMethod}`.toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  }).slice(0, limit);

  return responseJson(200, {
    ok: true,
    result: {
      returned: items.length,
      total: OSINT_SOURCE_CATALOG.length,
      items,
    },
  });
}

async function executeAiJob(args: {
  env: WorkerEnv;
  job: AiJobRequest;
}): Promise<Record<string, unknown>> {
  if (args.job.type === "dedupe") {
    const canonicalPayload = stableStringify({
      channel: args.job.channel ?? "default",
      payload: args.job.payload,
    });
    const dedupe = await deriveDedupeKeyWithAi({
      env: args.env,
      canonicalPayload,
      sourcePayload: args.job.payload,
      preferEscalation: args.job.preferEscalation,
    });
    return {
      type: "dedupe",
      dedupeKey: dedupe.key,
      aiGatewayUsed: dedupe.aiGatewayUsed,
      lane: dedupe.lane,
      ...(dedupe.model ? { model: dedupe.model } : {}),
      escalationUsed: dedupe.escalationUsed,
      mediaUsed: dedupe.mediaUsed,
      mediaCount: dedupe.mediaCount,
      ...(dedupe.fallbackReason ? { fallbackReason: dedupe.fallbackReason } : {}),
      ...(dedupe.gatewayStatus === undefined ? {} : { gatewayStatus: dedupe.gatewayStatus }),
      ...(dedupe.gatewayErrorCode ? { gatewayErrorCode: dedupe.gatewayErrorCode } : {}),
      ...(dedupe.gatewayErrorMessage ? { gatewayErrorMessage: dedupe.gatewayErrorMessage } : {}),
    };
  }

  if (args.job.type === "translate") {
    const textRoute = resolveAiGatewayRouteConfig({ env: args.env, routeKind: "text" });
    const normalizedText = args.job.text.replace(/\s+/g, " ").trim();
    const translated = await invokeAiGateway({
      env: args.env,
      routeKind: "text",
      maxTokens: estimateTranslateMaxTokens(normalizedText),
      expectJson: false,
      cacheHint: `translate-${args.job.targetLanguage.toLowerCase()}`,
      cacheTtlSecondsOverride: resolveAiGatewayCacheTtlSeconds(
        args.env.AI_GATEWAY_CACHE_TTL_TRANSLATE_SECONDS,
        DEFAULT_AI_GATEWAY_CACHE_TTL_TRANSLATE_SECONDS,
      ),
      metadata: {
        pipeline: "ai_jobs_translate",
        mode: "text",
      },
      messages: [
        {
          role: "system",
          content:
            "Translate the user text accurately into the requested target language. Return only the translated text with no commentary.",
        },
        {
          role: "user",
          content: `Target language: ${args.job.targetLanguage}\nText:\n${normalizedText}`,
        },
      ],
    });
    if (!translated) {
      throw new Error("AI translation unavailable.");
    }
    return {
      type: "translate",
      targetLanguage: args.job.targetLanguage,
      text: translated,
      lane: "text",
      ...(textRoute?.model ? { model: textRoute.model } : {}),
    };
  }

  const textRoute = resolveAiGatewayRouteConfig({ env: args.env, routeKind: "text" });
  const normalizedText = args.job.text.replace(/\s+/g, " ").trim();
  const classified = await invokeAiGateway({
    env: args.env,
    routeKind: "text",
    maxTokens: 48,
    expectJson: true,
    jsonSchema: {
      name: "classification",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["label", "confidence"],
        properties: {
          label: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    cacheHint: "classify-v1",
    cacheTtlSecondsOverride: resolveAiGatewayCacheTtlSeconds(
      args.env.AI_GATEWAY_CACHE_TTL_CLASSIFY_SECONDS,
      DEFAULT_AI_GATEWAY_CACHE_TTL_CLASSIFY_SECONDS,
    ),
    metadata: {
      pipeline: "ai_jobs_classify",
      mode: "json",
    },
    messages: [
      {
        role: "system",
        content:
          "Classify the text into one label from the provided list. Return strict JSON with keys label and confidence (0..1).",
      },
      {
        role: "user",
        content: `Labels: ${args.job.labels.join(", ")}\nText:\n${normalizedText}`,
      },
    ],
  });
  if (!classified) {
    throw new Error("AI classification unavailable.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(classified);
  } catch {
    throw new Error("AI classification returned invalid JSON.");
  }
  if (!isRecord(parsed)) {
    throw new Error("AI classification payload missing object body.");
  }
  const label = trimString(parsed.label);
  const confidenceRaw = parseFiniteNumber(parsed.confidence);
  const confidence = confidenceRaw === undefined ? null : clamp(confidenceRaw, 0, 1);
  if (!label) {
    throw new Error("AI classification did not return a label.");
  }
  const allowedLabels = new Set(args.job.labels.map((value) => value.toLowerCase()));
  if (!allowedLabels.has(label.toLowerCase())) {
    throw new Error("AI classification label is not in requested labels.");
  }
  return {
    type: "classify",
    label,
    confidence,
    lane: "text",
    ...(textRoute?.model ? { model: textRoute.model } : {}),
  };
}

async function executeAiJobsWithConcurrency(args: {
  env: WorkerEnv;
  jobs: AiJobRequest[];
  maxConnections: number;
}): Promise<AiBatchJobResult[]> {
  return mapWithConcurrency(args.jobs, args.maxConnections, async (job, index) => {
    try {
      const result = await executeAiJob({ env: args.env, job });
      return {
        index,
        ok: true,
        result,
      };
    } catch (error) {
      return {
        index,
        ok: false,
        error: String(error),
      };
    }
  });
}

function getAiBatchKv(env: WorkerEnv): KvLike | null {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    return null;
  }
  return kv;
}

async function loadAiBatchState(env: WorkerEnv, batchId: string): Promise<AiBatchState | null> {
  const kv = getAiBatchKv(env);
  if (!kv) {
    return null;
  }
  const raw = await kv.get(resolveAiBatchStateKey(env, batchId));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    if (!Array.isArray(parsed.jobs)) {
      return null;
    }
    const jobs: AiJobRequest[] = [];
    for (const job of parsed.jobs) {
      const normalized = normalizeAiJobRequest(job);
      if (!normalized) {
        return null;
      }
      jobs.push(normalized);
    }
    const state: AiBatchState = {
      id: trimString(parsed.id) ?? batchId,
      status:
        trimString(parsed.status) === "queued" ||
        trimString(parsed.status) === "running" ||
        trimString(parsed.status) === "submitted" ||
        trimString(parsed.status) === "polling" ||
        trimString(parsed.status) === "completed" ||
        trimString(parsed.status) === "failed"
          ? (parsed.status as AiBatchStatus)
          : "failed",
      createdAtMs: Math.floor(parseFiniteNumber(parsed.createdAtMs) ?? Date.now()),
      updatedAtMs: Math.floor(parseFiniteNumber(parsed.updatedAtMs) ?? Date.now()),
      provider: normalizeAiBatchProvider(trimString(parsed.provider)),
      jobs,
      maxConnections: clamp(
        Math.floor(parseFiniteNumber(parsed.maxConnections) ?? DEFAULT_AI_PIPELINE_MAX_CONNECTIONS),
        1,
        MAX_AI_PIPELINE_MAX_CONNECTIONS,
      ),
      pollAttempts: Math.max(0, Math.floor(parseFiniteNumber(parsed.pollAttempts) ?? 0)),
      ...(trimString(parsed.externalBatchId) ? { externalBatchId: trimString(parsed.externalBatchId) } : {}),
      ...(trimString(parsed.outputFileId) ? { outputFileId: trimString(parsed.outputFileId) } : {}),
      ...(Array.isArray(parsed.results) ? { results: parsed.results as AiBatchJobResult[] } : {}),
      ...(trimString(parsed.error) ? { error: trimString(parsed.error) } : {}),
    };
    return state;
  } catch {
    return null;
  }
}

function normalizeAiBatchStateMeta(value: unknown, batchId: string): AiBatchStateMeta | null {
  if (!isRecord(value)) {
    return null;
  }
  const statusRaw = trimString(value.status);
  const status =
    statusRaw === "queued" ||
    statusRaw === "running" ||
    statusRaw === "submitted" ||
    statusRaw === "polling" ||
    statusRaw === "completed" ||
    statusRaw === "failed"
      ? (statusRaw as AiBatchStatus)
      : null;
  const provider = normalizeAiBatchProvider(trimString(value.provider));
  const createdAtMs = parseFiniteNumber(value.createdAtMs);
  const updatedAtMs = parseFiniteNumber(value.updatedAtMs);
  const maxConnections = parseFiniteNumber(value.maxConnections);
  const pollAttempts = parseFiniteNumber(value.pollAttempts);
  const totalJobs = parseFiniteNumber(value.totalJobs);
  if (
    !status ||
    createdAtMs === undefined ||
    updatedAtMs === undefined ||
    maxConnections === undefined ||
    pollAttempts === undefined ||
    totalJobs === undefined
  ) {
    return null;
  }

  return {
    id: trimString(value.id) ?? batchId,
    status,
    createdAtMs: Math.floor(createdAtMs),
    updatedAtMs: Math.floor(updatedAtMs),
    provider,
    maxConnections: clamp(Math.floor(maxConnections), 1, MAX_AI_PIPELINE_MAX_CONNECTIONS),
    pollAttempts: Math.max(0, Math.floor(pollAttempts)),
    totalJobs: Math.max(0, Math.floor(totalJobs)),
    ...(trimString(value.externalBatchId) ? { externalBatchId: trimString(value.externalBatchId) } : {}),
    ...(trimString(value.outputFileId) ? { outputFileId: trimString(value.outputFileId) } : {}),
    ...(Array.isArray(value.results) ? { results: value.results as AiBatchJobResult[] } : {}),
    ...(trimString(value.error) ? { error: trimString(value.error) } : {}),
  };
}

async function loadAiBatchStateMeta(env: WorkerEnv, batchId: string): Promise<AiBatchStateMeta | null> {
  const kv = getAiBatchKv(env);
  if (!kv) {
    return null;
  }
  const raw = await kv.get(resolveAiBatchMetaKey(env, batchId));
  if (!raw) {
    return null;
  }
  try {
    return normalizeAiBatchStateMeta(JSON.parse(raw) as unknown, batchId);
  } catch {
    return null;
  }
}

async function saveAiBatchState(env: WorkerEnv, state: AiBatchState): Promise<void> {
  const kv = getAiBatchKv(env);
  if (!kv || typeof kv.put !== "function") {
    throw new Error("USAGE_KV binding with get()/put() is required for AI batch jobs.");
  }
  const ttl = normalizeAiBatchStatusTtlSeconds(env.AI_BATCH_STATUS_TTL_SECONDS);
  const meta: AiBatchStateMeta = {
    id: state.id,
    status: state.status,
    createdAtMs: state.createdAtMs,
    updatedAtMs: state.updatedAtMs,
    provider: state.provider,
    maxConnections: state.maxConnections,
    pollAttempts: state.pollAttempts,
    totalJobs: state.jobs.length,
    ...(state.externalBatchId ? { externalBatchId: state.externalBatchId } : {}),
    ...(state.outputFileId ? { outputFileId: state.outputFileId } : {}),
    ...(state.results ? { results: state.results } : {}),
    ...(state.error ? { error: state.error } : {}),
  };
  await Promise.all([
    kv.put(resolveAiBatchStateKey(env, state.id), JSON.stringify(state), { expirationTtl: ttl }),
    kv.put(resolveAiBatchMetaKey(env, state.id), JSON.stringify(meta), { expirationTtl: ttl }),
  ]);
}

async function loadAiBatchIdempotency(env: WorkerEnv, idempotencyKey: string): Promise<string | null> {
  const kv = getAiBatchKv(env);
  if (!kv) {
    return null;
  }
  return kv.get(resolveAiBatchIdempotencyKey(env, idempotencyKey));
}

async function saveAiBatchIdempotency(env: WorkerEnv, idempotencyKey: string, batchId: string): Promise<void> {
  const kv = getAiBatchKv(env);
  if (!kv || typeof kv.put !== "function") {
    return;
  }
  const ttl = normalizeAiBatchStatusTtlSeconds(env.AI_BATCH_STATUS_TTL_SECONDS);
  await kv.put(resolveAiBatchIdempotencyKey(env, idempotencyKey), batchId, { expirationTtl: ttl });
}

function aiBatchStateResponse(state: AiBatchState): Record<string, unknown> {
  return {
    id: state.id,
    status: state.status,
    provider: state.provider,
    createdAtMs: state.createdAtMs,
    updatedAtMs: state.updatedAtMs,
    maxConnections: state.maxConnections,
    pollAttempts: state.pollAttempts,
    totalJobs: state.jobs.length,
    ...(state.externalBatchId ? { externalBatchId: state.externalBatchId } : {}),
    ...(state.outputFileId ? { outputFileId: state.outputFileId } : {}),
    ...(state.results ? { jobs: state.results } : {}),
    ...(state.error ? { error: state.error } : {}),
  };
}

function aiBatchMetaResponse(state: AiBatchStateMeta): Record<string, unknown> {
  return {
    id: state.id,
    status: state.status,
    provider: state.provider,
    createdAtMs: state.createdAtMs,
    updatedAtMs: state.updatedAtMs,
    maxConnections: state.maxConnections,
    pollAttempts: state.pollAttempts,
    totalJobs: state.totalJobs,
    ...(state.externalBatchId ? { externalBatchId: state.externalBatchId } : {}),
    ...(state.outputFileId ? { outputFileId: state.outputFileId } : {}),
    ...(state.results ? { jobs: state.results } : {}),
    ...(state.error ? { error: state.error } : {}),
  };
}

type GroqBatchStatus = {
  status: string;
  outputFileId?: string;
  error?: string;
};

function normalizeGroqBaseUrl(raw: string | undefined): string {
  const base = trimString(raw) ?? DEFAULT_GROQ_API_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error("GROQ_API_BASE_URL must be a valid URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("GROQ_API_BASE_URL must use https.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "api.groq.com" && !hostname.endsWith(".groq.com")) {
    throw new Error("GROQ_API_BASE_URL host is not allowed.");
  }

  const normalizedPathname = parsed.pathname.replace(/\/+$/, "");
  return normalizedPathname.length > 0 ? `${parsed.origin}${normalizedPathname}` : parsed.origin;
}

async function groqRequest(args: {
  env: WorkerEnv;
  method: "GET" | "POST";
  path: string;
  body?: BodyInit;
  contentType?: string;
}): Promise<Response> {
  const apiKey = trimString(args.env.GROQ_API_KEY);
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required when AI_BATCH_PROVIDER=groq.");
  }

  const controller = new AbortController();
  const timeoutMs = normalizeAiGatewayTimeoutMs(args.env.AI_GATEWAY_TIMEOUT_MS);
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {
      authorization: `Bearer ${apiKey}`,
    };
    if (args.contentType) {
      headers["content-type"] = args.contentType;
    }
    return await fetch(`${normalizeGroqBaseUrl(args.env.GROQ_API_BASE_URL)}${args.path}`, {
      method: args.method,
      headers,
      ...(args.body === undefined ? {} : { body: args.body }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function buildAiGatewayRequestForJob(job: AiJobRequest): {
  messages: AiGatewayMessage[];
  maxTokens: number;
  expectJson: boolean;
} {
  if (job.type === "dedupe") {
    return {
      maxTokens: 48,
      expectJson: true,
      messages: [
        {
          role: "system",
          content:
            "Return compact JSON object with only one key named dedupe_key. dedupe_key must be stable and normalized for near-duplicate news payloads.",
        },
        {
          role: "user",
          content: stableStringify({
            channel: job.channel ?? "default",
            payload: job.payload,
          }),
        },
      ],
    };
  }

  if (job.type === "translate") {
    const normalizedText = job.text.replace(/\s+/g, " ").trim();
    return {
      maxTokens: estimateTranslateMaxTokens(normalizedText),
      expectJson: false,
      messages: [
        {
          role: "system",
          content:
            "Translate the user text accurately into the requested target language. Return only the translated text with no commentary.",
        },
        {
          role: "user",
          content: `Target language: ${job.targetLanguage}\nText:\n${normalizedText}`,
        },
      ],
    };
  }

  const normalizedText = job.text.replace(/\s+/g, " ").trim();
  return {
    maxTokens: 48,
    expectJson: true,
    messages: [
      {
        role: "system",
        content: "Classify the text into one label from the provided list. Return strict JSON with keys label and confidence (0..1).",
      },
      {
        role: "user",
        content: `Labels: ${job.labels.join(", ")}\nText:\n${normalizedText}`,
      },
    ],
  };
}

async function submitGroqBatch(args: {
  env: WorkerEnv;
  state: AiBatchState;
}): Promise<{ externalBatchId: string }> {
  const model = trimString(args.env.AI_GATEWAY_MODEL) ?? DEFAULT_AI_GATEWAY_MODEL;
  const lines = args.state.jobs.map((job, index) => {
    const request = buildAiGatewayRequestForJob(job);
    return JSON.stringify({
      custom_id: `job-${index}`,
      method: "POST",
      url: "/openai/v1/chat/completions",
      body: {
        model,
        temperature: 0,
        ...(isCerebrasRouteModel(model)
          ? { max_completion_tokens: request.maxTokens }
          : { max_tokens: request.maxTokens }),
        ...(request.expectJson ? { response_format: { type: "json_object" } } : {}),
        ...(request.expectJson && shouldUseLowReasoningEffort({ routeKind: "text", model, expectJson: true })
          ? { reasoning_effort: "low" }
          : {}),
        messages: request.messages,
      },
    });
  });
  const jsonl = `${lines.join("\n")}\n`;

  const formData = new FormData();
  formData.append("purpose", "batch");
  formData.append("file", new Blob([jsonl], { type: "application/jsonl" }), `${args.state.id}.jsonl`);
  const fileResponse = await groqRequest({
    env: args.env,
    method: "POST",
    path: "/openai/v1/files",
    body: formData,
  });
  if (!fileResponse.ok) {
    const reason = await fileResponse.text();
    throw new Error(`Groq file upload failed: HTTP ${fileResponse.status} ${reason}`);
  }
  const filePayload = (await fileResponse.json()) as unknown;
  if (!isRecord(filePayload) || !trimString(filePayload.id)) {
    throw new Error("Groq file upload did not return file id.");
  }

  const completionWindow = trimString(args.env.GROQ_BATCH_COMPLETION_WINDOW) ?? DEFAULT_GROQ_BATCH_COMPLETION_WINDOW;
  const batchResponse = await groqRequest({
    env: args.env,
    method: "POST",
    path: "/openai/v1/batches",
    contentType: "application/json",
    body: JSON.stringify({
      endpoint: "/openai/v1/chat/completions",
      input_file_id: trimString(filePayload.id),
      completion_window: completionWindow,
    }),
  });
  if (!batchResponse.ok) {
    const reason = await batchResponse.text();
    throw new Error(`Groq batch create failed: HTTP ${batchResponse.status} ${reason}`);
  }
  const batchPayload = (await batchResponse.json()) as unknown;
  const batchId = isRecord(batchPayload) ? trimString(batchPayload.id) : undefined;
  if (!batchId) {
    throw new Error("Groq batch create did not return batch id.");
  }
  return { externalBatchId: batchId };
}

async function fetchGroqBatchStatus(args: {
  env: WorkerEnv;
  externalBatchId: string;
}): Promise<GroqBatchStatus> {
  const response = await groqRequest({
    env: args.env,
    method: "GET",
    path: `/openai/v1/batches/${encodeURIComponent(args.externalBatchId)}`,
  });
  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Groq batch status failed: HTTP ${response.status} ${reason}`);
  }

  const payload = (await response.json()) as unknown;
  if (!isRecord(payload)) {
    throw new Error("Groq batch status payload is invalid.");
  }
  return {
    status: trimString(payload.status) ?? "unknown",
    ...(trimString(payload.output_file_id) ? { outputFileId: trimString(payload.output_file_id) } : {}),
    ...(trimString(payload.error) ? { error: trimString(payload.error) } : {}),
  };
}

async function fetchGroqBatchOutput(args: {
  env: WorkerEnv;
  outputFileId: string;
}): Promise<string> {
  const response = await groqRequest({
    env: args.env,
    method: "GET",
    path: `/openai/v1/files/${encodeURIComponent(args.outputFileId)}/content`,
  });
  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Groq batch output fetch failed: HTTP ${response.status} ${reason}`);
  }
  return response.text();
}

async function interpretAiResultFromModelOutput(args: {
  env: WorkerEnv;
  job: AiJobRequest;
  content: string;
}): Promise<Record<string, unknown>> {
  if (args.job.type === "translate") {
    return {
      type: "translate",
      targetLanguage: args.job.targetLanguage,
      text: args.content,
    };
  }

  if (args.job.type === "classify") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(args.content);
    } catch {
      throw new Error("AI classification returned invalid JSON.");
    }
    if (!isRecord(parsed)) {
      throw new Error("AI classification payload missing object body.");
    }
    const label = trimString(parsed.label);
    if (!label) {
      throw new Error("AI classification did not return a label.");
    }
    const allowedLabels = new Set(args.job.labels.map((value) => value.toLowerCase()));
    if (!allowedLabels.has(label.toLowerCase())) {
      throw new Error("AI classification label is not in requested labels.");
    }
    const confidenceRaw = parseFiniteNumber(parsed.confidence);
    const confidence = confidenceRaw === undefined ? null : clamp(confidenceRaw, 0, 1);
    return {
      type: "classify",
      label,
      confidence,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(args.content);
  } catch {
    parsed = {};
  }
  const dedupeKey = isRecord(parsed) ? trimString(parsed.dedupe_key) : undefined;
  const fallbackPayload = stableStringify({
    channel: args.job.channel ?? "default",
    payload: args.job.payload,
  });
  const key = await sha256Hex(dedupeKey ?? fallbackPayload);
  return {
    type: "dedupe",
    dedupeKey: key,
    aiGatewayUsed: Boolean(dedupeKey),
  };
}

async function parseGroqBatchOutput(args: {
  env: WorkerEnv;
  state: AiBatchState;
  outputText: string;
}): Promise<AiBatchJobResult[]> {
  const resultsByIndex = new Map<number, AiBatchJobResult>();
  const lines = args.outputText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    const customId = trimString(parsed.custom_id);
    if (!customId || !customId.startsWith("job-")) {
      continue;
    }
    const index = Number(customId.slice(4));
    if (!Number.isInteger(index) || index < 0 || index >= args.state.jobs.length) {
      continue;
    }

    const response = isRecord(parsed.response) ? parsed.response : null;
    const statusCode = response ? parseFiniteNumber(response.status_code) : undefined;
    if (!response || statusCode === undefined || statusCode < 200 || statusCode >= 300) {
      resultsByIndex.set(index, {
        index,
        ok: false,
        error: `Groq batch item failed with status ${statusCode ?? "unknown"}.`,
      });
      continue;
    }

    const responseBody = isRecord(response.body) ? response.body : null;
    const choices = responseBody && Array.isArray(responseBody.choices) ? responseBody.choices : null;
    const firstChoice = choices && choices.length > 0 ? choices[0] : null;
    const message = firstChoice && isRecord(firstChoice) && isRecord(firstChoice.message) ? firstChoice.message : null;
    const content = message ? trimString(message.content) : undefined;
    if (!content) {
      resultsByIndex.set(index, {
        index,
        ok: false,
        error: "Groq batch item missing model content.",
      });
      continue;
    }

    try {
      const result = await interpretAiResultFromModelOutput({
        env: args.env,
        job: args.state.jobs[index],
        content,
      });
      resultsByIndex.set(index, {
        index,
        ok: true,
        result,
      });
    } catch (error) {
      resultsByIndex.set(index, {
        index,
        ok: false,
        error: String(error),
      });
    }
  }

  const output: AiBatchJobResult[] = [];
  for (let index = 0; index < args.state.jobs.length; index += 1) {
    output.push(
      resultsByIndex.get(index) ?? {
        index,
        ok: false,
        error: "Groq batch output did not include this job.",
      },
    );
  }
  return output;
}

async function enqueueAiBatchMessage(args: {
  env: WorkerEnv;
  body: Record<string, unknown>;
  delaySeconds?: number;
}): Promise<void> {
  if (!args.env.AI_JOB_QUEUE || typeof args.env.AI_JOB_QUEUE.send !== "function") {
    throw new Error("AI_JOB_QUEUE binding is required for async AI batch queueing.");
  }
  await args.env.AI_JOB_QUEUE.send(args.body, args.delaySeconds === undefined ? undefined : { delaySeconds: args.delaySeconds });
}

async function processAiBatchRun(args: {
  env: WorkerEnv;
  batchId: string;
}): Promise<void> {
  const state = await loadAiBatchState(args.env, args.batchId);
  if (!state || state.status === "completed" || state.status === "failed") {
    return;
  }

  const pollDelaySeconds = normalizeAiBatchPollDelaySeconds(args.env.AI_BATCH_POLL_DELAY_SECONDS);

  if (state.provider === "groq" && state.externalBatchId) {
    if (state.status !== "submitted" && state.status !== "polling") {
      await saveAiBatchState(args.env, {
        ...state,
        status: "submitted",
        updatedAtMs: Date.now(),
      });
    }
    await enqueueAiBatchMessage({
      env: args.env,
      body: {
        kind: "ai-batch-poll",
        batchId: state.id,
      },
      delaySeconds: pollDelaySeconds,
    });
    return;
  }

  if (state.status !== "queued") {
    return;
  }

  const runningState: AiBatchState = {
    ...state,
    status: "running",
    updatedAtMs: Date.now(),
  };
  await saveAiBatchState(args.env, runningState);

  if (runningState.provider === "internal") {
    const results = await executeAiJobsWithConcurrency({
      env: args.env,
      jobs: runningState.jobs,
      maxConnections: runningState.maxConnections,
    });
    await saveAiBatchState(args.env, {
      ...runningState,
      status: "completed",
      updatedAtMs: Date.now(),
      results,
    });
    return;
  }

  const submitted = await submitGroqBatch({ env: args.env, state: runningState });
  await saveAiBatchState(args.env, {
    ...runningState,
    status: "submitted",
    updatedAtMs: Date.now(),
    externalBatchId: submitted.externalBatchId,
  });
  await enqueueAiBatchMessage({
    env: args.env,
    body: {
      kind: "ai-batch-poll",
      batchId: runningState.id,
    },
    delaySeconds: pollDelaySeconds,
  });
}

async function processAiBatchPoll(args: {
  env: WorkerEnv;
  batchId: string;
}): Promise<void> {
  const state = await loadAiBatchState(args.env, args.batchId);
  if (!state || state.status === "completed" || state.status === "failed" || state.provider !== "groq") {
    return;
  }
  if (!state.externalBatchId) {
    await saveAiBatchState(args.env, {
      ...state,
      status: "failed",
      updatedAtMs: Date.now(),
      error: "Groq batch state missing external batch id.",
    });
    return;
  }

  const statusPayload = await fetchGroqBatchStatus({ env: args.env, externalBatchId: state.externalBatchId });
  const normalizedStatus = statusPayload.status.toLowerCase();
  if (normalizedStatus === "completed" || normalizedStatus === "succeeded") {
    if (!statusPayload.outputFileId) {
      throw new Error("Groq batch completed without output file id.");
    }
    const outputText = await fetchGroqBatchOutput({
      env: args.env,
      outputFileId: statusPayload.outputFileId,
    });
    const results = await parseGroqBatchOutput({
      env: args.env,
      state,
      outputText,
    });
    await saveAiBatchState(args.env, {
      ...state,
      status: "completed",
      outputFileId: statusPayload.outputFileId,
      updatedAtMs: Date.now(),
      results,
    });
    return;
  }

  if (
    normalizedStatus === "failed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "canceled" ||
    normalizedStatus === "expired"
  ) {
    await saveAiBatchState(args.env, {
      ...state,
      status: "failed",
      updatedAtMs: Date.now(),
      error: statusPayload.error ?? `Groq batch ended with status ${statusPayload.status}.`,
    });
    return;
  }

  const maxAttempts = normalizeAiBatchMaxPollAttempts(args.env.AI_BATCH_MAX_POLL_ATTEMPTS);
  const nextAttempt = state.pollAttempts + 1;
  if (nextAttempt > maxAttempts) {
    await saveAiBatchState(args.env, {
      ...state,
      status: "failed",
      updatedAtMs: Date.now(),
      pollAttempts: nextAttempt,
      error: `Groq batch polling exceeded ${maxAttempts} attempts.`,
    });
    return;
  }

  const baseDelay = normalizeAiBatchPollDelaySeconds(args.env.AI_BATCH_POLL_DELAY_SECONDS);
  const exponentialDelay = Math.min(
    MAX_AI_BATCH_POLL_DELAY_SECONDS,
    Math.floor(baseDelay * Math.pow(2, Math.min(6, Math.max(0, nextAttempt - 1)))),
  );
  await saveAiBatchState(args.env, {
    ...state,
    status: "polling",
    updatedAtMs: Date.now(),
    pollAttempts: nextAttempt,
  });
  await enqueueAiBatchMessage({
    env: args.env,
    body: {
      kind: "ai-batch-poll",
      batchId: state.id,
    },
    delaySeconds: exponentialDelay,
  });
}

async function recoverStaleAiBatches(args: {
  env: WorkerEnv;
  nowMs: number;
}): Promise<number> {
  const kv = getAiBatchKv(args.env);
  if (!kv || typeof kv.list !== "function") {
    return 0;
  }

  const staleMs = Math.max(
    DEFAULT_AI_BATCH_RECOVERY_STALE_SECONDS * 1000,
    normalizeAiBatchPollDelaySeconds(args.env.AI_BATCH_POLL_DELAY_SECONDS) * 2000,
  );
  const prefix = `${normalizeAiBatchNamespacePrefix(args.env.AI_BATCH_NAMESPACE_PREFIX)}:state:`;

  let recovered = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await kv.list({
      prefix,
      cursor,
      limit: Math.min(MAX_AI_BATCH_SWEEP_KEYS, 100),
    });

    for (const key of page.keys) {
      const name = trimString(key.name);
      if (!name || !name.startsWith(prefix)) {
        continue;
      }
      const batchId = name.slice(prefix.length);
      if (!batchId) {
        continue;
      }

      const state = await loadAiBatchState(args.env, batchId);
      if (!state || state.status === "completed" || state.status === "failed") {
        continue;
      }

      if (args.nowMs - state.updatedAtMs < staleMs) {
        continue;
      }

      if (state.provider === "groq") {
        if (state.externalBatchId && (state.status === "submitted" || state.status === "polling" || state.status === "running")) {
          await saveAiBatchState(args.env, {
            ...state,
            status: "polling",
            updatedAtMs: args.nowMs,
          });
          await enqueueAiBatchMessage({
            env: args.env,
            body: { kind: "ai-batch-poll", batchId: state.id },
            delaySeconds: 5,
          });
          recovered += 1;
          continue;
        }

        await saveAiBatchState(args.env, {
          ...state,
          status: "queued",
          updatedAtMs: args.nowMs,
        });
        await enqueueAiBatchMessage({
          env: args.env,
          body: { kind: "ai-batch-run", batchId: state.id },
        });
        recovered += 1;
        continue;
      }

      await saveAiBatchState(args.env, {
        ...state,
        status: "queued",
        updatedAtMs: args.nowMs,
      });
      await enqueueAiBatchMessage({
        env: args.env,
        body: { kind: "ai-batch-run", batchId: state.id },
      });
      recovered += 1;
    }

    if (page.list_complete || !trimString(page.cursor)) {
      break;
    }
    cursor = trimString(page.cursor);
  }

  return recovered;
}

async function handleAiJobsStatus(args: {
  env: WorkerEnv;
  batchId: string;
}): Promise<Response> {
  const stateMeta = await loadAiBatchStateMeta(args.env, args.batchId);
  if (!stateMeta) {
    return errorJson(404, "AI batch job not found.");
  }
  return responseJson(200, {
    ok: true,
    result: aiBatchMetaResponse(stateMeta),
  });
}

async function handleAiJobs(args: {
  env: WorkerEnv;
  body: unknown;
  ctx?: ExecutionContext;
}): Promise<Response> {
  if (!isRecord(args.body) || !Array.isArray(args.body.jobs)) {
    return errorJson(400, "Expected jobs array.");
  }

  const provider = normalizeAiBatchProvider(args.env.AI_BATCH_PROVIDER);
  const modeRaw = typeof args.body.mode === "string" ? args.body.mode : undefined;
  const asyncMode =
    provider === "groq" ||
    normalizeBoolean(args.body.async, false) ||
    (trimString(modeRaw) ?? "").toLowerCase() === "async";
  const maxJobLimit = asyncMode ? normalizeAiBatchMaxJobs(args.env.AI_BATCH_MAX_JOBS) : 100;
  if (args.body.jobs.length < 1 || args.body.jobs.length > maxJobLimit) {
    return errorJson(400, `Expected between 1 and ${maxJobLimit} jobs.`);
  }

  const jobs: AiJobRequest[] = [];
  for (let index = 0; index < args.body.jobs.length; index += 1) {
    const job = normalizeAiJobRequest(args.body.jobs[index]);
    if (!job) {
      return errorJson(400, `Invalid AI job at index ${index}.`);
    }
    jobs.push(job);
  }

  const envConnections = normalizeAiPipelineMaxConnections(args.env.AI_PIPELINE_MAX_CONNECTIONS);
  const requestedConnections = parseFiniteNumber(args.body.maxConnections);
  const maxConnections =
    requestedConnections === undefined
      ? envConnections
      : clamp(Math.floor(requestedConnections), 1, envConnections);

  if (!asyncMode) {
    const results = await executeAiJobsWithConcurrency({
      env: args.env,
      jobs,
      maxConnections,
    });
    const textRoute = resolveAiGatewayRouteConfig({ env: args.env, routeKind: "text" });

    return responseJson(200, {
      ok: true,
      result: {
        mode: "sync",
        model: textRoute?.model ?? DEFAULT_AI_GATEWAY_MODEL,
        maxConnections,
        jobs: results,
      },
    });
  }

  const hasQueue = Boolean(args.env.AI_JOB_QUEUE && typeof args.env.AI_JOB_QUEUE.send === "function");
  if (provider === "groq" && !hasQueue) {
    return errorJson(500, "AI_JOB_QUEUE binding is required for Groq async batch polling.");
  }

  const idempotencyKey = trimString(args.body.idempotencyKey);
  if (idempotencyKey) {
    const existingBatchId = await loadAiBatchIdempotency(args.env, idempotencyKey);
    if (existingBatchId) {
      const existingState = await loadAiBatchStateMeta(args.env, existingBatchId);
      if (existingState) {
        return responseJson(202, {
          ok: true,
          result: aiBatchMetaResponse(existingState),
        });
      }
    }
  }

  const batchId = trimString(args.body.batchId) ?? crypto.randomUUID();
  const queuedState: AiBatchState = {
    id: batchId,
    status: "queued",
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    provider,
    jobs,
    maxConnections,
    pollAttempts: 0,
  };
  await saveAiBatchState(args.env, queuedState);
  if (idempotencyKey) {
    await saveAiBatchIdempotency(args.env, idempotencyKey, batchId);
  }

  if (hasQueue) {
    await enqueueAiBatchMessage({
      env: args.env,
      body: {
        kind: "ai-batch-run",
        batchId,
      },
    });
  } else {
    if (args.ctx) {
      args.ctx.waitUntil(processAiBatchRun({ env: args.env, batchId }));
    } else {
      await processAiBatchRun({ env: args.env, batchId });
    }
  }

  const currentState = (await loadAiBatchStateMeta(args.env, batchId)) ?? {
    id: queuedState.id,
    status: queuedState.status,
    createdAtMs: queuedState.createdAtMs,
    updatedAtMs: queuedState.updatedAtMs,
    provider: queuedState.provider,
    maxConnections: queuedState.maxConnections,
    pollAttempts: queuedState.pollAttempts,
    totalJobs: queuedState.jobs.length,
  };
  return responseJson(202, {
    ok: true,
    result: {
      mode: "async",
      ...aiBatchMetaResponse(currentState),
    },
  });
}

async function handleBillingStartTrial(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const trialDays = normalizeTrialDays(args.env.BILLING_TRIAL_DAYS);
  const monthlyPriceUsd = normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD);
  const trialDurationMs = trialDays * DAY_MS;
  const allowRetrial = normalizeBoolean(args.env.BILLING_ALLOW_RETRIAL, false);
  const existing = await loadBillingAccount(args.env, userId);
  const existingEntitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account: existing,
  });
  const policy = resolveTierPolicy(args.env, existingEntitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "billing.startTrial",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  if (existingEntitlement.owner) {
    await appendBillingActivityEvent({
      env: args.env,
      userId,
      kind: "trial_bypass_owner",
      source: "api",
      status: "owner",
      note: "Owner account bypassed trial start.",
      atMs: nowMs,
    });
    return responseJson(200, {
      ok: true,
      result: {
        userId,
        status: "active",
        trialStarted: false,
        trialEligible: false,
        owner: true,
        monthlyPriceUsd,
      },
    });
  }

  if (!allowRetrial && existing?.trialStartedAtMs !== undefined) {
    await appendBillingActivityEvent({
      env: args.env,
      userId,
      kind: "trial_denied_already_used",
      source: "api",
      status: existing.status,
      note: "Trial denied because retrial is disabled.",
      atMs: nowMs,
    });
    return responseJson(409, {
      ok: false,
      error: {
        message: "Trial has already been used for this user.",
      },
      result: {
        userId,
        trialEligible: false,
        status: existing.status,
      },
    });
  }

  if (existing?.status === "active") {
    return responseJson(200, {
      ok: true,
      result: {
        userId,
        status: "active",
        trialStarted: false,
        monthlyPriceUsd: existing.monthlyPriceUsd,
      },
    });
  }

  if (existing?.status === "trialing" && (existing.trialEndsAtMs ?? 0) > nowMs) {
    return responseJson(200, {
      ok: true,
      result: {
        userId,
        status: "trialing",
        trialStarted: false,
        trialEndsAtMs: existing.trialEndsAtMs,
        monthlyPriceUsd: existing.monthlyPriceUsd,
      },
    });
  }

  const trialAccount: BillingAccount = {
    userId,
    status: "trialing",
    trialStartedAtMs: nowMs,
    trialEndsAtMs: nowMs + trialDurationMs,
    ...(existing?.stripeCustomerId ? { stripeCustomerId: existing.stripeCustomerId } : {}),
    ...(existing?.stripeSubscriptionId ? { stripeSubscriptionId: existing.stripeSubscriptionId } : {}),
    monthlyPriceUsd,
    updatedAtMs: nowMs,
  };
  await saveBillingAccount(args.env, trialAccount);
  await appendBillingActivityEvent({
    env: args.env,
    userId,
    kind: "trial_started",
    source: "api",
    status: "trialing",
    note: `Trial started for ${trialDays} day${trialDays === 1 ? "" : "s"}.`,
    atMs: nowMs,
  });

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      status: "trialing",
      trialStarted: true,
      trialEligible: true,
      trialEndsAtMs: trialAccount.trialEndsAtMs,
      monthlyPriceUsd,
    },
  });
}

async function handleBillingSubscribe(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const payload = isRecord(args.body) ? args.body : {};
  const active = payload.active === false ? false : true;
  const monthlyPriceUsd = normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD);
  const previous = await loadBillingAccount(args.env, userId);

  const next: BillingAccount = {
    userId,
    status: active ? "active" : "canceled",
    ...(previous?.trialStartedAtMs === undefined ? {} : { trialStartedAtMs: previous.trialStartedAtMs }),
    ...(previous?.trialEndsAtMs === undefined ? {} : { trialEndsAtMs: previous.trialEndsAtMs }),
    ...(active ? { subscribedAtMs: nowMs } : { canceledAtMs: nowMs }),
    ...(previous?.stripeCustomerId ? { stripeCustomerId: previous.stripeCustomerId } : {}),
    ...(previous?.stripeSubscriptionId ? { stripeSubscriptionId: previous.stripeSubscriptionId } : {}),
    monthlyPriceUsd,
    updatedAtMs: nowMs,
  };
  await saveBillingAccount(args.env, next);
  await appendBillingActivityEvent({
    env: args.env,
    userId,
    kind: active ? "subscription_set_active" : "subscription_set_canceled",
    source: "api",
    status: next.status,
    note: "Subscription updated via admin endpoint.",
    atMs: nowMs,
  });

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      status: next.status,
      monthlyPriceUsd,
      updatedAtMs: nowMs,
    },
  });
}

async function handleNewsPublish(args: {
  env: WorkerEnv;
  body: unknown;
  ctx?: ExecutionContext;
}): Promise<Response> {
  if (!isRecord(args.body) || !Array.isArray(args.body.entries)) {
    return errorJson(400, "Expected entries array.");
  }

  const normalizedItems = normalizeNewsItems(args.body.entries);
  if (normalizedItems.length < 1) {
    return errorJson(400, "Expected at least one valid news entry.");
  }
  if (normalizedItems.length > MAX_NEWS_ENTRIES) {
    return errorJson(400, `Expected no more than ${MAX_NEWS_ENTRIES} news entries.`);
  }
  const inputItems = await enrichNewsItemsForPublish({
    env: args.env,
    inputItems: normalizedItems,
  });

  const merge = args.body.merge !== false;
  const shardKey = trimString(args.body.shardKey);
  const shardCount = normalizeNewsCoordinatorShardCount(args.env.NEWS_COORDINATOR_SHARD_COUNT);
  if (shardCount > 1 && !shardKey) {
    return errorJson(400, "Expected shardKey when NEWS_COORDINATOR_SHARD_COUNT is greater than 1.");
  }
  let publishResult: NewsPublishMergeResult;
  try {
    publishResult = await publishNewsWithCoordinator({
      env: args.env,
      inputItems,
      merge,
      shardKey,
    });
  } catch (error) {
    return errorJson(503, `News coordinator unavailable: ${String(error)}`);
  }

  let outboundResult:
    | {
        attempted: number;
        delivered: number;
        skippedDuplicate: number;
        failed: number;
        aiGatewayUsed: boolean;
        failures: Array<{ channel: string; status: number; error: string }>;
      }
    | undefined;
  let outboundQueued = false;

  const outboundPayload = normalizeOutboundPublishPayload(args.body.outbound, args.env);
  if (outboundPayload) {
    const deliveryPromise = deliverOutboundTargets({
      env: args.env,
      items: inputItems,
      payload: outboundPayload,
    });
    const outboundAsync = normalizeBoolean(args.env.OUTBOUND_ASYNC, DEFAULT_OUTBOUND_ASYNC);
    if (args.ctx && outboundAsync) {
      outboundQueued = true;
      args.ctx.waitUntil(
        deliveryPromise
          .then(() => undefined)
          .catch(() => undefined),
      );
    } else {
      outboundResult = await deliveryPromise;
    }
  }

  return responseJson(200, {
    ok: true,
    result: {
      published: publishResult.published,
      totalStored: publishResult.totalStored,
      merged: publishResult.merged,
      ...(outboundPayload === null
        ? {}
        : outboundQueued
          ? {
              outbound: {
                queued: true,
                attempted: inputItems.length * outboundPayload.targets.length,
              },
            }
          : outboundResult === undefined
            ? {}
            : {
            outbound: {
              attempted: outboundResult.attempted,
              delivered: outboundResult.delivered,
              skippedDuplicate: outboundResult.skippedDuplicate,
              failed: outboundResult.failed,
              aiGatewayUsed: outboundResult.aiGatewayUsed,
              failures: outboundResult.failures,
            },
          }),
    },
  });
}

async function handleNewsGet(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const payload = isRecord(args.body) ? args.body : {};
  const requestedLimit = normalizeNewsLimit(payload.limit);
  const nowMs = Date.now();
  const account = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "news.get",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const limit = Math.min(requestedLimit, policy.maxNewsItems);
  const delayMinutes = normalizeNewsDelayMinutes(args.env.NEWS_DELAY_MINUTES);
  const delayMs = entitlement.entitled ? 0 : delayMinutes * 60 * 1000;
  const cutoffMs = nowMs - delayMs;

  const hotOverlayLimit = entitlement.entitled
    ? Math.max(
        limit,
        Math.min(policy.maxNewsItems, normalizeNewsHotOverlayLimit(args.env.NEWS_HOT_OVERLAY_LIMIT)),
      )
    : 0;
  const allNewsPromise = readNewsFeed(args.env);
  const hotNewsPromise = entitlement.entitled ? readCoordinatorHotFeed(args.env, hotOverlayLimit) : Promise.resolve([]);

  const [allNews, hotNews] = await Promise.all([allNewsPromise, hotNewsPromise]);
  const entitledNews =
    entitlement.entitled && hotNews.length > 0
      ? mergeNewsStreamsDescending(
          hotNews,
          allNews,
          normalizeNewsFeedMaxItems(args.env.NEWS_FEED_MAX_ITEMS),
        )
      : allNews;

  let visible: NewsItem[];
  let nextLocked: NewsItem | null;
  if (entitlement.entitled) {
    visible = entitledNews.slice(0, limit);
    nextLocked = null;
  } else {
    const firstUnlockedIndex = findFirstUnlockedIndexDescending(allNews, cutoffMs);
    visible = firstUnlockedIndex < 0 ? [] : allNews.slice(firstUnlockedIndex, firstUnlockedIndex + limit);
    nextLocked = firstUnlockedIndex < 0 ? (allNews[0] ?? null) : firstUnlockedIndex > 0 ? allNews[firstUnlockedIndex - 1] : null;
  }
  const monthlyPriceUsd = normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD);
  const trialDays = normalizeTrialDays(args.env.BILLING_TRIAL_DAYS);

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      tier: entitlement.tier,
      entitled: entitlement.entitled,
      delayMinutes: entitlement.entitled ? 0 : delayMinutes,
      trialDays,
      monthlyPriceUsd,
      policy: {
        rateLimitPerMinute: policy.rateLimitPerMinute,
        maxNewsItems: policy.maxNewsItems,
        requestedLimit,
      },
      rateLimit: {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetAtMs: rateLimit.resetAtMs,
      },
      returned: visible.length,
      items: visible,
      nextLockedAtMs: nextLocked?.publishedAtMs ?? null,
      nextUnlockAtMs: nextLocked ? nextLocked.publishedAtMs + delayMs : null,
    },
  });
}

async function handlePublicIntelFeed(args: {
  env: WorkerEnv;
  url: URL;
}): Promise<Response> {
  const items = await readNewsFeed(args.env);
  const filtered = filterAndRankNewsForPublicIntel({
    items,
    searchParams: args.url.searchParams,
    env: args.env,
  });
  const payload = filtered.map((item) => toPublicIntelItem(item));
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

async function handlePublicBriefings(args: {
  env: WorkerEnv;
  url: URL;
}): Promise<Response> {
  const items = await readNewsFeed(args.env);
  const maxItems = Math.max(normalizePublicIntelLimit(args.env.PUBLIC_INTEL_LIMIT), 150);
  const filtered = filterAndRankNewsForPublicIntel({
    items,
    searchParams: args.url.searchParams,
    env: args.env,
  }).slice(0, maxItems);
  const briefings = await buildPublicBriefings({
    env: args.env,
    items: filtered,
  });
  return new Response(JSON.stringify(briefings), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function inferAirSeaDomain(item: NewsItem): "air" | "sea" {
  const haystack = `${item.title} ${item.summary ?? ""} ${item.category ?? ""} ${item.source ?? ""}`.toLowerCase();
  if (/\b(ship|naval|warship|frigate|destroyer|submarine|fleet|carrier|port|strait|maritime|coast guard|red sea)\b/.test(haystack)) {
    return "sea";
  }
  return "air";
}

function inferAirSeaTags(item: NewsItem): string[] {
  const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  const tags: string[] = [];
  const maybePush = (tag: string, pattern: RegExp): void => {
    if (pattern.test(haystack)) tags.push(tag);
  };
  maybePush("drone", /\b(drone|uav|fpv)\b/);
  maybePush("missile", /\b(missile|ballistic|cruise)\b/);
  maybePush("air-defense", /\b(air defense|intercept|s-300|patriot|sam)\b/);
  maybePush("naval-major", /\b(naval|warship|frigate|destroyer|carrier|submarine)\b/);
  maybePush("strike", /\b(strike|attack|bombard|raid)\b/);
  return tags.slice(0, 5);
}

function inferAirSeaRegionFromCoordinates(latitude: number, longitude: number): IntelRegion {
  if (latitude >= 30 && latitude <= 55 && longitude >= 20 && longitude <= 50) return "ukraine";
  if (latitude >= 40 && latitude <= 72 && longitude >= 18 && longitude <= 55) return "europe";
  if (latitude >= 12 && latitude <= 45 && longitude >= 30 && longitude <= 65) return "middle_east";
  if (latitude >= -38 && latitude <= 38 && longitude >= -20 && longitude <= 58) return "africa";
  if (latitude >= 5 && latitude <= 55 && longitude >= 90 && longitude <= 160) return "pacific";
  if (latitude >= 15 && latitude <= 72 && longitude >= -170 && longitude <= -50) return "us";
  return "global";
}

function inferAirSeaAircraftType(callsign: string, tags: string[]): string {
  const upper = callsign.toUpperCase();
  if (tags.some((tag) => tag.startsWith("SQUAWK_"))) return "Emergency";
  if (/^(FORTE|JAKE|HOMER|RRR|RFR|MAGMA)/.test(upper)) return "ISR";
  if (/^(RCH|REACH|CMB|MOOSE)/.test(upper)) return "Strategic Airlift";
  if (/^(QID|SHELL|GOLD|ARCO|LAGR)/.test(upper)) return "Tanker";
  if (/^(NATO|OTAN)/.test(upper)) return "NATO";
  if (/^(SPAR|SAM)/.test(upper)) return "VIP / Government";
  if (/^(BONE|BUFF|TU95|TU160)/.test(upper)) return "Bomber";
  if (tags.includes("military")) return "Military Flight";
  return "Aircraft";
}

function inferAirSeaAircraftSeverity(tags: string[]): IntelSeverity {
  if (tags.includes("emergency")) return "critical";
  if (tags.includes("military")) return "high";
  return "medium";
}

function isLikelyMilitaryCallsign(callsign: string): boolean {
  const upper = callsign.toUpperCase();
  return /^(RCH|REACH|FORTE|JAKE|HOMER|NATO|OTAN|DUKE|QID|RRR|RFR|LAGR|GOLD|ARCO|SHELL|SPAR|SAM|MAGMA|MOOSE)/.test(
    upper,
  );
}

function parseOpenSkyStateTuple(
  value: unknown,
): {
  icao24: string;
  callsign: string;
  country: string;
  longitude: number;
  latitude: number;
  altitudeFt: number;
  speedKts: number;
  heading: number;
  verticalRateFpm: number;
  onGround: boolean;
  squawk: string;
  lastContactSec: number;
} | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const icao24 = trimString(value[0])?.toLowerCase();
  const callsignRaw = trimString(value[1])?.toUpperCase();
  const country = trimString(value[2]) ?? "Unknown";
  const longitude = parseFiniteNumber(value[5]);
  const latitude = parseFiniteNumber(value[6]);
  const baroAltitudeM = parseFiniteNumber(value[7]);
  const onGround = Boolean(value[8]);
  const velocityMps = parseFiniteNumber(value[9]);
  const heading = parseFiniteNumber(value[10]) ?? 0;
  const verticalRateMps = parseFiniteNumber(value[11]) ?? 0;
  const squawk = trimString(value[14]) ?? "";
  const lastContactSec = Math.max(0, Math.floor(parseFiniteNumber(value[4]) ?? 0));

  if (!icao24 || latitude === undefined || longitude === undefined) {
    return null;
  }

  const callsign = callsignRaw && callsignRaw.length > 0 ? callsignRaw : icao24.toUpperCase();
  const altitudeFt = Math.max(0, Math.round((baroAltitudeM ?? 0) * 3.28084));
  const speedKts = Math.max(0, Math.round((velocityMps ?? 0) * 1.94384));
  const verticalRateFpm = Math.round(verticalRateMps * 196.850394);

  return {
    icao24,
    callsign,
    country,
    longitude,
    latitude,
    altitudeFt,
    speedKts,
    heading,
    verticalRateFpm,
    onGround,
    squawk,
    lastContactSec,
  };
}

function buildAirSeaOpenSkyTrack(
  state: NonNullable<ReturnType<typeof parseOpenSkyStateTuple>>,
  nowSec: number,
): { aircraft: Record<string, unknown>; score: number; emergency: boolean; interesting: boolean } {
  const tags = new Set<string>();
  const squawk = state.squawk;
  const callsign = state.callsign;
  const region = inferAirSeaRegionFromCoordinates(state.latitude, state.longitude);
  const callsignMilitary = isLikelyMilitaryCallsign(callsign);
  const emergency = squawk === "7500" || squawk === "7600" || squawk === "7700";
  if (emergency) {
    tags.add("emergency");
    tags.add(`SQUAWK_${squawk}`);
  }
  if (callsignMilitary) {
    tags.add("military");
    tags.add("MIL_CALLSIGN");
  }
  if (region === "ukraine" || region === "middle_east") {
    tags.add("conflict-zone");
  }
  if (state.onGround) {
    tags.add("ground");
  }

  const type = inferAirSeaAircraftType(callsign, [...tags]);
  const severity = inferAirSeaAircraftSeverity([...tags]);
  const ageSeconds = Math.max(0, nowSec - state.lastContactSec);
  const adsbexchange = `https://globe.adsbexchange.com/?icao=${encodeURIComponent(state.icao24)}`;
  const flightradar24 = callsign
    ? `https://www.flightradar24.com/data/flights/${encodeURIComponent(callsign.toLowerCase())}`
    : undefined;

  let score = 0;
  if (emergency) score += 400;
  if (callsignMilitary) score += 220;
  if (region === "ukraine" || region === "middle_east") score += 40;
  if (!state.onGround) score += 20;
  score += Math.min(40, Math.floor(state.speedKts / 15));
  score += Math.min(30, Math.floor(state.altitudeFt / 2000));
  score -= Math.min(80, Math.floor(ageSeconds / 15));

  const interesting = emergency || callsignMilitary || (state.speedKts >= 260 && !state.onGround && ageSeconds <= 180);

  return {
    aircraft: {
      icao24: state.icao24,
      callsign,
      type,
      country: state.country,
      region,
      squawk,
      latitude: state.latitude,
      longitude: state.longitude,
      altitudeFt: state.altitudeFt,
      speedKts: state.speedKts,
      heading: state.heading,
      verticalRateFpm: state.verticalRateFpm,
      onGround: state.onGround,
      severity,
      tags: [...tags],
      description: `${callsign} — ${state.country}`,
      links: {
        adsbexchange,
        ...(flightradar24 ? { flightradar24 } : {}),
      },
    },
    score,
    emergency,
    interesting,
  };
}

function normalizeAirSeaAviationSnapshot(value: unknown): AirSeaAviationSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const timestamp = trimString(value.timestamp);
  const source = trimString(value.source) ?? "OpenSky Network";
  const emergencies = Math.max(0, Math.floor(parseFiniteNumber(value.emergencies) ?? 0));
  const fetchedAtMs = Math.max(0, Math.floor(parseFiniteNumber(value.fetchedAtMs) ?? 0));
  const aircraftRaw = Array.isArray(value.aircraft) ? value.aircraft : [];
  const aircraft = aircraftRaw.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  if (!timestamp || fetchedAtMs <= 0) {
    return null;
  }
  return {
    timestamp,
    source,
    emergencies,
    aircraft,
    fetchedAtMs,
  };
}

async function loadAirSeaAviationSnapshot(env: WorkerEnv): Promise<AirSeaAviationSnapshot | null> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.get !== "function") {
    return null;
  }
  const raw = await kv.get(resolveAirSeaAviationSnapshotKey(env));
  if (!raw) {
    return null;
  }
  try {
    return normalizeAirSeaAviationSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function storeAirSeaAviationSnapshot(env: WorkerEnv, snapshot: AirSeaAviationSnapshot): Promise<void> {
  const kv = env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    return;
  }
  const ttlSeconds = normalizeAirSeaAviationStaleSeconds(env.AIRSEA_AVIATION_STALE_SECONDS);
  try {
    await kv.put(resolveAirSeaAviationSnapshotKey(env), JSON.stringify(snapshot), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    // best-effort cache persistence
  }
}

async function fetchAirSeaAviationSnapshot(env: WorkerEnv): Promise<AirSeaAviationSnapshot | null> {
  if (!normalizeBoolean(env.AIRSEA_OPENSKY_ENABLED, DEFAULT_AIRSEA_OPENSKY_ENABLED)) {
    return null;
  }

  const endpoint = trimString(env.AIRSEA_OPENSKY_URL) ?? DEFAULT_AIRSEA_OPENSKY_URL;
  const timeoutMs = normalizeAirSeaOpenSkyTimeoutMs(env.AIRSEA_OPENSKY_TIMEOUT_MS);
  const username = trimString(env.AIRSEA_OPENSKY_USERNAME);
  const password = trimString(env.AIRSEA_OPENSKY_PASSWORD);

  const headers = new Headers({
    accept: "application/json",
    "user-agent": "intel-dashboard-airsea/1.0",
  });
  if (username && password) {
    headers.set("authorization", `Basic ${btoa(`${username}:${password}`)}`);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }
  const statesRaw = Array.isArray(payload.states) ? payload.states : [];
  const openskyTimeSec = Math.max(0, Math.floor(parseFiniteNumber(payload.time) ?? Date.now() / 1000));
  const nowSec = Math.max(openskyTimeSec, Math.floor(Date.now() / 1000));

  const candidates = statesRaw
    .map((entry) => parseOpenSkyStateTuple(entry))
    .filter((entry): entry is NonNullable<ReturnType<typeof parseOpenSkyStateTuple>> => entry !== null)
    .filter((entry) => entry.lastContactSec > 0 && nowSec - entry.lastContactSec <= 12 * 60)
    .map((entry) => buildAirSeaOpenSkyTrack(entry, nowSec));

  if (candidates.length === 0) {
    return null;
  }

  const interesting = candidates.filter((entry) => entry.interesting);
  const backup = candidates
    .filter((entry) => !entry.interesting)
    .sort((left, right) => right.score - left.score);

  const maxTracks = normalizeAirSeaAviationMaxTracks(env.AIRSEA_AVIATION_MAX_TRACKS);
  const picked = [...interesting.sort((left, right) => right.score - left.score), ...backup]
    .slice(0, maxTracks)
    .map((entry) => entry.aircraft);
  const emergencies = candidates.filter((entry) => entry.emergency).length;

  return {
    timestamp: new Date(openskyTimeSec * 1000).toISOString(),
    source: "OpenSky Network",
    emergencies,
    aircraft: picked,
    fetchedAtMs: Date.now(),
  };
}

async function resolveAirSeaAviationSnapshot(env: WorkerEnv): Promise<AirSeaAviationSnapshot | null> {
  const cached = await loadAirSeaAviationSnapshot(env);
  const nowMs = Date.now();
  const refreshMs = normalizeAirSeaAviationRefreshSeconds(env.AIRSEA_AVIATION_REFRESH_SECONDS) * 1000;
  const staleMs = normalizeAirSeaAviationStaleSeconds(env.AIRSEA_AVIATION_STALE_SECONDS) * 1000;

  if (cached && nowMs - cached.fetchedAtMs <= refreshMs) {
    return cached;
  }

  const live = await fetchAirSeaAviationSnapshot(env);
  if (live) {
    await storeAirSeaAviationSnapshot(env, live);
    return live;
  }

  if (cached && nowMs - cached.fetchedAtMs <= staleMs) {
    return {
      ...cached,
      source: cached.source.includes("cached") ? cached.source : `${cached.source} (cached)`,
    };
  }
  return null;
}

function toPublicAirSeaReport(item: NewsItem): PublicAirSeaIntelReport {
  const enriched = applyHeuristicEnrichment(item);
  const source = enriched.source ?? "OSINT Desk";
  const region = normalizeIntelRegion(enriched.region) ?? "global";
  const severity = normalizeIntelSeverity(enriched.severity) ?? inferSeverityFromText(`${enriched.title} ${enriched.summary ?? ""}`);
  const summary = trimString(enriched.summary) ?? enriched.title;
  const fallbackUser = source
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return {
    id: enriched.id,
    domain: inferAirSeaDomain(enriched),
    category: normalizeIntelCategory(enriched.category) ?? "news",
    channel: source,
    channelUsername: fallbackUser ? `@${fallbackUser}` : "@osint",
    text: summary,
    datetime: new Date(enriched.publishedAtMs).toISOString(),
    link: enriched.url,
    views: "0",
    severity,
    region,
    tags: inferAirSeaTags(enriched),
    media: [],
  };
}

async function handlePublicAirSeaFeed(args: {
  env: WorkerEnv;
  url: URL;
}): Promise<Response> {
  const items = await readNewsFeed(args.env);
  const maxItems = Math.max(normalizePublicIntelLimit(args.env.PUBLIC_INTEL_LIMIT), 250);
  const filtered = filterAndRankNewsForPublicIntel({
    items,
    searchParams: args.url.searchParams,
    env: args.env,
  }).slice(0, maxItems);
  const intelFeed = filtered.map((item) => toPublicAirSeaReport(item));
  const aviationSnapshot = await resolveAirSeaAviationSnapshot(args.env);
  const aviation = aviationSnapshot
    ? {
        timestamp: aviationSnapshot.timestamp,
        source: aviationSnapshot.source,
        emergencies: aviationSnapshot.emergencies,
        aircraft: aviationSnapshot.aircraft,
      }
    : {
        timestamp: "",
        source: "OpenSky Network",
        emergencies: 0,
        aircraft: [] as Array<Record<string, unknown>>,
      };
  const payload: PublicAirSeaPayload = {
    timestamp: new Date().toISOString(),
    aviation,
    intelFeed,
    stats: {
      aircraftCount: aviation.aircraft.length,
      airIntelCount: intelFeed.filter((item) => item.domain === "air").length,
      seaIntelCount: intelFeed.filter((item) => item.domain === "sea").length,
      totalIntel: intelFeed.length,
      critical: intelFeed.filter((item) => item.severity === "critical").length,
      high: intelFeed.filter((item) => item.severity === "high").length,
    },
  };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

async function parseRawRequestBody(
  request: Request,
  maxRequestBytes: number,
): Promise<{ ok: true; rawBody: string } | { ok: false; response: Response }> {
  const contentLength = readContentLength(request);
  if (contentLength !== undefined && contentLength > maxRequestBytes) {
    return { ok: false, response: errorJson(413, `Request body exceeds ${maxRequestBytes} bytes.`) };
  }

  return readRequestBodyWithLimit(request, maxRequestBytes);
}

async function readRequestBodyWithLimit(
  request: Request,
  maxRequestBytes: number,
): Promise<{ ok: true; rawBody: string } | { ok: false; response: Response }> {
  if (!request.body) {
    return { ok: true, rawBody: "" };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let rawBody = "";
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxRequestBytes) {
        return { ok: false, response: errorJson(413, `Request body exceeds ${maxRequestBytes} bytes.`) };
      }
      rawBody += decoder.decode(chunk, { stream: true });
    }
    rawBody += decoder.decode();
    return { ok: true, rawBody };
  } catch {
    return { ok: false, response: errorJson(400, "Invalid request body.") };
  } finally {
    reader.releaseLock();
  }
}

function constantTimeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const bytes = new Uint8Array(signatureBuffer);
  let output = "";
  for (const byte of bytes) {
    output += byte.toString(16).padStart(2, "0");
  }
  return output;
}

function parseStripeSignatureHeader(value: string): { timestamp: number; signatures: string[] } | null {
  const parts = value.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter((part) => part.length > 0);
  if (!timestampPart || signatures.length === 0) {
    return null;
  }
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  return { timestamp: Math.floor(timestamp), signatures };
}

async function verifyStripeWebhookSignature(args: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
}): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(args.signatureHeader);
  if (!parsed) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > STRIPE_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const signedPayload = `${parsed.timestamp}.${args.rawBody}`;
  const expected = await hmacSha256Hex(args.webhookSecret, signedPayload);
  return parsed.signatures.some((signature) => constantTimeEqualHex(signature, expected));
}

function formEncode(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.append(key, value);
  }
  return search.toString();
}

function extractStripeUserId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const clientReference = trimString(payload.client_reference_id);
  if (clientReference) {
    return clientReference;
  }

  const metadata = payload.metadata;
  if (isRecord(metadata)) {
    const metadataUserId = trimString(metadata.userId) ?? trimString(metadata.user_id);
    if (metadataUserId) {
      return metadataUserId;
    }
  }

  return undefined;
}

function extractStripeCustomerId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  return trimString(payload.customer) ?? undefined;
}

function extractStripeSubscriptionId(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  const direct = trimString(payload.subscription);
  if (direct) {
    return direct;
  }
  return trimString(payload.id) ?? undefined;
}

function mapStripeSubscriptionStatus(rawStatus: string | undefined): BillingStatus {
  switch (rawStatus) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "canceled":
      return "canceled";
    case "past_due":
    case "unpaid":
    case "incomplete_expired":
      return "expired";
    default:
      return "none";
  }
}

function buildStripeEventKey(env: WorkerEnv, eventId: string): string {
  const prefix = normalizeBillingNamespacePrefix(env.BILLING_NAMESPACE_PREFIX);
  return `${prefix}:stripe:event:${eventId}`;
}

function buildWebhookDedupePayload(provider: string, eventId: string, action: WebhookDedupeAction): string {
  return JSON.stringify({ provider, eventId, action });
}

function normalizeWebhookDedupeState(value: unknown): WebhookDedupeState | null {
  if (!isRecord(value)) return null;
  const state = value.state === "processing" || value.state === "completed" ? value.state : null;
  const updatedAtMs = parseFiniteNumber(value.updatedAtMs);
  const expiresAtMs = parseFiniteNumber(value.expiresAtMs);
  if (!state || updatedAtMs === undefined || expiresAtMs === undefined) {
    return null;
  }
  return {
    state,
    updatedAtMs: Math.max(0, Math.floor(updatedAtMs)),
    expiresAtMs: Math.max(0, Math.floor(expiresAtMs)),
  };
}

function resolveWebhookCoordinatorName(env: WorkerEnv): string {
  return resolveNewsCoordinatorName(env.NEWS_COORDINATOR_NAME);
}

async function mutateWebhookDedupeLease(args: {
  env: WorkerEnv;
  provider: string;
  eventId: string;
  action: WebhookDedupeAction;
}): Promise<{ duplicate: boolean }> {
  const namespace = args.env.NEWS_INGEST_COORDINATOR;
  if (!namespace) {
    throw new Error("Webhook dedupe coordinator binding is required.");
  }

  const objectId = namespace.idFromName(resolveWebhookCoordinatorName(args.env));
  const stub = namespace.get(objectId);
  const response = await stub.fetch("https://news-ingest.internal/webhook-dedupe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: buildWebhookDedupePayload(args.provider, args.eventId, args.action),
  });
  if (response.status === 409) {
    return { duplicate: true };
  }
  if (!response.ok) {
    throw new Error(`Webhook dedupe coordinator returned HTTP ${response.status}`);
  }
  return { duplicate: false };
}

async function handleStripeCheckout(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const existingAccount = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account: existingAccount,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "billing.checkout",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  if (entitlement.owner) {
    await appendBillingActivityEvent({
      env: args.env,
      userId,
      kind: "checkout_bypass_owner",
      source: "api",
      status: "owner",
      note: "Owner account bypassed checkout.",
      atMs: nowMs,
    });
    return responseJson(200, {
      ok: true,
      result: {
        userId,
        owner: true,
        bypassCheckout: true,
        checkoutSessionId: null,
        checkoutUrl: null,
        trialDays: normalizeTrialDays(args.env.BILLING_TRIAL_DAYS),
        monthlyPriceUsd: normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD),
      },
    });
  }

  const stripeSecretKey = trimString(args.env.STRIPE_SECRET_KEY);
  const stripePriceId = trimString(args.env.STRIPE_PRICE_ID);
  const successUrl = trimString(args.env.STRIPE_SUCCESS_URL);
  const cancelUrl = trimString(args.env.STRIPE_CANCEL_URL);
  const apiBase = trimString(args.env.STRIPE_API_BASE_URL) ?? DEFAULT_STRIPE_API_BASE;

  if (!stripeSecretKey || !stripePriceId || !successUrl || !cancelUrl) {
    return errorJson(500, "Stripe billing is not fully configured.");
  }

  const trialDays = normalizeTrialDays(args.env.BILLING_TRIAL_DAYS);
  const idempotencyBucketMinute = Math.floor(nowMs / 60_000);
  const idempotencyKey = `${userId}:${stripePriceId}:${idempotencyBucketMinute}`;

  const body = formEncode({
    mode: "subscription",
    "line_items[0][price]": stripePriceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: userId,
    "metadata[userId]": userId,
    "subscription_data[metadata][userId]": userId,
    "subscription_data[trial_period_days]": String(trialDays),
  });

  let response: Response;
  try {
    response = await fetch(`${apiBase}/v1/checkout/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripeSecretKey}`,
        "content-type": "application/x-www-form-urlencoded",
        "idempotency-key": idempotencyKey,
      },
      body,
    });
  } catch (error) {
    return errorJson(502, `Stripe checkout request failed: ${String(error)}`);
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    decoded = undefined;
  }

  if (!response.ok) {
    const errorMessage =
      isRecord(decoded) && isRecord(decoded.error) && typeof decoded.error.message === "string"
        ? decoded.error.message
        : `Stripe checkout failed with HTTP ${response.status}`;
    return errorJson(502, errorMessage);
  }

  if (!isRecord(decoded)) {
    return errorJson(502, "Stripe checkout returned invalid payload.");
  }

  const sessionId = trimString(decoded.id);
  const checkoutUrl = trimString(decoded.url);
  if (!sessionId || !checkoutUrl) {
    return errorJson(502, "Stripe checkout response missing session data.");
  }
  await appendBillingActivityEvent({
    env: args.env,
    userId,
    kind: "checkout_session_created",
    source: "api",
    status: existingAccount?.status ?? "none",
    note: "Stripe checkout session created.",
    atMs: nowMs,
  });

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      checkoutSessionId: sessionId,
      checkoutUrl,
      trialDays,
      monthlyPriceUsd: normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD),
    },
  });
}

async function handleStripePortal(args: {
  env: WorkerEnv;
  body: unknown;
}): Promise<Response> {
  const userId = await validateUserId(args.body, args.env);
  const nowMs = Date.now();
  const existingAccount = await loadBillingAccount(args.env, userId);
  const entitlement = computeEntitlementForUser({
    env: args.env,
    userId,
    nowMs,
    account: existingAccount,
  });
  const policy = resolveTierPolicy(args.env, entitlement.tier);
  const rateLimit = await enforceTierRateLimit({
    env: args.env,
    route: "billing.portal",
    userId,
    policy,
    nowMs,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  if (entitlement.owner) {
    await appendBillingActivityEvent({
      env: args.env,
      userId,
      kind: "portal_bypass_owner",
      source: "api",
      status: "owner",
      note: "Owner account bypassed Stripe billing portal.",
      atMs: nowMs,
    });
    return responseJson(200, {
      ok: true,
      result: {
        userId,
        owner: true,
        bypassPortal: true,
        portalSessionId: null,
        portalUrl: null,
      },
    });
  }

  const stripeSecretKey = trimString(args.env.STRIPE_SECRET_KEY);
  const returnUrl = trimString(args.env.STRIPE_PORTAL_RETURN_URL) ?? trimString(args.env.STRIPE_SUCCESS_URL);
  const apiBase = trimString(args.env.STRIPE_API_BASE_URL) ?? DEFAULT_STRIPE_API_BASE;
  if (!stripeSecretKey || !returnUrl) {
    return errorJson(500, "Stripe billing portal is not fully configured.");
  }

  const stripeCustomerId = trimString(existingAccount?.stripeCustomerId);
  if (!stripeCustomerId) {
    await appendBillingActivityEvent({
      env: args.env,
      userId,
      kind: "portal_pending_customer",
      source: "api",
      status: existingAccount?.status ?? "none",
      note: "Portal request blocked until Stripe customer id is present.",
      atMs: nowMs,
    });
    return responseJson(409, {
      ok: false,
      error: "Billing portal unavailable for this account yet. Please retry in a few moments.",
    });
  }

  const body = formEncode({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  let response: Response;
  try {
    response = await fetch(`${apiBase}/v1/billing_portal/sessions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${stripeSecretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (error) {
    return errorJson(502, `Stripe portal request failed: ${String(error)}`);
  }

  let decoded: unknown;
  try {
    decoded = await response.json();
  } catch {
    decoded = undefined;
  }

  if (!response.ok) {
    const errorMessage =
      isRecord(decoded) && isRecord(decoded.error) && typeof decoded.error.message === "string"
        ? decoded.error.message
        : `Stripe portal failed with HTTP ${response.status}`;
    return errorJson(502, errorMessage);
  }

  if (!isRecord(decoded)) {
    return errorJson(502, "Stripe portal returned invalid payload.");
  }

  const portalSessionId = trimString(decoded.id);
  const portalUrl = trimString(decoded.url);
  if (!portalSessionId || !portalUrl) {
    return errorJson(502, "Stripe portal response missing session data.");
  }
  await appendBillingActivityEvent({
    env: args.env,
    userId,
    kind: "portal_session_created",
    source: "api",
    status: existingAccount?.status ?? "none",
    note: "Stripe billing portal session created.",
    atMs: nowMs,
  });

  return responseJson(200, {
    ok: true,
    result: {
      userId,
      portalSessionId,
      portalUrl,
    },
  });
}

async function handleStripeWebhook(args: {
  env: WorkerEnv;
  rawBody: string;
  signatureHeader: string;
}): Promise<Response> {
  const webhookSecret = trimString(args.env.STRIPE_WEBHOOK_SECRET);
  if (!webhookSecret) {
    return errorJson(500, "Stripe webhook secret is not configured.");
  }

  const verified = await verifyStripeWebhookSignature({
    rawBody: args.rawBody,
    signatureHeader: args.signatureHeader,
    webhookSecret,
  });
  if (!verified) {
    return errorJson(400, "Invalid Stripe signature.");
  }

  let event: unknown;
  try {
    event = JSON.parse(args.rawBody);
  } catch {
    return errorJson(400, "Invalid Stripe event payload.");
  }
  if (!isRecord(event)) {
    return errorJson(400, "Invalid Stripe event payload.");
  }

  const eventId = trimString(event.id);
  const eventType = trimString(event.type) ?? "unknown";
  const eventCreatedSec = Math.floor(parseFiniteNumber(event.created) ?? Date.now() / 1000);
  if (!eventId) {
    return errorJson(400, "Stripe event id is missing.");
  }

  let reservation: { duplicate: boolean };
  try {
    reservation = await mutateWebhookDedupeLease({
      env: args.env,
      provider: "stripe",
      eventId,
      action: "reserve",
    });
  } catch (error) {
    return errorJson(503, `Stripe webhook dedupe unavailable: ${String(error)}`);
  }
  if (reservation.duplicate) {
    return responseJson(200, {
      ok: true,
      result: {
        eventId,
        eventType,
        processed: false,
        duplicate: true,
      },
    });
  }

  const kv = args.env.USAGE_KV;
  if (!kv || typeof kv.put !== "function") {
    await mutateWebhookDedupeLease({
      env: args.env,
      provider: "stripe",
      eventId,
      action: "release",
    }).catch(() => {});
    return errorJson(500, "USAGE_KV binding with put() is required for Stripe webhook handling.");
  }

  const eventData = isRecord(event.data) ? event.data : {};
  const eventObject = isRecord(eventData.object) ? eventData.object : {};
  const userId = extractStripeUserId(eventObject);
  const stripeCustomerId = extractStripeCustomerId(eventObject);

  let accountUpdated = false;
  try {
    if (userId) {
      const nowMs = Date.now();
      const monthlyPriceUsd = normalizeMonthlyPriceUsd(args.env.BILLING_MONTHLY_PRICE_USD);
      const previous = await loadBillingAccount(args.env, userId);

      if ((previous?.lastStripeEventCreatedSec ?? 0) > eventCreatedSec) {
        await appendBillingActivityEvent({
          env: args.env,
          userId,
          kind: "stripe_event_ignored_out_of_order",
          source: "stripe",
          status: previous?.status ?? "none",
          stripeEventId: eventId,
          stripeEventType: eventType,
          note: "Ignored older Stripe event based on creation timestamp.",
        });
        await mutateWebhookDedupeLease({
          env: args.env,
          provider: "stripe",
          eventId,
          action: "complete",
        });
        return responseJson(200, {
          ok: true,
          result: {
            eventId,
            eventType,
            processed: false,
            duplicate: false,
            ignoredOutOfOrder: true,
          },
        });
      }

      if (eventType === "checkout.session.completed") {
        const account: BillingAccount = {
          userId,
          status: "active",
          ...(previous?.trialStartedAtMs === undefined ? {} : { trialStartedAtMs: previous.trialStartedAtMs }),
          ...(previous?.trialEndsAtMs === undefined ? {} : { trialEndsAtMs: previous.trialEndsAtMs }),
          subscribedAtMs: nowMs,
          ...(stripeCustomerId ? { stripeCustomerId } : previous?.stripeCustomerId ? { stripeCustomerId: previous.stripeCustomerId } : {}),
          ...(extractStripeSubscriptionId(eventObject)
            ? { stripeSubscriptionId: extractStripeSubscriptionId(eventObject) }
            : previous?.stripeSubscriptionId
              ? { stripeSubscriptionId: previous.stripeSubscriptionId }
              : {}),
          lastStripeEventCreatedSec: eventCreatedSec,
          monthlyPriceUsd,
          updatedAtMs: nowMs,
        };
        await saveBillingAccount(args.env, account);
        accountUpdated = true;
        await appendBillingActivityEvent({
          env: args.env,
          userId,
          kind: "stripe_checkout_completed",
          source: "stripe",
          status: account.status,
          stripeEventId: eventId,
          stripeEventType: eventType,
          note: "Stripe checkout completed and account set active.",
        });
      } else if (eventType === "customer.subscription.updated") {
        const stripeStatus = trimString(eventObject.status);
        const mapped = mapStripeSubscriptionStatus(stripeStatus);
        const trialEndSec = parseFiniteNumber(eventObject.trial_end);
        const trialEndsAtMs = trialEndSec === undefined ? previous?.trialEndsAtMs : Math.max(0, Math.floor(trialEndSec * 1000));
        const account: BillingAccount = {
          userId,
          status: mapped,
          ...(previous?.trialStartedAtMs === undefined ? {} : { trialStartedAtMs: previous.trialStartedAtMs }),
          ...(trialEndsAtMs === undefined ? {} : { trialEndsAtMs }),
          ...(mapped === "active" ? { subscribedAtMs: nowMs } : {}),
          ...(mapped === "canceled" ? { canceledAtMs: nowMs } : {}),
          ...(stripeCustomerId ? { stripeCustomerId } : previous?.stripeCustomerId ? { stripeCustomerId: previous.stripeCustomerId } : {}),
          ...(extractStripeSubscriptionId(eventObject)
            ? { stripeSubscriptionId: extractStripeSubscriptionId(eventObject) }
            : previous?.stripeSubscriptionId
              ? { stripeSubscriptionId: previous.stripeSubscriptionId }
              : {}),
          lastStripeEventCreatedSec: eventCreatedSec,
          monthlyPriceUsd,
          updatedAtMs: nowMs,
        };
        await saveBillingAccount(args.env, account);
        accountUpdated = true;
        await appendBillingActivityEvent({
          env: args.env,
          userId,
          kind: "stripe_subscription_updated",
          source: "stripe",
          status: account.status,
          stripeEventId: eventId,
          stripeEventType: eventType,
          note: stripeStatus ? `Stripe subscription status=${stripeStatus}.` : "Stripe subscription updated.",
        });
      } else if (eventType === "customer.subscription.deleted") {
        const account: BillingAccount = {
          userId,
          status: "canceled",
          ...(previous?.trialStartedAtMs === undefined ? {} : { trialStartedAtMs: previous.trialStartedAtMs }),
          ...(previous?.trialEndsAtMs === undefined ? {} : { trialEndsAtMs: previous.trialEndsAtMs }),
          ...(previous?.subscribedAtMs === undefined ? {} : { subscribedAtMs: previous.subscribedAtMs }),
          canceledAtMs: nowMs,
          ...(stripeCustomerId ? { stripeCustomerId } : previous?.stripeCustomerId ? { stripeCustomerId: previous.stripeCustomerId } : {}),
          ...(extractStripeSubscriptionId(eventObject)
            ? { stripeSubscriptionId: extractStripeSubscriptionId(eventObject) }
            : previous?.stripeSubscriptionId
              ? { stripeSubscriptionId: previous.stripeSubscriptionId }
              : {}),
          lastStripeEventCreatedSec: eventCreatedSec,
          monthlyPriceUsd,
          updatedAtMs: nowMs,
        };
        await saveBillingAccount(args.env, account);
        accountUpdated = true;
        await appendBillingActivityEvent({
          env: args.env,
          userId,
          kind: "stripe_subscription_deleted",
          source: "stripe",
          status: account.status,
          stripeEventId: eventId,
          stripeEventType: eventType,
          note: "Stripe subscription deleted.",
        });
      }
    }

    await mutateWebhookDedupeLease({
      env: args.env,
      provider: "stripe",
      eventId,
      action: "complete",
    });

    return responseJson(200, {
      ok: true,
      result: {
        eventId,
        eventType,
        processed: true,
        accountUpdated,
        userMapped: Boolean(userId),
      },
    });
  } catch (error) {
    await mutateWebhookDedupeLease({
      env: args.env,
      provider: "stripe",
      eventId,
      action: "release",
    }).catch(() => {});
    throw error;
  }
}

export class NewsIngestCoordinator {
  private readonly state: DurableObjectState;
  private readonly env: WorkerEnv;

  constructor(state: DurableObjectState, env: WorkerEnv) {
    this.state = state;
    this.env = env;
  }

  private async readHotItems(limit: number): Promise<NewsItem[]> {
    const stored = await this.state.storage.get<unknown>("hot_entries");
    if (stored === undefined) {
      return [];
    }
    return normalizeNewsItems(stored).slice(0, limit);
  }

  private async handleWebhookDedupe(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" });
    }

    const parsed = await parseJsonRequestBody(
      request,
      normalizeMaxRequestBytes(this.env.USAGE_MAX_REQUEST_BYTES),
    );
    if (!parsed.ok) {
      return parsed.response;
    }
    if (!isRecord(parsed.body)) {
      return errorJson(400, "Expected JSON object body.");
    }

    const provider = trimString(parsed.body.provider)?.toLowerCase() ?? "";
    const eventId = trimString(parsed.body.eventId) ?? "";
    const actionRaw = trimString(parsed.body.action)?.toLowerCase() ?? "";
    const action: WebhookDedupeAction | null =
      actionRaw === "reserve" || actionRaw === "complete" || actionRaw === "release"
        ? actionRaw
        : null;
    if (!provider || !eventId || !action) {
      return errorJson(400, "Expected provider, eventId, and valid action.");
    }

    const key = `webhook:${provider}:${eventId}`;
    const nowMs = Date.now();
    const completedTtlMs = DEFAULT_OUTBOUND_DEDUPE_TTL_SECONDS * 1000;
    const processingTtlMs = DEFAULT_WEBHOOK_PROCESSING_LEASE_SECONDS * 1000;

    return this.state.blockConcurrencyWhile(async () => {
      const existing = normalizeWebhookDedupeState(await this.state.storage.get<unknown>(key));
      if (action === "reserve") {
        if (existing && existing.expiresAtMs > nowMs) {
          return errorJson(409, "Duplicate webhook event.");
        }
        await this.state.storage.put(key, {
          state: "processing",
          updatedAtMs: nowMs,
          expiresAtMs: nowMs + processingTtlMs,
        } satisfies WebhookDedupeState);
        return responseJson(200, {
          ok: true,
          result: {
            reserved: true,
            duplicate: false,
          },
        });
      }

      if (action === "release") {
        if (existing?.state === "processing") {
          await this.state.storage.delete(key);
        }
        return responseJson(200, {
          ok: true,
          result: {
            released: true,
          },
        });
      }

      await this.state.storage.put(key, {
        state: "completed",
        updatedAtMs: nowMs,
        expiresAtMs: nowMs + completedTtlMs,
      } satisfies WebhookDedupeState);
      return responseJson(200, {
        ok: true,
        result: {
          completed: true,
        },
      });
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/webhook-dedupe") {
      return this.handleWebhookDedupe(request);
    }

    if (url.pathname === "/hot") {
      if (request.method !== "GET") {
        return errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET" });
      }

      const defaultLimit = normalizeNewsHotOverlayLimit(this.env.NEWS_HOT_OVERLAY_LIMIT);
      const requestedLimit = parseFiniteNumber(url.searchParams.get("limit"));
      const limit =
        requestedLimit === undefined ? defaultLimit : clamp(Math.floor(requestedLimit), 1, defaultLimit);
      const items = await this.readHotItems(limit);
      return responseJson(200, {
        ok: true,
        result: { items },
      });
    }

    if (url.pathname !== "/publish") {
      return errorJson(404, "Not Found.");
    }

    if (request.method !== "POST") {
      return errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" });
    }

    const parsed = await parseJsonRequestBody(
      request,
      normalizeMaxRequestBytes(this.env.USAGE_MAX_REQUEST_BYTES),
    );
    if (!parsed.ok) {
      return parsed.response;
    }
    if (!isRecord(parsed.body) || !Array.isArray(parsed.body.entries)) {
      return errorJson(400, "Expected entries array.");
    }

    const inputItems = normalizeNewsItems(parsed.body.entries);
    if (inputItems.length < 1) {
      return errorJson(400, "Expected at least one valid news entry.");
    }
    if (inputItems.length > MAX_NEWS_ENTRIES) {
      return errorJson(400, `Expected no more than ${MAX_NEWS_ENTRIES} news entries.`);
    }

    const merge = parsed.body.merge !== false;
    const shardName = trimString(parsed.body.shardName);
    const result = await this.state.blockConcurrencyWhile(async () => {
      const published = await publishNewsFeed({
        env: this.env,
        inputItems,
        merge,
        shardName,
      });
      const hotLimit = normalizeNewsHotOverlayLimit(this.env.NEWS_HOT_OVERLAY_LIMIT);
      const existingHot = await this.readHotItems(hotLimit);
      const hotEntries = mergeNewsStreamsDescending(inputItems, existingHot, hotLimit);
      await this.state.storage.put("hot_entries", hotEntries);
      return published;
    });

    return responseJson(200, {
      ok: true,
      result,
    });
  }
}

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const endpointPath = normalizePath(env.USAGE_ENDPOINT_PATH, DEFAULT_ENDPOINT_PATH);
    const seedPath = resolveSeedEndpointPath(endpointPath, env.USAGE_SEED_ENDPOINT_PATH);
    const newsPath = normalizePath(env.NEWS_ENDPOINT_PATH, DEFAULT_NEWS_ENDPOINT_PATH);
    const newsPublishPath = normalizePath(env.NEWS_PUBLISH_PATH, DEFAULT_NEWS_PUBLISH_PATH);
    const billingStatusPath = normalizePath(env.BILLING_STATUS_PATH, DEFAULT_BILLING_STATUS_PATH);
    const featureGatesPath = normalizePath(env.FEATURE_GATES_PATH, DEFAULT_FEATURE_GATES_PATH);
    const userInfoPath = normalizePath(env.USER_INFO_PATH, DEFAULT_USER_INFO_PATH);
    const adminCrmSummaryPath = normalizePath(
      env.ADMIN_CRM_SUMMARY_PATH,
      DEFAULT_ADMIN_CRM_SUMMARY_PATH,
    );
    const adminCrmAiTelemetryPath = normalizePath(
      env.ADMIN_CRM_AI_TELEMETRY_PATH,
      DEFAULT_ADMIN_CRM_AI_TELEMETRY_PATH,
    );
    const adminCrmCustomerPath = normalizePath(
      env.ADMIN_CRM_CUSTOMER_PATH,
      DEFAULT_ADMIN_CRM_CUSTOMER_PATH,
    );
    const adminCrmCancelSubscriptionPath = normalizePath(
      env.ADMIN_CRM_CANCEL_SUBSCRIPTION_PATH,
      DEFAULT_ADMIN_CRM_CANCEL_SUBSCRIPTION_PATH,
    );
    const adminCrmRefundPath = normalizePath(
      env.ADMIN_CRM_REFUND_PATH,
      DEFAULT_ADMIN_CRM_REFUND_PATH,
    );
    const landingPath = normalizePath(env.LANDING_PATH, DEFAULT_LANDING_PATH);
    const sourcesPath = normalizePath(env.SOURCES_PATH, DEFAULT_SOURCES_PATH);
    const aiJobsPath = normalizePath(env.AI_JOBS_PATH, DEFAULT_AI_JOBS_PATH);
    const billingStartTrialPath = normalizePath(
      env.BILLING_START_TRIAL_PATH,
      DEFAULT_BILLING_START_TRIAL_PATH,
    );
    const billingSubscribePath = normalizePath(
      env.BILLING_SUBSCRIBE_PATH,
      DEFAULT_BILLING_SUBSCRIBE_PATH,
    );
    const billingCheckoutPath = normalizePath(
      env.BILLING_CHECKOUT_PATH,
      DEFAULT_BILLING_CHECKOUT_PATH,
    );
    const billingPortalPath = normalizePath(
      env.BILLING_PORTAL_PATH,
      DEFAULT_BILLING_PORTAL_PATH,
    );
    const billingActivityPath = normalizePath(
      env.BILLING_ACTIVITY_PATH,
      DEFAULT_BILLING_ACTIVITY_PATH,
    );
    const billingWebhookPath = normalizePath(
      env.BILLING_WEBHOOK_PATH,
      DEFAULT_BILLING_WEBHOOK_PATH,
    );
    const outboundPublishPath = normalizePath(
      env.OUTBOUND_PUBLISH_PATH,
      DEFAULT_OUTBOUND_PUBLISH_PATH,
    );
    const maxRequestBytes = normalizeMaxRequestBytes(env.USAGE_MAX_REQUEST_BYTES);
    const cacheTtlSeconds = normalizeCacheTtlSeconds(env.USAGE_CACHE_TTL_SECONDS);

    const startedAt = Date.now();
    const cacheNamespace = trimString(env.USAGE_CACHE_NAMESPACE) ?? "default";
    const mode = normalizeStorageMode(env.USAGE_STORAGE_MODE);

    const finalize = (
      response: Response,
      meta: { rpcMethod: string; cacheHit: boolean; outcome: string },
    ): Response => {
      const securedResponse = applyDefaultSecurityHeaders(response);
      writeUsageAnalytics({
        env,
        path: url.pathname,
        method: request.method,
        rpcMethod: meta.rpcMethod,
        mode,
        cacheHit: meta.cacheHit,
        status: securedResponse.status,
        durationMs: Date.now() - startedAt,
        outcome: meta.outcome,
      });
      return securedResponse;
    };

    const enforceApiToken = (): Response | null => {
      const expectedToken = trimString(env.USAGE_DATA_SOURCE_TOKEN);
      if (!expectedToken) {
        return errorJson(500, "Server misconfiguration: USAGE_DATA_SOURCE_TOKEN is required.");
      }
      const providedToken = parseBearerToken(request);
      if (!matchesBearerToken(providedToken, expectedToken)) {
        return errorJson(401, "Unauthorized.");
      }
      return null;
    };

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === landingPath)) {
      return finalize(renderLandingPage(env), {
        rpcMethod: "landing",
        cacheHit: false,
        outcome: "landing",
      });
    }

    if (url.pathname === "/api/intel") {
      if (!isPublicFeedRoutesEnabled(env) && !isInternalFeedProxyRequest(request, env)) {
        return finalize(errorJson(404, "Not Found."), {
          rpcMethod: "public-intel",
          cacheHit: false,
          outcome: "disabled",
        });
      }
      if (request.method !== "GET") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET" }), {
          rpcMethod: "public-intel",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      return finalize(await handlePublicIntelFeed({ env, url }), {
        rpcMethod: "public-intel",
        cacheHit: false,
        outcome: "ok",
      });
    }

    if (url.pathname === "/api/briefings") {
      if (!isPublicFeedRoutesEnabled(env) && !isInternalFeedProxyRequest(request, env)) {
        return finalize(errorJson(404, "Not Found."), {
          rpcMethod: "public-briefings",
          cacheHit: false,
          outcome: "disabled",
        });
      }
      if (request.method !== "GET") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET" }), {
          rpcMethod: "public-briefings",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      return finalize(await handlePublicBriefings({ env, url }), {
        rpcMethod: "public-briefings",
        cacheHit: false,
        outcome: "ok",
      });
    }

    if (url.pathname === "/api/air-sea") {
      if (!isPublicFeedRoutesEnabled(env) && !isInternalFeedProxyRequest(request, env)) {
        return finalize(errorJson(404, "Not Found."), {
          rpcMethod: "public-air-sea",
          cacheHit: false,
          outcome: "disabled",
        });
      }
      if (request.method !== "GET") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET" }), {
          rpcMethod: "public-air-sea",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      return finalize(await handlePublicAirSeaFeed({ env, url }), {
        rpcMethod: "public-air-sea",
        cacheHit: false,
        outcome: "ok",
      });
    }

    if (url.pathname === newsPublishPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "news.publish",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const adminError = requireAdminToken(request, env);
      if (adminError) {
        return finalize(adminError, {
          rpcMethod: "news.publish",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "news.publish",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleNewsPublish({ env, body: parsed.body, ctx }), {
        rpcMethod: "news.publish",
        cacheHit: false,
        outcome: "news-publish",
      });
    }

    if (url.pathname === newsPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "news.get",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "news.get",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "news.get",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleNewsGet({ env, body: parsed.body }), {
        rpcMethod: "news.get",
        cacheHit: false,
        outcome: "news-get",
      });
    }

    if (url.pathname === billingStatusPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.status",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "billing.status",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.status",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleBillingStatus({ env, body: parsed.body }), {
        rpcMethod: "billing.status",
        cacheHit: false,
        outcome: "billing-status",
      });
    }

    if (url.pathname === billingActivityPath) {
      if (request.method !== "GET" && request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET, POST" }), {
          rpcMethod: "billing.activity",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "billing.activity",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }

      if (request.method === "GET") {
        const body = {
          userId: url.searchParams.get("userId") ?? undefined,
          userSig: url.searchParams.get("userSig") ?? undefined,
          limit: url.searchParams.get("limit") ?? undefined,
        };
        return finalize(await handleBillingActivity({ env, body }), {
          rpcMethod: "billing.activity",
          cacheHit: false,
          outcome: "billing-activity",
        });
      }

      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.activity",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleBillingActivity({ env, body: parsed.body }), {
        rpcMethod: "billing.activity",
        cacheHit: false,
        outcome: "billing-activity",
      });
    }

    if (url.pathname === featureGatesPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "feature-gates",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "feature-gates",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "feature-gates",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleFeatureGates({ env, body: parsed.body }), {
        rpcMethod: "feature-gates",
        cacheHit: false,
        outcome: "feature-gates",
      });
    }

    if (url.pathname === userInfoPath) {
      if (request.method !== "GET" && request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET, POST" }), {
          rpcMethod: "user-info",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "user-info",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }

      if (request.method === "GET") {
        const body = {
          userId: url.searchParams.get("userId") ?? undefined,
          userSig: url.searchParams.get("userSig") ?? undefined,
        };
        return finalize(await handleUserInfo({ env, body }), {
          rpcMethod: "user-info",
          cacheHit: false,
          outcome: "user-info",
        });
      }

      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "user-info",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleUserInfo({ env, body: parsed.body }), {
        rpcMethod: "user-info",
        cacheHit: false,
        outcome: "user-info",
      });
    }

    if (url.pathname === adminCrmSummaryPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "admin.crm.summary",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "admin.crm.summary",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "admin.crm.summary",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAdminCrmSummary({ env, body: parsed.body }), {
        rpcMethod: "admin.crm.summary",
        cacheHit: false,
        outcome: "admin-crm-summary",
      });
    }

    if (url.pathname === adminCrmAiTelemetryPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "admin.crm.ai_telemetry",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "admin.crm.ai_telemetry",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "admin.crm.ai_telemetry",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAdminCrmAiTelemetry({ env, body: parsed.body }), {
        rpcMethod: "admin.crm.ai_telemetry",
        cacheHit: false,
        outcome: "admin-crm-ai-telemetry",
      });
    }

    if (url.pathname === adminCrmCustomerPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "admin.crm.customer",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "admin.crm.customer",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "admin.crm.customer",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAdminCrmCustomer({ env, body: parsed.body }), {
        rpcMethod: "admin.crm.customer",
        cacheHit: false,
        outcome: "admin-crm-customer",
      });
    }

    if (url.pathname === adminCrmCancelSubscriptionPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "admin.crm.cancel-subscription",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "admin.crm.cancel-subscription",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "admin.crm.cancel-subscription",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAdminCrmCancelSubscription({ env, body: parsed.body }), {
        rpcMethod: "admin.crm.cancel-subscription",
        cacheHit: false,
        outcome: "admin-crm-cancel-subscription",
      });
    }

    if (url.pathname === adminCrmRefundPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "admin.crm.refund",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "admin.crm.refund",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "admin.crm.refund",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAdminCrmRefund({ env, body: parsed.body }), {
        rpcMethod: "admin.crm.refund",
        cacheHit: false,
        outcome: "admin-crm-refund",
      });
    }

    if (url.pathname === sourcesPath) {
      if (request.method !== "GET" && request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET, POST" }), {
          rpcMethod: "sources.catalog",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "sources.catalog",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }

      if (request.method === "GET") {
        const body = {
          q: url.searchParams.get("q") ?? undefined,
          category: url.searchParams.get("category") ?? undefined,
          region: url.searchParams.get("region") ?? undefined,
          language: url.searchParams.get("language") ?? undefined,
          sourceType: url.searchParams.get("sourceType") ?? undefined,
          trustTier: url.searchParams.get("trustTier") ?? undefined,
          latencyTier: url.searchParams.get("latencyTier") ?? undefined,
          acquisitionMethod: url.searchParams.get("acquisitionMethod") ?? undefined,
          tags: url.searchParams.get("tags") ?? undefined,
          limit: url.searchParams.get("limit") ?? undefined,
        };
        return finalize(await handleSourcesCatalog({ body }), {
          rpcMethod: "sources.catalog",
          cacheHit: false,
          outcome: "sources-catalog",
        });
      }

      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "sources.catalog",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }

      return finalize(await handleSourcesCatalog({ body: parsed.body }), {
        rpcMethod: "sources.catalog",
        cacheHit: false,
        outcome: "sources-catalog",
      });
    }

    if (url.pathname === aiJobsPath) {
      if (request.method !== "POST" && request.method !== "GET") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "GET, POST" }), {
          rpcMethod: "ai.jobs",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const adminError = requireAiJobsAdminToken(request, env);
      if (adminError) {
        return finalize(adminError, {
          rpcMethod: "ai.jobs",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }

      if (request.method === "GET") {
        const batchId = trimString(url.searchParams.get("batchId") ?? undefined);
        if (!batchId) {
          return finalize(errorJson(400, "batchId query parameter is required."), {
            rpcMethod: "ai.jobs",
            cacheHit: false,
            outcome: "invalid-request",
          });
        }
        return finalize(await handleAiJobsStatus({ env, batchId }), {
          rpcMethod: "ai.jobs",
          cacheHit: false,
          outcome: "ai-jobs-status",
        });
      }

      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "ai.jobs",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleAiJobs({ env, body: parsed.body, ctx }), {
        rpcMethod: "ai.jobs",
        cacheHit: false,
        outcome: "ai-jobs",
      });
    }

    if (url.pathname === billingStartTrialPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.startTrial",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "billing.startTrial",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.startTrial",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleBillingStartTrial({ env, body: parsed.body }), {
        rpcMethod: "billing.startTrial",
        cacheHit: false,
        outcome: "billing-start-trial",
      });
    }

    if (url.pathname === billingSubscribePath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.subscribe",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const adminError = requireAdminToken(request, env);
      if (adminError) {
        return finalize(adminError, {
          rpcMethod: "billing.subscribe",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.subscribe",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleBillingSubscribe({ env, body: parsed.body }), {
        rpcMethod: "billing.subscribe",
        cacheHit: false,
        outcome: "billing-subscribe",
      });
    }

    if (url.pathname === billingCheckoutPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.checkout",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "billing.checkout",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.checkout",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleStripeCheckout({ env, body: parsed.body }), {
        rpcMethod: "billing.checkout",
        cacheHit: false,
        outcome: "billing-checkout",
      });
    }

    if (url.pathname === billingPortalPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.portal",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const tokenError = enforceApiToken();
      if (tokenError) {
        return finalize(tokenError, {
          rpcMethod: "billing.portal",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "billing.portal",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(await handleStripePortal({ env, body: parsed.body }), {
        rpcMethod: "billing.portal",
        cacheHit: false,
        outcome: "billing-portal",
      });
    }

    if (url.pathname === billingWebhookPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "billing.webhook",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const signatureHeader = request.headers.get("stripe-signature");
      if (!signatureHeader) {
        return finalize(errorJson(400, "Stripe-Signature header is required."), {
          rpcMethod: "billing.webhook",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      const raw = await parseRawRequestBody(request, maxRequestBytes);
      if (!raw.ok) {
        return finalize(raw.response, {
          rpcMethod: "billing.webhook",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      return finalize(
        await handleStripeWebhook({
          env,
          rawBody: raw.rawBody,
          signatureHeader,
        }),
        {
          rpcMethod: "billing.webhook",
          cacheHit: false,
          outcome: "billing-webhook",
        },
      );
    }

    if (url.pathname === outboundPublishPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const adminError = requireAdminToken(request, env);
      if (adminError) {
        return finalize(adminError, {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      if (!isRecord(parsed.body)) {
        return finalize(errorJson(400, "Expected JSON object body."), {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }

      const items = normalizeNewsItems(parsed.body.entries);
      if (items.length < 1) {
        return finalize(errorJson(400, "Expected at least one valid news entry."), {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      const outboundPayload = normalizeOutboundPublishPayload(parsed.body, env);
      if (!outboundPayload) {
        return finalize(
          errorJson(400, "Expected targets array with 1-20 valid outbound targets and optional dedupe fields."),
          {
            rpcMethod: "outbound.publish",
            cacheHit: false,
            outcome: "invalid-request",
          },
        );
      }

      try {
        const result = await deliverOutboundTargets({ env, items, payload: outboundPayload });
        return finalize(responseJson(200, { ok: true, result }), {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "outbound-publish",
        });
      } catch (error) {
        return finalize(errorJson(500, `Outbound publish failed: ${String(error)}`), {
          rpcMethod: "outbound.publish",
          cacheHit: false,
          outcome: "error",
        });
      }
    }

    if (url.pathname === seedPath) {
      if (request.method !== "POST") {
        return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
          rpcMethod: "seed",
          cacheHit: false,
          outcome: "method-not-allowed",
        });
      }
      const parsed = await parseJsonRequestBody(request, maxRequestBytes);
      if (!parsed.ok) {
        return finalize(parsed.response, {
          rpcMethod: "seed",
          cacheHit: false,
          outcome: "invalid-request",
        });
      }
      const rewrittenRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(parsed.body),
      });
      return finalize(await seedKvStorage({ env, request: rewrittenRequest, endpointPath: seedPath }), {
        rpcMethod: "seed",
        cacheHit: false,
        outcome: "seed",
      });
    }

    if (url.pathname !== endpointPath) {
      return finalize(errorJson(404, "Not Found."), {
        rpcMethod: "unknown",
        cacheHit: false,
        outcome: "not-found",
      });
    }

    if (request.method !== "POST") {
      return finalize(errorJsonWithHeaders(405, "Method Not Allowed.", { allow: "POST" }), {
        rpcMethod: "unknown",
        cacheHit: false,
        outcome: "method-not-allowed",
      });
    }

    const expectedToken = trimString(env.USAGE_DATA_SOURCE_TOKEN);
    if (expectedToken) {
      const providedToken = parseBearerToken(request);
      if (!matchesBearerToken(providedToken, expectedToken)) {
        return finalize(errorJson(401, "Unauthorized."), {
          rpcMethod: "unknown",
          cacheHit: false,
          outcome: "unauthorized",
        });
      }
    }

    const parsed = await parseJsonRequestBody(request, maxRequestBytes);
    if (!parsed.ok) {
      return finalize(parsed.response, {
        rpcMethod: "unknown",
        cacheHit: false,
        outcome: "invalid-request",
      });
    }
    const body = parsed.body;

    if (!isRecord(body) || !isRpcMethod(body.method)) {
      return finalize(errorJson(400, "Invalid RPC method."), {
        rpcMethod: "unknown",
        cacheHit: false,
        outcome: "invalid-method",
      });
    }

    let params: JsonRecord;
    try {
      params = sanitizeRpcParams(body.method, body.params);
    } catch (error) {
      return finalize(errorJson(400, (error as Error).message), {
        rpcMethod: body.method,
        cacheHit: false,
        outcome: "invalid-params",
      });
    }

    if (mode === "kv") {
      if (cacheTtlSeconds > 0) {
      const cacheKey = cacheRequestKey({
        request,
        endpointPath,
        namespace: cacheNamespace,
        method: body.method,
        params,
      });

      const edgeCache = getDefaultCache();
      const cached = edgeCache ? await edgeCache.match(cacheKey) : undefined;
      if (cached) {
        return finalize(cached, {
          rpcMethod: body.method,
          cacheHit: true,
          outcome: "ok",
          });
        }

        const liveResponse = await callKvStorage({ env, method: body.method, params });
        if (liveResponse.ok && liveResponse.status === 200) {
          const cacheable = liveResponse.clone();
          cacheable.headers.set("cache-control", `public, max-age=${cacheTtlSeconds}`);
          if (ctx && edgeCache) {
            ctx.waitUntil(edgeCache.put(cacheKey, cacheable));
          }
        }
        return finalize(liveResponse, {
          rpcMethod: body.method,
          cacheHit: false,
          outcome: liveResponse.ok ? "ok" : "error",
        });
      }
      const response = await callKvStorage({ env, method: body.method, params });
      return finalize(response, {
        rpcMethod: body.method,
        cacheHit: false,
        outcome: response.ok ? "ok" : "error",
      });
    }

    const response = await callUsageBackend({
      env,
      method: body.method,
      params,
    });
    return finalize(response, {
      rpcMethod: body.method,
      cacheHit: false,
      outcome: response.ok ? "ok" : "error",
    });
  },

  async scheduled(_event: ScheduledController, env: WorkerEnv): Promise<void> {
    const endpointPath = normalizePath(env.USAGE_ENDPOINT_PATH, DEFAULT_ENDPOINT_PATH);
    const cacheNamespace = trimString(env.USAGE_CACHE_NAMESPACE) ?? "default";

    if (
      env.AI_JOB_QUEUE &&
      typeof env.AI_JOB_QUEUE.send === "function" &&
      env.USAGE_KV &&
      typeof env.USAGE_KV.get === "function" &&
      typeof env.USAGE_KV.list === "function"
    ) {
      const recoveryStartedAt = Date.now();
      try {
        const recovered = await recoverStaleAiBatches({
          env,
          nowMs: recoveryStartedAt,
        });
        writeUsageAnalytics({
          env,
          path: endpointPath,
          method: "SCHEDULED",
          rpcMethod: "aiBatchRecover",
          mode: "kv",
          cacheHit: false,
          status: 200,
          durationMs: Date.now() - recoveryStartedAt,
          outcome: `recovered:${recovered}`,
        });
      } catch {
        writeUsageAnalytics({
          env,
          path: endpointPath,
          method: "SCHEDULED",
          rpcMethod: "aiBatchRecover",
          mode: "kv",
          cacheHit: false,
          status: 500,
          durationMs: Date.now() - recoveryStartedAt,
          outcome: "recover-failed",
        });
      }
    }

    const ingestStartedAt = Date.now();
    try {
      const ingest = await ingestNewsFromSourceCatalog(env);
      writeUsageAnalytics({
        env,
        path: endpointPath,
        method: "SCHEDULED",
        rpcMethod: "rssIngest",
        mode: "kv",
        cacheHit: false,
        status: 200,
        durationMs: Date.now() - ingestStartedAt,
        outcome: `sources:${ingest.selectedSources}|fetched:${ingest.fetchedItems}|published:${ingest.publishedItems}`,
        extraDoubles: [ingest.selectedSources, ingest.fetchedItems, ingest.publishedItems],
      });
    } catch {
      writeUsageAnalytics({
        env,
        path: endpointPath,
        method: "SCHEDULED",
        rpcMethod: "rssIngest",
        mode: "kv",
        cacheHit: false,
        status: 500,
        durationMs: Date.now() - ingestStartedAt,
        outcome: "rss-ingest-failed",
      });
    }

    if (isCrmStripeLiveEnabled(env) && trimString(env.STRIPE_SECRET_KEY)) {
      const crmStartedAt = Date.now();
      try {
        const stripeResult = await fetchStripeLiveCrmSummary(env);
        if (stripeResult.ok) {
          await saveCachedStripeCrmSummary(env, stripeResult.summary);
        }
        writeUsageAnalytics({
          env,
          path: endpointPath,
          method: "SCHEDULED",
          rpcMethod: "crmStripeWarm",
          mode: "kv",
          cacheHit: false,
          status: stripeResult.ok ? 200 : 502,
          durationMs: Date.now() - crmStartedAt,
          outcome: stripeResult.ok ? "crm-stripe-cached" : "crm-stripe-failed",
        });
      } catch {
        writeUsageAnalytics({
          env,
          path: endpointPath,
          method: "SCHEDULED",
          rpcMethod: "crmStripeWarm",
          mode: "kv",
          cacheHit: false,
          status: 500,
          durationMs: Date.now() - crmStartedAt,
          outcome: "crm-stripe-failed",
        });
      }
    }

    if (
      !normalizeBoolean(env.USAGE_CACHE_WARM_ENABLED, DEFAULT_CACHE_WARM_ENABLED) ||
      normalizeStorageMode(env.USAGE_STORAGE_MODE) !== "kv"
    ) {
      return;
    }

    const cacheTtlSeconds = normalizeCacheTtlSeconds(env.USAGE_CACHE_TTL_SECONDS);
    if (cacheTtlSeconds <= 0) {
      return;
    }

    const startedAt = Date.now();

    try {
      const warmed = await warmCacheFromKv({
        env,
        endpointPath,
        cacheNamespace,
        cacheTtlSeconds,
      });
      writeUsageAnalytics({
        env,
        path: endpointPath,
        method: "SCHEDULED",
        rpcMethod: "cacheWarm",
        mode: "kv",
        cacheHit: false,
        status: 200,
        durationMs: Date.now() - startedAt,
        outcome: `warmed:${warmed}`,
      });
    } catch {
      writeUsageAnalytics({
        env,
        path: endpointPath,
        method: "SCHEDULED",
        rpcMethod: "cacheWarm",
        mode: "kv",
        cacheHit: false,
        status: 500,
        durationMs: Date.now() - startedAt,
        outcome: "warm-failed",
      });
    }
  },

  async queue(batch: QueueBatchLike, env: WorkerEnv): Promise<void> {
    const kv = env.USAGE_KV;
    if (!kv || typeof kv.put !== "function" || typeof kv.get !== "function") {
      for (const message of batch.messages) {
        if (typeof message.retry === "function") {
          message.retry();
        }
      }
      return;
    }

    const keyPrefix = `${normalizeKvPrefix(env.USAGE_KV_PREFIX)}:`;
    const defaultTtlSeconds = normalizeTtlSeconds(env.USAGE_KV_SEED_TTL_SECONDS);

    for (const message of batch.messages) {
      const body = decodeQueueBody(message.body);

      if (isRecord(body) && trimString(body.kind) === "ai-batch-run") {
        const batchId = trimString(body.batchId);
        if (!batchId) {
          if (typeof message.ack === "function") {
            message.ack();
          }
          continue;
        }
        try {
          await processAiBatchRun({ env, batchId });
          if (typeof message.ack === "function") {
            message.ack();
          }
        } catch {
          if (typeof message.retry === "function") {
            message.retry();
          }
        }
        continue;
      }

      if (isRecord(body) && trimString(body.kind) === "ai-batch-poll") {
        const batchId = trimString(body.batchId);
        if (!batchId) {
          if (typeof message.ack === "function") {
            message.ack();
          }
          continue;
        }
        try {
          await processAiBatchPoll({ env, batchId });
          if (typeof message.ack === "function") {
            message.ack();
          }
        } catch {
          if (typeof message.retry === "function") {
            message.retry();
          }
        }
        continue;
      }

      if (!isRecord(body) || typeof body.key !== "string") {
        if (typeof message.ack === "function") {
          message.ack();
        }
        continue;
      }

      const ttlSeconds = normalizeTtlSeconds(body.ttlSeconds) ?? defaultTtlSeconds;
      const entry: SeedEntry = {
        key: body.key,
        value: body.value,
        ...(ttlSeconds === undefined ? {} : { ttlSeconds }),
      };
      const validation = validateSeedEntry({ keyPrefix, entry });
      if (!validation.ok) {
        if (typeof message.ack === "function") {
          message.ack();
        }
        continue;
      }

      try {
        if (validation.expirationTtl !== undefined) {
          await kv.put(entry.key, validation.encoded, { expirationTtl: validation.expirationTtl });
        } else {
          await kv.put(entry.key, validation.encoded);
        }
        if (typeof message.ack === "function") {
          message.ack();
        }
      } catch {
        if (typeof message.retry === "function") {
          message.retry();
        }
      }
    }
  },
};

export default worker;
