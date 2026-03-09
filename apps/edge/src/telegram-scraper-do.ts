// ============================================================================
// TelegramScraperDO — Durable Object that scrapes 250+ Telegram channels
// on an alarm schedule, translates via AI Gateway + Groq, uploads media to R2, and
// writes the assembled state JSON to DO storage + KV for the frontend to consume.
// ============================================================================

import { DurableObject } from "cloudflare:workers";
import { CHANNELS, CATEGORIES, type ChannelConfig } from "./channels";
import { parseChannelHtml, type ParsedMessage } from "./html-parser";
import {
  translateBatch,
  translateImageBatch,
  detectLanguage,
  needsTranslation,
  GROQ_MODEL,
  type TranslationJob,
  type ImageTranslationJob,
} from "./translator";
import { resolveAiGatewayToken } from "./gateway-token";
import { jsonResponse } from "./json-response";
import { debugRuntimeLog } from "./runtime-log";
import {
  isLeadTelegramSource,
  updateTelegramSourcePerformanceStats,
  type TelegramSourcePerformanceStats,
} from "./telegram-source-performance";
import {
  computeTelegramSignalGrade,
  createDefaultTelegramSignalProfile,
  isHighSignalTelegramScore,
  type TelegramSignalGrade,
  type TelegramSignalProfile,
} from "./telegram-signal-grade";
import { resolveTelegramScrapePlan } from "./telegram-scrape-plan";

// ============================================================================
// Types
// ============================================================================

interface Env extends Cloudflare.Env {
  GROQ_API_KEY: string;
  CF_API_TOKEN?: string;
  AI_GATEWAY_TOKEN?: string;
  ALLOW_CF_API_TOKEN_AS_AIG?: string;
  CF_ACCOUNT_ID?: string;
  AI_GATEWAY_NAME?: string;
  SCRAPE_INTERVAL_MS?: string;
  SCRAPE_ROTATION_WINDOW_SECONDS?: string;
  HOT_CHANNELS_PER_CYCLE?: string;
  SCRAPE_WORKER_CONCURRENCY?: string;
  CHANNEL_BUILD_CONCURRENCY?: string;
  MAX_MESSAGES_PER_CHANNEL?: string;
  DEBUG_RUNTIME_LOGS?: string;
}

interface StoredMessage {
  text_original: string;
  text_en: string;
  image_text_en?: string;
  stored_at?: string;
  datetime: string;
  link: string;
  views: string;
  media: Array<{ type: string; url: string; thumbnail?: string }>;
  has_video: boolean;
  has_photo: boolean;
  language: string;
}

interface ChannelState {
  username: string;
  label: string;
  category: string;
  language: string;
  trust_tier?: ChannelConfig["trustTier"];
  latency_tier?: ChannelConfig["latencyTier"];
  source_type?: ChannelConfig["sourceType"];
  acquisition_method?: ChannelConfig["acquisitionMethod"];
  domain_tags?: string[];
  subscriber_value_score?: number;
  message_count: number;
  messages: StoredMessage[];
}

interface TelegramState {
  timestamp: string;
  source: string;
  total_channels: number;
  channels_fetched: number;
  cycle_channels: number;
  rotation_slot: number;
  rotation_slots: number;
  total_messages: number;
  translated_messages: number;
  failed_translations: number;
  blocked_untranslated_messages: number;
  translation_engine: string;
  categories: Record<string, string>;
  channels: ChannelState[];
  canonical_total_messages?: number;
  canonical_events?: TelegramCanonicalEvent[];
  dedupe_stats?: {
    raw_messages: number;
    canonical_messages: number;
    duplicates_collapsed: number;
    feedback_overrides: number;
  };
}

interface TelegramCanonicalEventSource {
  signature: string;
  channel: string;
  label: string;
  category: string;
  trust_tier?: ChannelConfig["trustTier"];
  latency_tier?: ChannelConfig["latencyTier"];
  source_type?: ChannelConfig["sourceType"];
  acquisition_method?: ChannelConfig["acquisitionMethod"];
  domain_tags?: string[];
  subscriber_value_score?: number;
  message_id: string;
  link: string;
  datetime: string;
  views: string;
}

interface TelegramCanonicalEvent {
  event_id: string;
  event_key: string;
  datetime: string;
  category: string;
  categories: string[];
  domain_tags?: string[];
  trust_tier?: ChannelConfig["trustTier"];
  latency_tier?: ChannelConfig["latencyTier"];
  source_type?: ChannelConfig["sourceType"];
  acquisition_method?: ChannelConfig["acquisitionMethod"];
  subscriber_value_score?: number;
  signal_profile_id?: string;
  signal_score?: number;
  signal_grade?: TelegramSignalGrade;
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
  media: Array<{ type: string; url: string; thumbnail?: string }>;
  has_video: boolean;
  has_photo: boolean;
  sources: TelegramCanonicalEventSource[];
}

interface DedupeFeedbackRule {
  signature: string;
  forcedCluster: string | null;
  split: boolean;
  updatedAt: number;
}

interface CanonicalSourceRecord {
  signature: string;
  channel: string;
  label: string;
  category: string;
  trustTier: ChannelConfig["trustTier"];
  latencyTier: ChannelConfig["latencyTier"];
  sourceType: ChannelConfig["sourceType"];
  acquisitionMethod: ChannelConfig["acquisitionMethod"];
  domainTags: string[];
  subscriberValueScore: number;
  messageId: string;
  link: string;
  datetime: string;
  datetimeMs: number;
  views: string;
  textOriginal: string;
  textEn: string;
  imageTextEn?: string;
  language: string;
  media: Array<{ type: string; url: string; thumbnail?: string }>;
  hasVideo: boolean;
  hasPhoto: boolean;
  canonicalText: string;
  sourceAnchor: string;
  tokenSet: Set<string>;
  simhash: bigint;
  mediaSignature: string;
}

interface TelegramSourcePerformanceRow {
  channel: string;
  total_events: number;
  lead_reports: number;
  follow_on_reports: number;
  corroborated_reports: number;
  single_source_reports: number;
  score: number;
  last_lead_at: number | null;
  last_seen_at: number | null;
  updated_at: number | null;
}

interface TelegramSignalProfileRow {
  profile_id: string;
  category: string;
  active: number;
  weights_json: string;
  thresholds_json: string;
  updated_at: string;
}

function isFiniteRecordNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

type PersistMessageSource = "new" | "backfill" | "media_backfill";

interface PersistMessageRecord {
  source: PersistMessageSource;
  channel: string;
  label: string;
  category: string;
  messageId: string;
  link: string;
  datetime: string;
  views: string;
  textOriginal: string;
  textEn: string;
  imageTextEn?: string;
  language: string;
  hasVideo: boolean;
  hasPhoto: boolean;
  media: Array<{ type: string; url: string; thumbnail?: string }>;
}

type AnyMediaItem = { type: string; url: string; thumbnail?: string };

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SCRAPE_INTERVAL_MS = 10_000;
const MIN_SCRAPE_INTERVAL_MS = 5_000;
const MAX_SCRAPE_INTERVAL_MS = 120_000;
const DEFAULT_ROTATION_WINDOW_SECONDS = 60;
const MIN_ROTATION_WINDOW_SECONDS = 10;
const MAX_ROTATION_WINDOW_SECONDS = 3600;
const DEFAULT_SCRAPE_WORKER_CONCURRENCY = 20;
const DEFAULT_CHANNEL_BUILD_CONCURRENCY = 20;
const MAX_CONCURRENCY = 50;
const DEFAULT_HOT_CHANNELS_PER_CYCLE = 64;
const MIN_HOT_CHANNELS_PER_CYCLE = 8;
const MAX_HOT_CHANNELS_PER_CYCLE = 128;
const MEDIA_BATCH_SIZE = 10;
const MEDIA_CONCURRENCY = 10;
const DEFAULT_MAX_MESSAGES_PER_CHANNEL = 30;
const MAX_MESSAGES_PER_CHANNEL_LIMIT = 100;
const DEDUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BACKFILL_BASE_RETRY_MS = 5 * 60 * 1000;
const BACKFILL_MAX_RETRY_MS = 6 * 60 * 60 * 1000;
const MAX_BACKFILL_JOBS_PER_CYCLE = 120;
const MAX_IMAGE_TRANSLATION_JOBS_PER_CYCLE = 160;
const MEDIA_BACKFILL_BASE_RETRY_MS = 2 * 60 * 1000;
const MEDIA_BACKFILL_MAX_RETRY_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIA_BACKFILL_JOBS_PER_CYCLE = 80;
const MAX_CANONICAL_EVENTS = 2500;
const DEDUPE_TIME_WINDOW_MS = 2 * 60 * 60 * 1000;
const DEDUPE_MEDIA_WINDOW_MS = 6 * 60 * 60 * 1000;
const TEXT_TRANSLATION_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const IMAGE_TRANSLATION_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CANONICAL_HISTORY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SIGNAL_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const IMAGE_TRANSLATION_CACHE_EMPTY_SENTINEL = "__NO_TEXT__";
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const R2_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const R2_MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;
const LATEST_TELEGRAM_STATE_KV_KEY = "latest-telegram-intel";
const LATEST_TELEGRAM_STATE_DO_KEY = "latest_state_json";
const TELEGRAM_STREAM_WS_TAG = "telegram-stream";

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length || 1));
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runOne(): Promise<void> {
    while (true) {
      const current = cursor;
      cursor++;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runOne()));
  return results;
}

function normalizeBoundedInt(
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function resolveContentTypeAndExt(params: {
  sourceUrl: string;
  responseContentType: string | null;
  isVideo: boolean;
}): { contentType: string; ext: string } {
  const fallbackType = params.isVideo ? "video/mp4" : "image/jpeg";
  const fallbackExt = params.isVideo ? "mp4" : "jpg";
  const cleanType = (params.responseContentType || "").split(";")[0].trim().toLowerCase();
  const typeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
  };

  let ext = typeToExt[cleanType] || "";
  let contentType = cleanType || fallbackType;
  if (!ext) {
    let path = params.sourceUrl;
    try {
      path = new URL(params.sourceUrl).pathname;
    } catch {
      // Keep raw URL fallback
    }
    const extMatch = path.match(/\.([a-zA-Z0-9]{2,6})$/);
    const parsedExt = extMatch?.[1]?.toLowerCase() || "";
    const allowedExts = params.isVideo
      ? new Set(["mp4", "webm", "mov", "m4v"])
      : new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
    if (parsedExt && allowedExts.has(parsedExt)) {
      ext = parsedExt === "jpeg" ? "jpg" : parsedExt;
      if (!cleanType) {
        contentType = params.isVideo ? `video/${ext === "mov" ? "quicktime" : ext}` : `image/${ext}`;
      }
    }
  }

  if (!ext) {
    return { contentType: fallbackType, ext: fallbackExt };
  }
  return { contentType, ext };
}

// ============================================================================
// Durable Object
// ============================================================================

export class TelegramScraperDO extends DurableObject<Env> {
  private readonly runtimeEnv: Env;
  private isRunning = false;
  private lastRunMs = 0;
  private lastCycleStats = "";
  private lastRotationSlot = 0;
  private lastRotationSlots = 1;
  private lastCycleTargetChannels = CHANNELS.length;
  private lastCycleFetchedChannels = 0;
  private d1SchemaReady = false;
  private signalProfileCacheLoadedAtMs = 0;
  private signalProfilesByCategory = new Map<string, TelegramSignalProfile>();

  private broadcastStateInvalidation(payload: Record<string, unknown>): void {
    const message = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets(TELEGRAM_STREAM_WS_TAG)) {
      try {
        socket.send(message);
      } catch {
        try {
          socket.close(1011, "broadcast_failed");
        } catch {
          // ignore secondary close failures
        }
      }
    }
  }

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.runtimeEnv = env;

    this.ctx.blockConcurrencyWhile(async () => {
      // Create dedup table on first instantiation
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS seen_messages (
          channel TEXT NOT NULL,
          message_id TEXT NOT NULL,
          text_hash TEXT,
          first_seen INTEGER NOT NULL,
          PRIMARY KEY (channel, message_id)
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_seen_text_hash ON seen_messages(text_hash)`,
      );
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_seen_first_seen ON seen_messages(first_seen)`,
      );
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS translation_backoff (
          channel TEXT NOT NULL,
          message_id TEXT NOT NULL,
          fail_count INTEGER NOT NULL,
          next_retry INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (channel, message_id)
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_translation_backoff_next_retry ON translation_backoff(next_retry)`,
      );
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS media_backoff (
          channel TEXT NOT NULL,
          message_id TEXT NOT NULL,
          media_key TEXT NOT NULL,
          fail_count INTEGER NOT NULL,
          next_retry INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (channel, message_id, media_key)
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_media_backoff_next_retry ON media_backoff(next_retry)`,
      );
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS translation_cache (
          cache_key TEXT NOT NULL,
          kind TEXT NOT NULL,
          value TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (cache_key, kind)
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_translation_cache_updated_at ON translation_cache(updated_at)`,
      );
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS dedupe_feedback (
          signature TEXT PRIMARY KEY,
          forced_cluster TEXT,
          split INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_dedupe_feedback_updated_at ON dedupe_feedback(updated_at)`,
      );
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS telegram_source_performance (
          channel TEXT PRIMARY KEY,
          total_events REAL NOT NULL DEFAULT 0,
          lead_reports REAL NOT NULL,
          follow_on_reports REAL NOT NULL,
          corroborated_reports REAL NOT NULL,
          single_source_reports REAL NOT NULL,
          score REAL NOT NULL,
          last_lead_at INTEGER,
          last_seen_at INTEGER,
          updated_at INTEGER
        )
      `);
      this.ctx.storage.sql.exec(
        `CREATE INDEX IF NOT EXISTS idx_telegram_source_performance_score ON telegram_source_performance(score DESC)`,
      );
      const sourcePerformanceInfo = this.ctx.storage.sql
        .exec("PRAGMA table_info(telegram_source_performance)")
        .toArray() as Array<{ name: string }>;
      if (!sourcePerformanceInfo.some((column) => column.name === "total_events")) {
        this.ctx.storage.sql.exec(
          "ALTER TABLE telegram_source_performance ADD COLUMN total_events REAL NOT NULL DEFAULT 0",
        );
      }

      await this.ensureD1Schema();

      // Ensure alarm is set
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm) {
        await this.ctx.storage.setAlarm(Date.now() + 5_000);
      }
    });
  }

  private getScrapeIntervalMs(): number {
    return normalizeBoundedInt(
      this.env.SCRAPE_INTERVAL_MS,
      DEFAULT_SCRAPE_INTERVAL_MS,
      MIN_SCRAPE_INTERVAL_MS,
      MAX_SCRAPE_INTERVAL_MS,
    );
  }

  private getRotationWindowSeconds(): number {
    return normalizeBoundedInt(
      this.env.SCRAPE_ROTATION_WINDOW_SECONDS,
      DEFAULT_ROTATION_WINDOW_SECONDS,
      MIN_ROTATION_WINDOW_SECONDS,
      MAX_ROTATION_WINDOW_SECONDS,
    );
  }

  private getScrapeWorkerConcurrency(): number {
    return normalizeBoundedInt(
      this.env.SCRAPE_WORKER_CONCURRENCY,
      DEFAULT_SCRAPE_WORKER_CONCURRENCY,
      1,
      MAX_CONCURRENCY,
    );
  }

  private getChannelBuildConcurrency(): number {
    return normalizeBoundedInt(
      this.env.CHANNEL_BUILD_CONCURRENCY,
      DEFAULT_CHANNEL_BUILD_CONCURRENCY,
      1,
      MAX_CONCURRENCY,
    );
  }

  private getMaxMessagesPerChannel(): number {
    return normalizeBoundedInt(
      this.env.MAX_MESSAGES_PER_CHANNEL,
      DEFAULT_MAX_MESSAGES_PER_CHANNEL,
      5,
      MAX_MESSAGES_PER_CHANNEL_LIMIT,
    );
  }

  private getHotChannelsPerCycle(): number {
    return normalizeBoundedInt(
      this.env.HOT_CHANNELS_PER_CYCLE,
      DEFAULT_HOT_CHANNELS_PER_CYCLE,
      MIN_HOT_CHANNELS_PER_CYCLE,
      MAX_HOT_CHANNELS_PER_CYCLE,
    );
  }

  private async ensureD1Schema(): Promise<void> {
    if (this.d1SchemaReady || !this.env.INTEL_DB) {
      return;
    }
    try {
      const schemaStatements = [
        "CREATE TABLE IF NOT EXISTS telegram_cycles (cycle_id TEXT PRIMARY KEY, timestamp TEXT NOT NULL, rotation_slot INTEGER NOT NULL, rotation_slots INTEGER NOT NULL, cycle_channels INTEGER NOT NULL, channels_fetched INTEGER NOT NULL, total_channels INTEGER NOT NULL, total_messages INTEGER NOT NULL, new_messages INTEGER NOT NULL, backfilled_messages INTEGER NOT NULL, translated_messages INTEGER NOT NULL, failed_translations INTEGER NOT NULL, translation_engine TEXT NOT NULL, state_r2_key TEXT, delta_r2_key TEXT, scrape_elapsed_ms INTEGER NOT NULL, created_at TEXT NOT NULL);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_cycles_timestamp ON telegram_cycles(timestamp DESC);",
        "CREATE TABLE IF NOT EXISTS telegram_cycle_messages (channel_username TEXT NOT NULL, message_id TEXT NOT NULL, source TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL, message_link TEXT NOT NULL, datetime TEXT, text_original TEXT NOT NULL, text_en TEXT NOT NULL, image_text_en TEXT, views TEXT, language TEXT, has_video INTEGER NOT NULL, has_photo INTEGER NOT NULL, media_json TEXT, first_seen_cycle_id TEXT NOT NULL, updated_cycle_id TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (channel_username, message_id));",
        "CREATE INDEX IF NOT EXISTS idx_telegram_cycle_messages_datetime ON telegram_cycle_messages(datetime DESC);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_cycle_messages_updated_cycle ON telegram_cycle_messages(updated_cycle_id);",
        "CREATE TABLE IF NOT EXISTS telegram_canonical_events (event_id TEXT PRIMARY KEY, event_key TEXT NOT NULL, datetime TEXT NOT NULL, category TEXT NOT NULL, categories_json TEXT NOT NULL, source_count INTEGER NOT NULL, duplicate_count INTEGER NOT NULL, source_labels_json TEXT NOT NULL, source_channels_json TEXT NOT NULL, text_original TEXT NOT NULL, text_en TEXT NOT NULL, image_text_en TEXT, language TEXT, media_json TEXT NOT NULL, has_video INTEGER NOT NULL, has_photo INTEGER NOT NULL, signal_profile_id TEXT, signal_score REAL, signal_grade TEXT, signal_reasons_json TEXT, cycle_id TEXT NOT NULL, updated_at TEXT NOT NULL);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_canonical_events_datetime ON telegram_canonical_events(datetime DESC);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_canonical_events_cycle_id ON telegram_canonical_events(cycle_id);",
        "CREATE TABLE IF NOT EXISTS telegram_canonical_event_sources (event_id TEXT NOT NULL, signature TEXT NOT NULL, channel TEXT NOT NULL, label TEXT NOT NULL, category TEXT NOT NULL, message_id TEXT NOT NULL, message_link TEXT NOT NULL, datetime TEXT, views TEXT, cycle_id TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (event_id, signature));",
        "CREATE INDEX IF NOT EXISTS idx_telegram_canonical_event_sources_event_id ON telegram_canonical_event_sources(event_id);",
        "CREATE TABLE IF NOT EXISTS telegram_signal_profiles (profile_id TEXT PRIMARY KEY, category TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, weights_json TEXT NOT NULL, thresholds_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_signal_profiles_active ON telegram_signal_profiles(active, category);",
        "CREATE TABLE IF NOT EXISTS telegram_source_history (channel TEXT PRIMARY KEY, score REAL NOT NULL, total_events REAL NOT NULL, lead_reports REAL NOT NULL, follow_on_reports REAL NOT NULL, corroborated_reports REAL NOT NULL, single_source_reports REAL NOT NULL, trust_tier TEXT NOT NULL, latency_tier TEXT NOT NULL, updated_at TEXT NOT NULL);",
        "CREATE INDEX IF NOT EXISTS idx_telegram_source_history_score ON telegram_source_history(score DESC);",
      ];
      for (const statement of schemaStatements) {
        await this.env.INTEL_DB.prepare(statement).run();
      }
      const tableInfoRaw = await this.env.INTEL_DB.prepare(
        "PRAGMA table_info(telegram_cycle_messages);",
      ).all<{ name: string }>();
      const tableInfo = Array.isArray(tableInfoRaw.results)
        ? tableInfoRaw.results
        : [];
      const hasImageTextColumn = tableInfo.some((col) => col.name === "image_text_en");
      if (!hasImageTextColumn) {
        await this.env.INTEL_DB.prepare(
          "ALTER TABLE telegram_cycle_messages ADD COLUMN image_text_en TEXT;",
        ).run();
      }
      const canonicalInfoRaw = await this.env.INTEL_DB.prepare(
        "PRAGMA table_info(telegram_canonical_events);",
      ).all<{ name: string }>();
      const canonicalInfo = Array.isArray(canonicalInfoRaw.results) ? canonicalInfoRaw.results : [];
      if (!canonicalInfo.some((col) => col.name === "signal_profile_id")) {
        await this.env.INTEL_DB.prepare(
          "ALTER TABLE telegram_canonical_events ADD COLUMN signal_profile_id TEXT;",
        ).run();
      }
      if (!canonicalInfo.some((col) => col.name === "signal_score")) {
        await this.env.INTEL_DB.prepare(
          "ALTER TABLE telegram_canonical_events ADD COLUMN signal_score REAL;",
        ).run();
      }
      if (!canonicalInfo.some((col) => col.name === "signal_grade")) {
        await this.env.INTEL_DB.prepare(
          "ALTER TABLE telegram_canonical_events ADD COLUMN signal_grade TEXT;",
        ).run();
      }
      if (!canonicalInfo.some((col) => col.name === "signal_reasons_json")) {
        await this.env.INTEL_DB.prepare(
          "ALTER TABLE telegram_canonical_events ADD COLUMN signal_reasons_json TEXT;",
        ).run();
      }
      const defaultProfile = createDefaultTelegramSignalProfile();
      await this.env.INTEL_DB.prepare(
        `INSERT OR IGNORE INTO telegram_signal_profiles (profile_id, category, active, weights_json, thresholds_json, updated_at)
         VALUES (?, ?, 1, ?, ?, ?)`,
      )
        .bind(
          defaultProfile.profileId,
          "default",
          JSON.stringify(defaultProfile.weights),
          JSON.stringify(defaultProfile.thresholds),
          new Date().toISOString(),
        )
        .run();
      this.d1SchemaReady = true;
    } catch (err) {
      console.error(
        "[TelegramScraper] D1 schema init failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  private selectChannelsForCycle(nowMs: number): {
    channels: ChannelConfig[];
    slot: number;
    slots: number;
  } {
    return resolveTelegramScrapePlan({
      channels: CHANNELS,
      nowMs,
      intervalMs: this.getScrapeIntervalMs(),
      rotationWindowSeconds: this.getRotationWindowSeconds(),
      hotChannelsPerCycle: this.getHotChannelsPerCycle(),
    });
  }

  private makeEmptyChannelState(config: ChannelConfig): ChannelState {
    return {
      username: config.username,
      label: config.label,
      category: config.category,
      language: config.language,
      trust_tier: config.trustTier,
      latency_tier: config.latencyTier,
      source_type: config.sourceType,
      acquisition_method: config.acquisitionMethod,
      domain_tags: config.domainTags,
      subscriber_value_score: config.subscriberValueScore,
      message_count: 0,
      messages: [],
    };
  }

  private pickImageSourceForOcr(message: ParsedMessage): string | null {
    const photo = message.media.find(
      (item) => item.type === "photo" && item.url.startsWith("http"),
    );
    if (photo) return photo.url;
    const thumb = message.media.find(
      (item) => typeof item.thumbnail === "string" && item.thumbnail.startsWith("http"),
    )?.thumbnail;
    return thumb ?? null;
  }

  private isAcceptedEnglishTranslation(text: string): boolean {
    const candidate = (text || "").trim();
    if (candidate.length < 3) return false;
    const detected = detectLanguage(candidate);
    if (detected === "en") return true;
    const foreignChars = (
      candidate.match(/[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u4E00-\u9FFF]/g) ||
      []
    ).length;
    return foreignChars / candidate.length <= 0.08;
  }

  private normalizeDedupeText(value: string): string {
    return (value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[@#][a-z0-9_]+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\b(?:follow|subscribe|join|source|via|breaking|update|reportedly)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
  }

  private tokenizeDedupeText(value: string): string[] {
    if (!value) return [];
    const stopwords = new Set([
      "the", "and", "for", "that", "with", "this", "from", "have", "has", "are", "was", "were", "will",
      "about", "after", "into", "over", "under", "their", "there", "they", "them", "said", "says", "more",
      "intel", "news", "update", "breaking", "report", "reports",
    ]);
    const tokens = value
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopwords.has(token));
    return Array.from(new Set(tokens)).slice(0, 128);
  }

  private tokenHash64(token: string): bigint {
    let hash = 0xcbf29ce484222325n;
    const prime = 0x100000001b3n;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= BigInt(token.charCodeAt(i));
      hash = (hash * prime) & 0xffffffffffffffffn;
    }
    return hash;
  }

  private buildSimhash(tokens: Iterable<string>): bigint {
    const weights = new Array<number>(64).fill(0);
    for (const token of tokens) {
      const hash = this.tokenHash64(token);
      for (let bit = 0; bit < 64; bit += 1) {
        const mask = 1n << BigInt(bit);
        weights[bit] += (hash & mask) !== 0n ? 1 : -1;
      }
    }
    let out = 0n;
    for (let bit = 0; bit < 64; bit += 1) {
      if (weights[bit] > 0) {
        out |= 1n << BigInt(bit);
      }
    }
    return out;
  }

  private hammingDistance64(left: bigint, right: bigint): number {
    let x = (left ^ right) & 0xffffffffffffffffn;
    let count = 0;
    while (x !== 0n) {
      x &= x - 1n;
      count += 1;
    }
    return count;
  }

  private jaccardSimilarity(left: Set<string>, right: Set<string>): number {
    if (left.size === 0 || right.size === 0) return 0;
    let intersection = 0;
    for (const token of left) {
      if (right.has(token)) intersection += 1;
    }
    const union = left.size + right.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private normalizeLinkForSignature(link: string): string {
    const raw = (link || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      parsed.hash = "";
      parsed.search = "";
      return parsed.toString().replace(/\/+$/, "");
    } catch {
      return raw.split("?")[0]?.split("#")[0]?.replace(/\/+$/, "") ?? raw;
    }
  }

  private extractSourceAnchor(text: string): string {
    if (!text) return "";
    const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
    for (const raw of matches) {
      const normalized = this.normalizeLinkForSignature(raw);
      if (!normalized) continue;
      try {
        const host = new URL(normalized).hostname.toLowerCase();
        if (host === "t.me" || host.endsWith(".t.me") || host === "telegram.me") {
          continue;
        }
      } catch {
        // Keep normalized candidate if URL parsing fails after normalization.
      }
      return normalized;
    }
    return "";
  }

  private buildMediaSignature(media: Array<{ type: string; url: string; thumbnail?: string }>): string {
    if (!Array.isArray(media) || media.length === 0) return "";
    const keys = media
      .map((item) => {
        const raw = (item.url || "").trim();
        const parts = raw.split("/").filter(Boolean);
        return parts.at(-1) ?? raw;
      })
      .filter((value) => value.length > 0)
      .sort();
    return keys.join("|").slice(0, 260);
  }

  private buildRecordSignature(args: {
    channel: string;
    messageId: string;
    link: string;
    canonicalText: string;
    sourceAnchor: string;
    datetimeMs: number;
    mediaSignature: string;
  }): string {
    if (args.sourceAnchor) {
      return `src:${this.hashText(args.sourceAnchor)}`;
    }
    const normalizedLink = this.normalizeLinkForSignature(args.link);
    if (normalizedLink) {
      return `lnk:${this.hashText(normalizedLink)}`;
    }
    const timeBucket = Math.floor((args.datetimeMs || Date.now()) / (30 * 60 * 1000));
    const payload = `${args.channel}|${args.messageId}|${timeBucket}|${args.mediaSignature}|${args.canonicalText.slice(0, 320)}`;
    return `txt:${this.hashText(payload)}`;
  }

  private async loadDedupeFeedbackRules(): Promise<Map<string, DedupeFeedbackRule>> {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT signature, forced_cluster, split, updated_at FROM dedupe_feedback",
      )
      .toArray() as Array<{ signature: string; forced_cluster: string | null; split: number; updated_at: number }>;
    const map = new Map<string, DedupeFeedbackRule>();
    for (const row of rows) {
      const signature = (row.signature || "").trim();
      if (!signature) continue;
      map.set(signature, {
        signature,
        forcedCluster: typeof row.forced_cluster === "string" && row.forced_cluster.trim().length > 0
          ? row.forced_cluster.trim()
          : null,
        split: Number(row.split) === 1,
        updatedAt: Number(row.updated_at) || Date.now(),
      });
    }
    return map;
  }

  private loadSourcePerformanceStats(): Map<string, TelegramSourcePerformanceStats> {
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT channel, total_events, lead_reports, follow_on_reports, corroborated_reports,
          single_source_reports, score, last_lead_at, last_seen_at, updated_at
         FROM telegram_source_performance`,
      )
      .toArray() as unknown as TelegramSourcePerformanceRow[];
    const map = new Map<string, TelegramSourcePerformanceStats>();
    for (const row of rows) {
      const channel = (row.channel || "").trim();
      if (!channel) continue;
      map.set(channel, {
        totalEvents: Number.isFinite(row.total_events) ? row.total_events : 0,
        leadReports: Number.isFinite(row.lead_reports) ? row.lead_reports : 0,
        followOnReports: Number.isFinite(row.follow_on_reports) ? row.follow_on_reports : 0,
        corroboratedReports: Number.isFinite(row.corroborated_reports) ? row.corroborated_reports : 0,
        singleSourceReports: Number.isFinite(row.single_source_reports) ? row.single_source_reports : 0,
        score: Number.isFinite(row.score) ? Math.round(row.score) : 0,
        lastLeadAtMs: Number.isFinite(row.last_lead_at) ? row.last_lead_at : null,
        lastSeenAtMs: Number.isFinite(row.last_seen_at) ? row.last_seen_at : null,
        updatedAtMs: Number.isFinite(row.updated_at) ? row.updated_at : null,
      });
    }
    return map;
  }

  private async loadSignalProfiles(): Promise<Map<string, TelegramSignalProfile>> {
    const nowMs = Date.now();
    if (
      this.signalProfilesByCategory.size > 0 &&
      nowMs - this.signalProfileCacheLoadedAtMs <= SIGNAL_PROFILE_CACHE_TTL_MS
    ) {
      return this.signalProfilesByCategory;
    }

    const profiles = new Map<string, TelegramSignalProfile>();
    profiles.set("default", createDefaultTelegramSignalProfile());

    if (!this.env.INTEL_DB) {
      this.signalProfilesByCategory = profiles;
      this.signalProfileCacheLoadedAtMs = nowMs;
      return profiles;
    }

    await this.ensureD1Schema();
    try {
      const result = await this.env.INTEL_DB.prepare(
        `SELECT profile_id, category, active, weights_json, thresholds_json, updated_at
         FROM telegram_signal_profiles
         WHERE active = 1`,
      ).all<TelegramSignalProfileRow>();
      const rows = Array.isArray(result.results) ? result.results : [];
      for (const row of rows) {
        const category = (row.category || "").trim().toLowerCase() || "default";
        try {
          const parsedWeights = JSON.parse(row.weights_json) as Partial<TelegramSignalProfile["weights"]> | null;
          const parsedThresholds = JSON.parse(row.thresholds_json) as Partial<TelegramSignalProfile["thresholds"]> | null;
          if (
            !parsedWeights ||
            !parsedThresholds ||
            !isFiniteRecordNumber(parsedWeights.sourceQuality) ||
            !isFiniteRecordNumber(parsedWeights.lead) ||
            !isFiniteRecordNumber(parsedWeights.corroboration) ||
            !isFiniteRecordNumber(parsedWeights.evidence) ||
            !isFiniteRecordNumber(parsedWeights.freshness) ||
            !isFiniteRecordNumber(parsedWeights.penalty) ||
            !isFiniteRecordNumber(parsedThresholds.a) ||
            !isFiniteRecordNumber(parsedThresholds.b) ||
            !isFiniteRecordNumber(parsedThresholds.c)
          ) {
            throw new Error("invalid_signal_profile_shape");
          }
          const weights: TelegramSignalProfile["weights"] = {
            sourceQuality: parsedWeights.sourceQuality,
            lead: parsedWeights.lead,
            corroboration: parsedWeights.corroboration,
            evidence: parsedWeights.evidence,
            freshness: parsedWeights.freshness,
            penalty: parsedWeights.penalty,
          };
          const thresholds: TelegramSignalProfile["thresholds"] = {
            a: parsedThresholds.a,
            b: parsedThresholds.b,
            c: parsedThresholds.c,
          };
          profiles.set(category, {
            profileId: row.profile_id,
            category: category === "default" ? null : category,
            weights,
            thresholds,
          });
        } catch (error) {
          console.warn("[TelegramScraper] Failed to parse signal profile row", {
            profileId: row.profile_id,
            category,
            error: error instanceof Error ? error.message : "invalid_signal_profile_json",
          });
          continue;
        }
      }
    } catch (error) {
      console.error(
        "[TelegramScraper] Failed to load signal profiles:",
        error instanceof Error ? error.message : error,
      );
    }

    this.signalProfilesByCategory = profiles;
    this.signalProfileCacheLoadedAtMs = nowMs;
    return profiles;
  }

  private resolveSignalProfile(profiles: Map<string, TelegramSignalProfile>, category: string): TelegramSignalProfile {
    return profiles.get((category || "").trim().toLowerCase()) ?? profiles.get("default") ?? createDefaultTelegramSignalProfile();
  }

  private async persistSourcePerformanceStats(statsByChannel: Map<string, TelegramSourcePerformanceStats>, channelsByName: Map<string, ChannelConfig>): Promise<void> {
    for (const [channel, stats] of statsByChannel.entries()) {
      const normalizedChannel = channel.trim();
      if (!normalizedChannel) continue;
      this.ctx.storage.sql.exec(
        `INSERT OR REPLACE INTO telegram_source_performance (
          channel, total_events, lead_reports, follow_on_reports, corroborated_reports,
          single_source_reports, score, last_lead_at, last_seen_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        normalizedChannel,
        stats.totalEvents,
        stats.leadReports,
        stats.followOnReports,
        stats.corroboratedReports,
        stats.singleSourceReports,
        stats.score,
        stats.lastLeadAtMs,
        stats.lastSeenAtMs,
        stats.updatedAtMs,
      );
    }

    if (!this.env.INTEL_DB) {
      return;
    }

    await this.ensureD1Schema();
    const statements = Array.from(statsByChannel.entries()).map(([channel, stats]) => {
      const config = channelsByName.get(channel);
      return this.env.INTEL_DB!
        .prepare(
          `INSERT OR REPLACE INTO telegram_source_history (
            channel, score, total_events, lead_reports, follow_on_reports, corroborated_reports,
            single_source_reports, trust_tier, latency_tier, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          channel,
          stats.score,
          stats.totalEvents,
          stats.leadReports,
          stats.followOnReports,
          stats.corroboratedReports,
          stats.singleSourceReports,
          config?.trustTier ?? "watch",
          config?.latencyTier ?? "monitor",
          new Date(stats.updatedAtMs ?? Date.now()).toISOString(),
        );
    });
    for (let i = 0; i < statements.length; i += 100) {
      const chunk = statements.slice(i, i + 100);
      await this.env.INTEL_DB.batch(chunk);
    }
  }

  private buildCanonicalSourceRecords(channels: ChannelState[]): CanonicalSourceRecord[] {
    const out: CanonicalSourceRecord[] = [];
    for (const channel of channels) {
      for (const message of channel.messages) {
        const textPrimary = (message.text_en || message.text_original || "").trim();
        const imageText = (message.image_text_en || "").trim();
        const canonicalText = this.normalizeDedupeText(
          imageText ? `${textPrimary}\n${imageText}` : textPrimary,
        );
        const tokens = this.tokenizeDedupeText(canonicalText);
        const tokenSet = new Set(tokens);
        const datetimeMs = Date.parse(message.datetime || "");
        const mediaSignature = this.buildMediaSignature(message.media);
        const messageId = this.extractMessageIdFromLink(message.link);
        const sourceAnchor = this.extractSourceAnchor(`${message.text_original || ""}\n${message.text_en || ""}`);
        const signature = this.buildRecordSignature({
          channel: channel.username,
          messageId,
          link: message.link,
          canonicalText,
          sourceAnchor,
          datetimeMs: Number.isFinite(datetimeMs) ? datetimeMs : Date.now(),
          mediaSignature,
        });
        out.push({
          signature,
          channel: channel.username,
          label: channel.label,
          category: channel.category,
          trustTier: channel.trust_tier ?? "watch",
          latencyTier: channel.latency_tier ?? "monitor",
          sourceType: channel.source_type ?? "osint",
          acquisitionMethod: channel.acquisition_method ?? "telegram_public",
          domainTags: Array.isArray(channel.domain_tags) ? channel.domain_tags : [],
          subscriberValueScore:
            typeof channel.subscriber_value_score === "number" && Number.isFinite(channel.subscriber_value_score)
              ? channel.subscriber_value_score
              : 72,
          messageId,
          link: message.link,
          datetime: message.datetime,
          datetimeMs: Number.isFinite(datetimeMs) ? datetimeMs : 0,
          views: message.views,
          textOriginal: message.text_original,
          textEn: message.text_en,
          imageTextEn: message.image_text_en,
          language: message.language,
          media: message.media,
          hasVideo: message.has_video,
          hasPhoto: message.has_photo,
          canonicalText,
          sourceAnchor,
          tokenSet,
          simhash: this.buildSimhash(tokenSet),
          mediaSignature,
        });
      }
    }
    out.sort((left, right) => right.datetimeMs - left.datetimeMs);
    return out;
  }

  private dedupeClusterScore(args: {
    source: CanonicalSourceRecord;
    cluster: {
      latestMs: number;
      canonicalText: string;
      tokenSet: Set<string>;
      simhash: bigint;
      mediaSignature: string;
      sourceAnchors: Set<string>;
    };
  }): number {
    const sourceTs = args.source.datetimeMs;
    const delta = Math.abs(sourceTs - args.cluster.latestMs);
    if (
      args.source.sourceAnchor &&
      args.cluster.sourceAnchors.has(args.source.sourceAnchor) &&
      delta <= DEDUPE_TIME_WINDOW_MS
    ) {
      return 0.98;
    }
    if (
      args.source.mediaSignature &&
      args.cluster.mediaSignature &&
      args.source.mediaSignature === args.cluster.mediaSignature &&
      delta <= DEDUPE_MEDIA_WINDOW_MS
    ) {
      return 1;
    }
    if (!args.source.canonicalText || !args.cluster.canonicalText || delta > DEDUPE_TIME_WINDOW_MS) {
      return 0;
    }
    if (args.source.canonicalText === args.cluster.canonicalText) {
      return 0.99;
    }
    const contains =
      args.source.canonicalText.includes(args.cluster.canonicalText) ||
      args.cluster.canonicalText.includes(args.source.canonicalText);
    const sourceLen = args.source.canonicalText.length;
    const clusterLen = args.cluster.canonicalText.length;
    const shorter = Math.min(sourceLen, clusterLen);
    const longer = Math.max(sourceLen, clusterLen);
    const ratio = longer > 0 ? shorter / longer : 0;
    if (shorter >= 100 && ratio >= 0.72 && contains) {
      return 0.94;
    }
    const jac = this.jaccardSimilarity(args.source.tokenSet, args.cluster.tokenSet);
    const ham = this.hammingDistance64(args.source.simhash, args.cluster.simhash);
    if (jac >= 0.86) return jac;
    if (jac >= 0.74 && ham <= 8) return 0.83 + (jac - 0.74);
    if (jac >= 0.68 && ham <= 6 && shorter >= 180) return 0.82;
    return 0;
  }

  private async buildCanonicalEvents(channels: ChannelState[]): Promise<{
    events: TelegramCanonicalEvent[];
    stats: TelegramState["dedupe_stats"];
  }> {
    type CanonicalCluster = {
      key: string;
      eventId: string;
      latestMs: number;
      primary: CanonicalSourceRecord;
      canonicalText: string;
      tokenSet: Set<string>;
      simhash: bigint;
      mediaSignature: string;
      categoryCounts: Map<string, number>;
      sources: CanonicalSourceRecord[];
      sourceLabels: Set<string>;
      sourceChannels: Set<string>;
      aliases: Set<string>;
      sourceAnchors: Set<string>;
      domainTags: Set<string>;
      trustTiers: Set<ChannelConfig["trustTier"]>;
      latencyTiers: Set<ChannelConfig["latencyTier"]>;
      sourceTypes: Set<ChannelConfig["sourceType"]>;
      acquisitionMethods: Set<ChannelConfig["acquisitionMethod"]>;
      subscriberValueScoreSum: number;
    };

    const sourceRecords = this.buildCanonicalSourceRecords(channels);
    const feedback = await this.loadDedupeFeedbackRules();
    const sourcePerformanceStats = this.loadSourcePerformanceStats();
    const signalProfiles = await this.loadSignalProfiles();
    const channelsByName = new Map(CHANNELS.map((channel) => [channel.username, channel]));
    const clusters: CanonicalCluster[] = [];
    const clusterByKey = new Map<string, number>();
    const canonicalIndex = new Map<string, number[]>();
    const mediaIndex = new Map<string, number[]>();
    const anchorIndex = new Map<string, number[]>();
    const tokenIndex = new Map<string, number[]>();

    const registerIndex = (map: Map<string, number[]>, key: string, index: number): void => {
      if (!key) return;
      const existing = map.get(key);
      if (existing) {
        if (existing[existing.length - 1] !== index) existing.push(index);
        return;
      }
      map.set(key, [index]);
    };

    for (const source of sourceRecords) {
      const rule = feedback.get(source.signature) ?? null;
      const forcedClusterKey = rule?.forcedCluster?.trim() ?? "";
      const candidates = new Set<number>();

      if (!rule?.split) {
        for (const index of canonicalIndex.get(source.canonicalText) ?? []) candidates.add(index);
        if (source.sourceAnchor) {
          for (const index of anchorIndex.get(source.sourceAnchor) ?? []) candidates.add(index);
        }
        if (source.mediaSignature) {
          for (const index of mediaIndex.get(source.mediaSignature) ?? []) candidates.add(index);
        }
        let scanned = 0;
        for (const token of source.tokenSet) {
          if (token.length < 5) continue;
          for (const index of tokenIndex.get(token) ?? []) candidates.add(index);
          scanned += 1;
          if (scanned >= 8) break;
        }
      }

      let selectedClusterIndex = -1;
      let selectedScore = 0;
      if (forcedClusterKey) {
        selectedClusterIndex = clusterByKey.get(forcedClusterKey) ?? -1;
      }

      if (selectedClusterIndex < 0 && !rule?.split) {
        for (const candidateIndex of candidates) {
          const candidate = clusters[candidateIndex];
          if (!candidate) continue;
          const score = this.dedupeClusterScore({
            source,
            cluster: {
              latestMs: candidate.latestMs,
              canonicalText: candidate.canonicalText,
              tokenSet: candidate.tokenSet,
              simhash: candidate.simhash,
              mediaSignature: candidate.mediaSignature,
              sourceAnchors: candidate.sourceAnchors,
            },
          });
          if (score > selectedScore) {
            selectedScore = score;
            selectedClusterIndex = candidateIndex;
          }
        }
      }

      const shouldMerge = selectedClusterIndex >= 0 && (forcedClusterKey.length > 0 || selectedScore >= 0.82);
      if (shouldMerge) {
        const cluster = clusters[selectedClusterIndex]!;
        cluster.sources.push(source);
        cluster.aliases.add(source.signature);
        cluster.sourceLabels.add(source.label);
        cluster.sourceChannels.add(source.channel);
        for (const tag of source.domainTags) cluster.domainTags.add(tag);
        cluster.trustTiers.add(source.trustTier);
        cluster.latencyTiers.add(source.latencyTier);
        cluster.sourceTypes.add(source.sourceType);
        cluster.acquisitionMethods.add(source.acquisitionMethod);
        cluster.subscriberValueScoreSum += source.subscriberValueScore;
        cluster.categoryCounts.set(source.category, (cluster.categoryCounts.get(source.category) ?? 0) + 1);
        if (source.datetimeMs >= cluster.latestMs) {
          cluster.latestMs = source.datetimeMs;
          cluster.primary = source;
        }
        if (source.canonicalText.length > cluster.canonicalText.length) {
          cluster.canonicalText = source.canonicalText;
        }
        if (!cluster.mediaSignature && source.mediaSignature) {
          cluster.mediaSignature = source.mediaSignature;
        }
        if (source.sourceAnchor) {
          cluster.sourceAnchors.add(source.sourceAnchor);
        }
        for (const token of source.tokenSet) {
          if (cluster.tokenSet.size >= 160) break;
          cluster.tokenSet.add(token);
        }
        cluster.simhash = this.buildSimhash(cluster.tokenSet);
        registerIndex(canonicalIndex, source.canonicalText, selectedClusterIndex);
        if (source.sourceAnchor) registerIndex(anchorIndex, source.sourceAnchor, selectedClusterIndex);
        if (source.mediaSignature) registerIndex(mediaIndex, source.mediaSignature, selectedClusterIndex);
        let scanned = 0;
        for (const token of source.tokenSet) {
          if (token.length >= 5) registerIndex(tokenIndex, token, selectedClusterIndex);
          scanned += 1;
          if (scanned >= 8) break;
        }
        continue;
      }

      const baseClusterKey = forcedClusterKey || `ev_${this.hashText(`${source.canonicalText.slice(0, 360)}|${Math.floor((source.datetimeMs || Date.now()) / (30 * 60 * 1000))}|${source.mediaSignature}`)}`;
      const clusterIndex = clusters.length;
      const cluster: CanonicalCluster = {
        key: baseClusterKey,
        eventId: `evt_${this.hashText(`${baseClusterKey}:${source.signature}`)}`,
        latestMs: source.datetimeMs,
        primary: source,
        canonicalText: source.canonicalText,
        tokenSet: new Set(source.tokenSet),
        simhash: source.simhash,
        mediaSignature: source.mediaSignature,
        categoryCounts: new Map([[source.category, 1]]),
        sources: [source],
        sourceLabels: new Set([source.label]),
        sourceChannels: new Set([source.channel]),
        aliases: new Set([source.signature]),
        sourceAnchors: source.sourceAnchor ? new Set([source.sourceAnchor]) : new Set(),
        domainTags: new Set(source.domainTags),
        trustTiers: new Set([source.trustTier]),
        latencyTiers: new Set([source.latencyTier]),
        sourceTypes: new Set([source.sourceType]),
        acquisitionMethods: new Set([source.acquisitionMethod]),
        subscriberValueScoreSum: source.subscriberValueScore,
      };
      clusters.push(cluster);
      clusterByKey.set(cluster.key, clusterIndex);
      registerIndex(canonicalIndex, source.canonicalText, clusterIndex);
      if (source.sourceAnchor) registerIndex(anchorIndex, source.sourceAnchor, clusterIndex);
      if (source.mediaSignature) registerIndex(mediaIndex, source.mediaSignature, clusterIndex);
      let scanned = 0;
      for (const token of source.tokenSet) {
        if (token.length >= 5) registerIndex(tokenIndex, token, clusterIndex);
        scanned += 1;
        if (scanned >= 8) break;
      }
    }

    const events = clusters
      .sort((left, right) => right.latestMs - left.latestMs)
      .slice(0, MAX_CANONICAL_EVENTS)
      .map((cluster) => {
        let dominantCategory = cluster.primary.category;
        let dominantCount = -1;
        for (const [category, count] of cluster.categoryCounts.entries()) {
          if (count > dominantCount) {
            dominantCategory = category;
            dominantCount = count;
          }
        }
        const sortedSources = [...cluster.sources].sort((left, right) => right.datetimeMs - left.datetimeMs);
        const sourceRepresentatives: typeof cluster.sources = [];
        const seenChannels = new Set<string>();
        for (const source of [...cluster.sources].sort((left, right) => left.datetimeMs - right.datetimeMs)) {
          if (seenChannels.has(source.channel)) continue;
          seenChannels.add(source.channel);
          sourceRepresentatives.push(source);
        }
        const firstReporter =
          sourceRepresentatives.find((source) => Number.isFinite(source.datetimeMs) && source.datetimeMs > 0) ??
          sourceRepresentatives[0] ??
          cluster.primary;
        const mediaSeen = new Set<string>();
        const mergedMedia = sortedSources
          .flatMap((source) => source.media)
          .filter((item) => {
            const key = `${item.type}:${item.url}:${item.thumbnail ?? ""}`;
            if (mediaSeen.has(key)) return false;
            mediaSeen.add(key);
            return true;
          })
          .slice(0, 12);
        const visualPrimary =
          sortedSources.find((source) => source.media.length > 0 || (source.imageTextEn || "").trim().length > 0) ??
          cluster.primary;
        const sourceCount = Math.max(1, sourceRepresentatives.length);
        const trustTier = cluster.trustTiers.has("core")
          ? "core"
          : cluster.trustTiers.has("verified")
            ? "verified"
            : "watch";
        const latencyTier = cluster.latencyTiers.has("instant")
          ? "instant"
          : cluster.latencyTiers.has("fast")
            ? "fast"
            : "monitor";
        const nowMs = Date.now();
        const freshnessTier = cluster.latestMs > 0 && nowMs - cluster.latestMs <= 20 * 60 * 1000
          ? "breaking"
          : cluster.latestMs > 0 && nowMs - cluster.latestMs <= 2 * 60 * 60 * 1000
            ? "fresh"
            : "watch";
        const verificationState = sourceCount >= 3
          ? "verified"
          : sourceCount === 2
            ? "corroborated"
            : "single_source";
        const earliestSourceMs =
          sourceRepresentatives.find((source) => source.datetimeMs > 0)?.datetimeMs ?? cluster.latestMs;
        const sourceScores = new Map<string, number>();
        const sourceStatsByChannel = new Map<string, TelegramSourcePerformanceStats>();
        for (const source of sourceRepresentatives) {
          const intraClusterDuplicates = Math.max(
            0,
            cluster.sources.filter((candidate) => candidate.channel === source.channel).length - 1,
          );
          const leadSource =
            sourceCount > 1 &&
            isLeadTelegramSource({
              sourceDatetimeMs: source.datetimeMs,
              earliestDatetimeMs: earliestSourceMs,
              leadWindowMs: 3 * 60 * 1000,
            });
          const nextStats = updateTelegramSourcePerformanceStats({
            previous: sourcePerformanceStats.get(source.channel) ?? null,
            contribution: {
              totalEvents: 1,
              leadReports: leadSource ? 1 : 0,
              followOnReports: intraClusterDuplicates + (sourceCount > 1 && !leadSource ? 1 : 0),
              corroboratedReports: sourceCount > 1 ? 1 : 0,
              singleSourceReports: sourceCount === 1 ? 1 : 0,
              ...(leadSource ? { lastLeadAtMs: source.datetimeMs > 0 ? source.datetimeMs : nowMs } : {}),
              lastSeenAtMs: source.datetimeMs > 0 ? source.datetimeMs : nowMs,
            },
            baseScore: source.subscriberValueScore,
            trustTier: source.trustTier,
            latencyTier: source.latencyTier,
            nowMs,
          });
          sourcePerformanceStats.set(source.channel, nextStats);
          sourceStatsByChannel.set(source.channel, nextStats);
          sourceScores.set(source.channel, nextStats.score);
        }
        const rankedSourceRepresentatives = [...sourceRepresentatives].sort((left, right) => {
          const leftScore = sourceScores.get(left.channel) ?? 0;
          const rightScore = sourceScores.get(right.channel) ?? 0;
          if (rightScore !== leftScore) return rightScore - leftScore;
          return left.datetimeMs - right.datetimeMs;
        });
        const rankedSources = [...cluster.sources].sort((left, right) => {
          const leftScore = sourceScores.get(left.channel) ?? 0;
          const rightScore = sourceScores.get(right.channel) ?? 0;
          if (rightScore !== leftScore) return rightScore - leftScore;
          if (right.datetimeMs !== left.datetimeMs) return right.datetimeMs - left.datetimeMs;
          const channelOrder = left.channel.localeCompare(right.channel);
          if (channelOrder !== 0) return channelOrder;
          return left.signature.localeCompare(right.signature);
        });
        const bestSource = rankedSourceRepresentatives[0] ?? cluster.primary;
        const averageSubscriberValue = Math.round(
          rankedSourceRepresentatives.reduce((sum, source) => sum + (sourceScores.get(source.channel) ?? 0), 0) /
            sourceCount,
        );
        const bestSourceScore = sourceScores.get(bestSource.channel) ?? bestSource.subscriberValueScore;
        const freshnessBoost = freshnessTier === "breaking" ? 10 : freshnessTier === "fresh" ? 4 : 0;
        const corroborationBoost = Math.min(14, Math.max(0, sourceCount - 1) * 4);
        const rankScore = Math.max(
          0,
          Math.min(100, Math.round(bestSourceScore * 0.72 + averageSubscriberValue * 0.28 + freshnessBoost + corroborationBoost)),
        );
        const signalProfile = this.resolveSignalProfile(signalProfiles, dominantCategory);
        const signalGrade = computeTelegramSignalGrade({
          profile: signalProfile,
          input: {
            averageSourceScore: averageSubscriberValue,
            bestSourceScore,
            sourceCount,
            duplicateCount: Math.max(0, cluster.aliases.size - 1),
            trustTier,
            freshnessTier,
            verificationState,
            hasMedia: mergedMedia.length > 0,
            hasUsefulImageText: (visualPrimary.imageTextEn || "").trim().length > 0,
            isFirstReport: sourceCount > 1 && firstReporter.channel === bestSource.channel,
          },
        });
        const displaySourceLabels = rankedSourceRepresentatives
          .map((source) => source.label)
          .filter((value, index, values) => values.indexOf(value) === index)
          .slice(0, 30);
        const displaySourceChannels = rankedSourceRepresentatives
          .map((source) => source.channel)
          .filter((value, index, values) => values.indexOf(value) === index)
          .slice(0, 30);
        return {
          event_id: cluster.eventId,
          event_key: cluster.key,
          datetime: new Date(cluster.latestMs || Date.now()).toISOString(),
          category: dominantCategory,
          categories: [...cluster.categoryCounts.keys()],
          domain_tags: [...cluster.domainTags].sort((left, right) => left.localeCompare(right)).slice(0, 24),
          trust_tier: trustTier,
          latency_tier: latencyTier,
          source_type: bestSource.sourceType,
          acquisition_method: bestSource.acquisitionMethod,
          subscriber_value_score: averageSubscriberValue,
          signal_profile_id: signalProfile.profileId,
          signal_score: signalGrade.score,
          signal_grade: signalGrade.grade,
          signal_reasons: signalGrade.reasons,
          freshness_tier: freshnessTier,
          verification_state: verificationState,
          rank_score: rankScore,
          first_reporter_label: firstReporter.label,
          first_reporter_channel: firstReporter.channel,
          first_reported_at: firstReporter.datetime || new Date(firstReporter.datetimeMs || cluster.latestMs || Date.now()).toISOString(),
          source_count: sourceCount,
          duplicate_count: Math.max(0, cluster.aliases.size - 1),
          source_labels: displaySourceLabels,
          source_channels: displaySourceChannels,
          text_original: cluster.primary.textOriginal,
          text_en: cluster.primary.textEn,
          image_text_en: visualPrimary.imageTextEn,
          language: cluster.primary.language,
          media: mergedMedia,
          has_video: mergedMedia.some((item) => item.type === "video"),
          has_photo: mergedMedia.some((item) => item.type === "photo"),
          sources: rankedSources.slice(0, 60).map((source) => ({
            signature: source.signature,
            channel: source.channel,
            label: source.label,
            category: source.category,
            trust_tier: source.trustTier,
            latency_tier: source.latencyTier,
            source_type: source.sourceType,
            acquisition_method: source.acquisitionMethod,
            domain_tags: source.domainTags,
            subscriber_value_score: sourceStatsByChannel.get(source.channel)?.score ?? source.subscriberValueScore,
            message_id: source.messageId,
            link: source.link,
            datetime: source.datetime,
            views: source.views,
          })),
        } satisfies TelegramCanonicalEvent;
      });

    const rawMessages = sourceRecords.length;
    const canonicalMessages = events.length;
    const feedbackOverrides = Array.from(feedback.values()).filter((rule) => rule.split || Boolean(rule.forcedCluster)).length;

    try {
      await this.persistSourcePerformanceStats(sourcePerformanceStats, channelsByName);
    } catch (error) {
      console.error("[TelegramScraper] Failed to persist source performance stats:", error);
    }

    return {
      events,
      stats: {
        raw_messages: rawMessages,
        canonical_messages: canonicalMessages,
        duplicates_collapsed: Math.max(0, rawMessages - canonicalMessages),
        feedback_overrides: feedbackOverrides,
      },
    };
  }

  // ==========================================================================
  // HTTP handler — health check + manual trigger
  // ==========================================================================

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const alarm = await this.ctx.storage.getAlarm();
      const row = this.ctx.storage.sql
        .exec("SELECT COUNT(*) as cnt FROM seen_messages")
        .one() as { cnt: number } | null;

      return jsonResponse({
        status: "ok",
        isRunning: this.isRunning,
        lastRun: this.lastRunMs
          ? new Date(this.lastRunMs).toISOString()
          : null,
        nextAlarm: alarm ? new Date(alarm).toISOString() : null,
        trackedMessages: row?.cnt ?? 0,
        channelCount: CHANNELS.length,
        scrapeIntervalMs: this.getScrapeIntervalMs(),
        rotationWindowSeconds: this.getRotationWindowSeconds(),
        rotationSlot: this.lastRotationSlot,
        rotationSlots: this.lastRotationSlots,
        lastCycleTargetChannels: this.lastCycleTargetChannels,
        lastCycleFetchedChannels: this.lastCycleFetchedChannels,
        lastCycleStats: this.lastCycleStats,
      });
    }

    if (url.pathname === "/trigger") {
      if (this.isRunning) {
        return jsonResponse({ status: "already_running" });
      }
      this.ctx.waitUntil(this.runScrape());
      return jsonResponse({ status: "triggered" });
    }

    if (url.pathname === "/state") {
      const state = await this.loadPreviousState();
      if (!state) {
        return jsonResponse({ error: "state_unavailable" }, { status: 503 });
      }
      return jsonResponse(state, {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/stream") {
      if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
        return new Response("Expected websocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server, [TELEGRAM_STREAM_WS_TAG]);
      const currentState = await this.loadPreviousState();
      server.send(
        JSON.stringify({
          type: "hello",
          timestamp: currentState?.timestamp ?? null,
          totalChannels: currentState?.total_channels ?? CHANNELS.length,
        }),
      );
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    if (url.pathname === "/admin/dedupe-feedback") {
      if (request.method === "GET") {
        const rows = this.ctx.storage.sql
          .exec(
            "SELECT signature, forced_cluster, split, updated_at FROM dedupe_feedback ORDER BY updated_at DESC LIMIT 500",
          )
          .toArray() as Array<{ signature: string; forced_cluster: string | null; split: number; updated_at: number }>;
        return jsonResponse({
          ok: true,
          count: rows.length,
          rows: rows.map((row) => ({
            signature: row.signature,
            forcedCluster: row.forced_cluster,
            split: Number(row.split) === 1,
            updatedAtMs: Number(row.updated_at) || 0,
          })),
        });
      }

      if (request.method === "POST") {
        let payload: {
          action?: unknown;
          signatures?: unknown;
          targetCluster?: unknown;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
        }

        const action = typeof payload.action === "string" ? payload.action.trim().toLowerCase() : "";
        const signatures = Array.isArray(payload.signatures)
          ? payload.signatures
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
            .slice(0, 200)
          : [];
        const targetCluster = typeof payload.targetCluster === "string"
          ? payload.targetCluster.trim().slice(0, 120)
          : "";

        if (signatures.length === 0) {
          return jsonResponse({ ok: false, error: "missing_signatures" }, { status: 400 });
        }

        const now = Date.now();
        if (action === "split") {
          for (const signature of signatures) {
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO dedupe_feedback (signature, forced_cluster, split, updated_at) VALUES (?, ?, 1, ?)",
              signature,
              null,
              now,
            );
          }
          return jsonResponse({ ok: true, action, updated: signatures.length });
        }

        if (action === "merge") {
          const effectiveCluster = targetCluster || `manual_${this.hashText(signatures.join("|"))}`;
          for (const signature of signatures) {
            this.ctx.storage.sql.exec(
              "INSERT OR REPLACE INTO dedupe_feedback (signature, forced_cluster, split, updated_at) VALUES (?, ?, 0, ?)",
              signature,
              effectiveCluster,
              now,
            );
          }
          return jsonResponse({ ok: true, action, updated: signatures.length, targetCluster: effectiveCluster });
        }

        if (action === "clear") {
          for (const signature of signatures) {
            this.ctx.storage.sql.exec(
              "DELETE FROM dedupe_feedback WHERE signature = ?",
              signature,
            );
          }
          return jsonResponse({ ok: true, action, updated: signatures.length });
        }

        return jsonResponse({ ok: false, error: "invalid_action" }, { status: 400 });
      }

      return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    return new Response("Not Found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const normalized = text.trim().toLowerCase();
    if (normalized === "ping") {
      ws.send(JSON.stringify({ type: "pong", at: new Date().toISOString() }));
      return;
    }
    if (normalized === "state") {
      const currentState = await this.loadPreviousState();
      ws.send(
        JSON.stringify({
          type: "state",
          timestamp: currentState?.timestamp ?? null,
          totalChannels: currentState?.total_channels ?? CHANNELS.length,
        }),
      );
    }
  }

  webSocketClose(): void {
    // Hibernated sockets are cleaned up by the platform.
  }

  webSocketError(): void {
    // No-op; socket lifecycle is best-effort for browser invalidation only.
  }

  // ==========================================================================
  // Alarm — recurring scrape cycle
  // ==========================================================================

  async alarm(): Promise<void> {
    debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Alarm fired");
    const nextDelayMs = this.getScrapeIntervalMs();
    const scheduledAt = Date.now() + nextDelayMs;
    try {
      // Schedule the next run before scraping to minimize cadence drift.
      await this.ctx.storage.setAlarm(scheduledAt);
      const hadNewMessages = await this.runScrape();
      debugRuntimeLog(this.runtimeEnv, 
        `[TelegramScraper] Next alarm in ${Math.round(nextDelayMs / 1000)}s (hadNewMessages=${hadNewMessages})`,
      );
    } catch (err) {
      console.error("[TelegramScraper] Scrape cycle CRASHED:", err instanceof Error ? `${err.message}\n${err.stack}` : err);
      const alarm = await this.ctx.storage.getAlarm();
      if (!alarm || alarm < Date.now()) {
        await this.ctx.storage.setAlarm(Date.now() + this.getScrapeIntervalMs());
      }
    }
  }

  // ==========================================================================
  // Main scrape cycle
  // ==========================================================================

  private async runScrape(): Promise<boolean> {
    if (this.isRunning) return false;
    this.isRunning = true;
    const t0 = Date.now();
    let hadNewMessages = false;

    try {
      // ---- 1. Load previous state from DO storage (with KV fallback) ----
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 1: Loading previous state...");
      const prevState = await this.loadPreviousState();
      const prevMap = new Map<string, ChannelState>();
      const isFirstRun = !prevState;
      if (prevState) {
        for (const ch of prevState.channels) {
          prevMap.set(ch.username, ch);
        }
      }
      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 1 done: isFirstRun=${isFirstRun}, prevChannels=${prevMap.size}`);

      // ---- 2. Fetch all channel HTML with fixed worker fan-out ----
      const rotation = this.selectChannelsForCycle(Date.now());
      const cycleChannels = rotation.channels;
      this.lastRotationSlot = rotation.slot;
      this.lastRotationSlots = rotation.slots;
      this.lastCycleTargetChannels = cycleChannels.length;
      debugRuntimeLog(this.runtimeEnv, 
        `[TelegramScraper] Phase 2: Fetching channel HTML for slot ${rotation.slot + 1}/${rotation.slots} (${cycleChannels.length}/${CHANNELS.length} channels)...`,
      );
      const htmlMap = new Map<string, string>();
      const fetched = await mapWithConcurrency(
        cycleChannels,
        this.getScrapeWorkerConcurrency(),
        async (ch) => {
          const html = await this.fetchChannelHtml(ch.username);
          return { username: ch.username, html };
        },
      );

      let fetchedCount = 0;
      for (const row of fetched) {
        if (!row.html) continue;
        htmlMap.set(row.username, row.html);
        fetchedCount++;
      }
      this.lastCycleFetchedChannels = fetchedCount;

      debugRuntimeLog(this.runtimeEnv, 
        `[TelegramScraper] Phase 2 done: Fetched ${fetchedCount}/${cycleChannels.length} slot channels (${CHANNELS.length} total tracked)`,
      );

      // ---- 3. Parse HTML + diff against previous state ----
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 3: Parsing HTML + diffing...");
      interface ChannelNewMsgs {
        config: ChannelConfig;
        newMessages: ParsedMessage[];
        existingMessages: StoredMessage[];
      }
      const channelsWithNew: ChannelNewMsgs[] = [];
      const unchangedChannels: ChannelState[] = [];
      let totalNewMessages = 0;

      for (const config of CHANNELS) {
        const html = htmlMap.get(config.username);
        if (!html) {
          // Channel fetch failed — keep previous state
          const prev = prevMap.get(config.username);
          if (prev) {
            unchangedChannels.push(prev);
          } else {
            unchangedChannels.push(this.makeEmptyChannelState(config));
          }
          continue;
        }

        const parsed = parseChannelHtml(html);
        if (parsed.length === 0) {
          const prev = prevMap.get(config.username);
          if (prev) {
            unchangedChannels.push(prev);
          } else {
            unchangedChannels.push(this.makeEmptyChannelState(config));
          }
          continue;
        }

        // Diff: filter out messages we already have
        const prev = prevMap.get(config.username);
        const existingLinks = new Set<string>();
        const existingMessages: StoredMessage[] = [];
        if (prev) {
          for (const m of prev.messages) {
            existingLinks.add(m.link);
            existingMessages.push(m);
          }
        }

        // Filter to genuinely new messages (not in previous state + not in dedup table)
        const newMessages: ParsedMessage[] = [];
        for (const msg of parsed) {
          if (existingLinks.has(msg.link)) continue;
          if (this.isMessageSeen(config.username, msg)) continue;
          newMessages.push(msg);
        }

        if (newMessages.length > 0) {
          channelsWithNew.push({ config, newMessages, existingMessages });
          totalNewMessages += newMessages.length;
        } else {
          // No new messages — keep previous state but still include parsed data on first run
          if (prev) {
            unchangedChannels.push(prev);
          } else if (isFirstRun) {
            // First run: include all parsed messages even if "not new" (dedup table empty)
            // This case shouldn't normally happen since dedup table is empty on first run
            // but handle it to be safe
            unchangedChannels.push({
              username: config.username,
              label: config.label,
              category: config.category,
              language: config.language,
              message_count: 0,
              messages: [],
            });
          }
        }
      }

      debugRuntimeLog(this.runtimeEnv, 
        `[TelegramScraper] Phase 3 done: ${channelsWithNew.length} channels with ${totalNewMessages} new messages, ${unchangedChannels.length} unchanged`,
      );
      hadNewMessages = totalNewMessages > 0;

      // ---- 4. Batch translate all new messages ----
      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4: Translating... (${totalNewMessages} new messages)`);
      // Use a composite key "ci:mi" to track translations
      const translationKeyMap = new Map<string, string>(); // "ci:mi" → translated text
      const imageTextKeyMap = new Map<string, string>(); // "ci:mi" → OCR + translated image text
      let totalTranslated = 0;
      let totalFailed = 0;
      let gatewayTranslated = 0;
      let directTranslated = 0;
      let imageTranslated = 0;
      let imageFailed = 0;
      let textCacheHits = 0;
      let imageCacheHits = 0;

      try {
        const allTranslationJobs: Array<TranslationJob & { _key: string; _cacheKey: string }> = [];
        const allImageJobs: Array<ImageTranslationJob & { _key: string; _cacheKey: string }> = [];
        let jobIdx = 0;
        let imageJobIdx = 0;

        for (let ci = 0; ci < channelsWithNew.length; ci++) {
          const { config, newMessages } = channelsWithNew[ci];
          for (let mi = 0; mi < newMessages.length; mi++) {
            const msg = newMessages[mi];
            const key = `${ci}:${mi}`;
            if (needsTranslation(msg.text, config.language)) {
              allTranslationJobs.push({
                index: jobIdx,
                text: msg.text,
                _key: key,
                _cacheKey: this.buildTextTranslationCacheKey(msg.text, config.language),
              });
              jobIdx++;
            }
            const imageUrl = this.pickImageSourceForOcr(msg);
            if (imageUrl && allImageJobs.length < MAX_IMAGE_TRANSLATION_JOBS_PER_CYCLE) {
              allImageJobs.push({
                index: imageJobIdx,
                imageUrl,
                contextText: msg.text,
                _key: key,
                _cacheKey: this.buildImageTranslationCacheKey(imageUrl, msg.text),
              });
              imageJobIdx++;
            }
          }
        }

        const uncachedTranslationJobs: Array<TranslationJob & { _key: string; _cacheKey: string }> = [];
        for (const job of allTranslationJobs) {
          const cached = this.getCachedTranslation("text", job._cacheKey);
          if (!cached) {
            uncachedTranslationJobs.push(job);
            continue;
          }
          if (this.isAcceptedEnglishTranslation(cached)) {
            translationKeyMap.set(job._key, cached);
            textCacheHits++;
          } else {
            uncachedTranslationJobs.push(job);
          }
        }

        debugRuntimeLog(this.runtimeEnv, 
          `[TelegramScraper] Phase 4: ${allTranslationJobs.length} messages need translation (${textCacheHits} cache hits, ${uncachedTranslationJobs.length} uncached)`,
        );

        if (uncachedTranslationJobs.length > 0 && this.env.GROQ_API_KEY) {
          const gatewayToken = resolveAiGatewayToken(this.env);
          const { results, failed, failedIndexes, gatewaySuccess, directSuccess } = await translateBatch(
            uncachedTranslationJobs,
            this.env.GROQ_API_KEY,
            {
              gatewayToken,
              gatewayAccountId: this.env.CF_ACCOUNT_ID,
              gatewayName: this.env.AI_GATEWAY_NAME,
            },
          );
          const failedIndexSet = new Set<number>(failedIndexes);
          let rejectedNotEnglish = 0;
          for (const job of uncachedTranslationJobs) {
            if (failedIndexSet.has(job.index)) continue;
            const translatedText = results.get(job.index);
            if (!translatedText) continue;
            if (this.isAcceptedEnglishTranslation(translatedText)) {
              const cleaned = translatedText.trim();
              translationKeyMap.set(job._key, cleaned);
              this.setCachedTranslation("text", job._cacheKey, cleaned);
            } else {
              rejectedNotEnglish++;
            }
          }
          totalTranslated = Math.max(0, translationKeyMap.size - textCacheHits);
          totalFailed = failed + rejectedNotEnglish;
          gatewayTranslated += gatewaySuccess;
          directTranslated += directSuccess;
          debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4: ${totalTranslated} accepted, ${totalFailed} failed/rejected, gateway=${gatewaySuccess}, direct=${directSuccess}`);
        }

        const uncachedImageJobs: Array<ImageTranslationJob & { _key: string; _cacheKey: string }> = [];
        for (const job of allImageJobs) {
          const cached = this.getCachedTranslation("image", job._cacheKey);
          if (cached === null) {
            uncachedImageJobs.push(job);
            continue;
          }
          imageCacheHits++;
          if (cached && cached !== IMAGE_TRANSLATION_CACHE_EMPTY_SENTINEL) {
            imageTextKeyMap.set(job._key, cached);
          }
        }

        if (uncachedImageJobs.length > 0 && this.env.GROQ_API_KEY) {
          const gatewayToken = resolveAiGatewayToken(this.env);
          const { results, translated, failed, failedIndexes } = await translateImageBatch(
            uncachedImageJobs,
            this.env.GROQ_API_KEY,
            {
              gatewayToken,
              gatewayAccountId: this.env.CF_ACCOUNT_ID,
              gatewayName: this.env.AI_GATEWAY_NAME,
            },
          );
          const failedIndexSet = new Set<number>(failedIndexes);
          for (const job of uncachedImageJobs) {
            if (failedIndexSet.has(job.index)) continue;
            const imageText = (results.get(job.index) || "").trim();
            if (imageText) imageTextKeyMap.set(job._key, imageText);
            this.setCachedTranslation("image", job._cacheKey, imageText);
          }
          imageTranslated = translated + imageCacheHits;
          imageFailed = failed;
          debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4 image OCR: ${translated} translated (${imageCacheHits} cache hits), ${imageFailed} failed`);
        } else if (allImageJobs.length > 0) {
          imageTranslated = imageCacheHits;
          debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4 image OCR: 0 translated (${imageCacheHits} cache hits), 0 failed`);
        }
      } catch (translateErr) {
        console.error("[TelegramScraper] Phase 4 FAILED entirely:", translateErr instanceof Error ? translateErr.message : translateErr);
        // Continue cycle; strict translation gating in phase 5 prevents non-English leaks.
      }

      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4 done: ${totalTranslated} translated, ${totalFailed} failed, image_ocr=${imageTranslated}/${imageFailed}`);

      // ---- 4b. Backfill: translate existing untranslated messages ----
      let backfilled = 0;
      const backfilledRecords: PersistMessageRecord[] = [];
      try {
        const backfillJobs: TranslationJob[] = [];
        const backfillRefs: Array<{ chIdx: number; msgIdx: number; channel: string; messageId: string }> = [];
        outer: for (let ci = 0; ci < unchangedChannels.length; ci++) {
          const ch = unchangedChannels[ci];
          for (let mi = 0; mi < ch.messages.length; mi++) {
            const m = ch.messages[mi];
            if (m.language === "en") continue;
            if (m.text_original !== m.text_en) continue;
            if (m.text_original.length < 5) continue;
            if (!needsTranslation(m.text_original, m.language)) continue;

            const messageId = this.extractMessageIdFromLink(m.link);
            if (!this.shouldAttemptBackfill(ch.username, messageId)) continue;

            backfillJobs.push({ index: backfillJobs.length, text: m.text_original });
            backfillRefs.push({ chIdx: ci, msgIdx: mi, channel: ch.username, messageId });

            if (backfillJobs.length >= MAX_BACKFILL_JOBS_PER_CYCLE) {
              break outer;
            }
          }
        }
        if (backfillJobs.length > 0 && this.env.GROQ_API_KEY) {
          const gatewayToken = resolveAiGatewayToken(this.env);
          debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4b: Backfilling ${backfillJobs.length} untranslated messages`);
          const { results, translated, failed, failedIndexes, gatewaySuccess, directSuccess } = await translateBatch(
            backfillJobs,
            this.env.GROQ_API_KEY,
            {
              gatewayToken,
              gatewayAccountId: this.env.CF_ACCOUNT_ID,
              gatewayName: this.env.AI_GATEWAY_NAME,
            },
          );
          const failedIndexSet = new Set<number>(failedIndexes);
          for (const [idx, text] of results) {
            const ref = backfillRefs[idx];
            if (!ref) continue;
            const channelState = unchangedChannels[ref.chIdx];
            const message = channelState.messages[ref.msgIdx];
            if (!message) continue;
            const translated = (text || "").trim();
            const translationRejected = translated
              ? !this.isAcceptedEnglishTranslation(translated)
              : true;
            if (failedIndexSet.has(idx) || translationRejected) {
              this.recordBackfillFailure(ref.channel, ref.messageId);
            } else {
              message.text_en = translated;
              this.clearBackfillFailure(ref.channel, ref.messageId);
              backfilledRecords.push({
                source: "backfill",
                channel: channelState.username,
                label: channelState.label,
                category: channelState.category,
                messageId: ref.messageId,
                link: message.link,
                datetime: message.datetime,
                views: message.views,
                textOriginal: message.text_original,
                textEn: message.text_en,
                imageTextEn: message.image_text_en,
                language: message.language,
                hasVideo: message.has_video,
                hasPhoto: message.has_photo,
                media: message.media,
              });
            }
          }
          backfilled = translated;
          totalTranslated += translated;
          totalFailed += failed;
          gatewayTranslated += gatewaySuccess;
          directTranslated += directSuccess;
          debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 4b done: ${translated} backfilled, ${failed} failed, gateway=${gatewaySuccess}, direct=${directSuccess}`);
        }
      } catch (backfillErr) {
        console.error("[TelegramScraper] Phase 4b backfill error:", backfillErr instanceof Error ? backfillErr.message : backfillErr);
      }
      // ---- 5. Build messages + upload media (skip media on first run) ----
      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 5: Building messages${isFirstRun ? " (SKIP media — first run)" : " + uploading media"}...`);
      const newChannelStates: ChannelState[] = [];
      const newMessageRecords: PersistMessageRecord[] = [];
      let mediaUploaded = 0;
      let mediaSkipped = 0;
      let pendingTranslationThisCycle = 0;
      const maxMessagesPerChannel = this.getMaxMessagesPerChannel();

      try {
        const builtChannels = await mapWithConcurrency(
          channelsWithNew.map((item, ci) => ({ ...item, ci })),
          this.getChannelBuildConcurrency(),
          async ({ config, newMessages, existingMessages, ci }) => {
            const storedNew: StoredMessage[] = [];
            const channelRecords: PersistMessageRecord[] = [];
            const storedAtIso = new Date().toISOString();

            for (let mi = 0; mi < newMessages.length; mi++) {
              const msg = newMessages[mi];
              const translationKey = `${ci}:${mi}`;
              const requiresTextTranslation = needsTranslation(msg.text, config.language);
              const translatedText = translationKeyMap.get(translationKey);
              if (requiresTextTranslation && !translatedText) {
                pendingTranslationThisCycle++;
              }
              const textEn = translatedText ?? msg.text;
              const hasImageForOcr = Boolean(this.pickImageSourceForOcr(msg));
              const imageTextEn =
                imageTextKeyMap.get(translationKey) ??
                (hasImageForOcr ? "No readable text detected in image." : undefined);
              const detectedLanguage = detectLanguage(msg.text);

              // On first run, skip media upload entirely to get data flowing
              // On subsequent runs, upload media to R2
              let processedMedia: StoredMessage["media"];
              if (isFirstRun) {
                processedMedia = msg.media.map((m) => ({
                  type: m.type,
                  url: m.url,
                  thumbnail: m.thumbnail,
                }));
                mediaSkipped += msg.media.length;
              } else {
                try {
                  processedMedia = await this.processMediaBatch(
                    msg.media,
                    config.username,
                    msg.id,
                  );
                  mediaUploaded += msg.media.length;
                } catch (mediaErr) {
                  console.error(`[TelegramScraper] Phase 5: Media failed for ${config.username}/${msg.id}:`, mediaErr instanceof Error ? mediaErr.message : mediaErr);
                  processedMedia = msg.media.map((m) => ({
                    type: m.type,
                    url: m.url,
                    thumbnail: m.thumbnail,
                  }));
                  mediaSkipped += msg.media.length;
                }
              }

              storedNew.push({
                text_original: msg.text,
                text_en: textEn,
                image_text_en: imageTextEn,
                stored_at: storedAtIso,
                datetime: msg.datetime,
                link: msg.link,
                views: msg.views,
                media: processedMedia,
                has_video: msg.hasVideo,
                has_photo: msg.hasPhoto,
                language: detectedLanguage,
              });
              channelRecords.push({
                source: "new",
                channel: config.username,
                label: config.label,
                category: config.category,
                messageId: this.extractMessageIdFromLink(msg.link),
                link: msg.link,
                datetime: msg.datetime,
                views: msg.views,
                textOriginal: msg.text,
                textEn,
                imageTextEn,
                language: detectedLanguage,
                hasVideo: msg.hasVideo,
                hasPhoto: msg.hasPhoto,
                media: processedMedia,
              });

              // Record in dedup table
              this.recordSeen(config.username, msg);
            }

            const allMsgs = [...storedNew, ...existingMessages]
              .sort((a, b) => (b.datetime || "").localeCompare(a.datetime || ""))
              .slice(0, maxMessagesPerChannel);

            return {
              state: {
                username: config.username,
                label: config.label,
                category: config.category,
                language: config.language,
                trust_tier: config.trustTier,
                latency_tier: config.latencyTier,
                source_type: config.sourceType,
                acquisition_method: config.acquisitionMethod,
                domain_tags: config.domainTags,
                subscriber_value_score: config.subscriberValueScore,
                message_count: allMsgs.length,
                messages: allMsgs,
              } satisfies ChannelState,
              records: channelRecords,
            };
          },
        );
        for (const builtChannel of builtChannels) {
          newChannelStates.push(builtChannel.state);
          newMessageRecords.push(...builtChannel.records);
        }
      } catch (phase5Err) {
        console.error("[TelegramScraper] Phase 5 FAILED:", phase5Err instanceof Error ? `${phase5Err.message}\n${phase5Err.stack}` : phase5Err);
        // Still try to write whatever we assembled so far
      }

      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 5 done: ${newChannelStates.length} channel states built, ${mediaUploaded} media uploaded, ${mediaSkipped} media skipped, ${pendingTranslationThisCycle} pending translation`);

      // ---- 6. Assemble final state ----
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 6: Assembling final state...");
      const byUsername = new Map<string, ChannelState>();
      for (const channelState of unchangedChannels) {
        byUsername.set(channelState.username, channelState);
      }
      for (const channelState of newChannelStates) {
        byUsername.set(channelState.username, channelState);
      }
      for (const config of CHANNELS) {
        if (!byUsername.has(config.username)) {
          byUsername.set(config.username, this.makeEmptyChannelState(config));
        }
      }
      const allChannels = CHANNELS
        .map((config) => byUsername.get(config.username) ?? this.makeEmptyChannelState(config))
        .map((channelState) => {
          const filteredMessages = channelState.messages;
          return {
            ...channelState,
            messages: filteredMessages,
            message_count: filteredMessages.length,
          };
        });

      // ---- 6a. Media backfill: migrate remaining external media URLs into R2 ----
      const mediaBackfill = await this.backfillExternalMediaInChannels(allChannels);
      if (mediaBackfill.attempted > 0) {
        debugRuntimeLog(this.runtimeEnv, 
          `[TelegramScraper] Phase 6a media backfill: scanned=${mediaBackfill.scanned}, attempted=${mediaBackfill.attempted}, recovered=${mediaBackfill.recovered}, failed=${mediaBackfill.failed}`,
        );
      }

      let totalMessages = 0;
      for (const ch of allChannels) totalMessages += ch.message_count;
      const totalBlockedUntranslated = pendingTranslationThisCycle;
      const canonical = await this.buildCanonicalEvents(allChannels);

      const state: TelegramState = {
        timestamp: new Date().toISOString(),
        source: "Telegram public channels (Worker scraper)",
        total_channels: CHANNELS.length,
        channels_fetched: fetchedCount,
        cycle_channels: cycleChannels.length,
        rotation_slot: rotation.slot,
        rotation_slots: rotation.slots,
        total_messages: totalMessages,
        translated_messages: totalTranslated,
        failed_translations: totalFailed,
        blocked_untranslated_messages: totalBlockedUntranslated,
        translation_engine: `Groq ${GROQ_MODEL} (gateway:${gatewayTranslated}, direct:${directTranslated}, image_ocr:${imageTranslated}/${imageFailed}, cache:text=${textCacheHits},image=${imageCacheHits}, media_backfill:${mediaBackfill.recovered}/${mediaBackfill.failed})`,
        categories: CATEGORIES,
        channels: allChannels,
        canonical_total_messages: canonical.events.length,
        canonical_events: canonical.events,
        dedupe_stats: canonical.stats,
      };

      const stateJson = JSON.stringify(state);
      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] Phase 6 done: ${allChannels.length} total channels, ${totalMessages} raw messages, ${canonical.events.length} canonical events, JSON size: ${(stateJson.length / 1024).toFixed(0)}KB`);
      this.broadcastStateInvalidation({
        type: "state_updated",
        timestamp: state.timestamp,
        totalMessages,
        canonicalEvents: canonical.events.length,
        cycleChannels: cycleChannels.length,
      });

      // ---- 7. Persist to R2 archive + D1 history ----
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 7: Persisting cycle history...");
      const cycleId = `${Date.now()}-${crypto.randomUUID()}`;
      const createdAt = new Date().toISOString();
      const scrapeElapsedMs = Date.now() - t0;
      const cycleRecords = [...newMessageRecords, ...backfilledRecords, ...mediaBackfill.records];
      const deltaPayload = {
        cycle_id: cycleId,
        timestamp: createdAt,
        rotation_slot: rotation.slot,
        rotation_slots: rotation.slots,
        cycle_channels: cycleChannels.length,
        channels_fetched: fetchedCount,
        new_messages: totalNewMessages,
        backfilled_messages: backfilledRecords.length,
        media_backfilled_messages: mediaBackfill.records.length,
        translated_messages: totalTranslated,
        failed_translations: totalFailed,
        blocked_untranslated_messages: totalBlockedUntranslated,
        records: cycleRecords.map((record) => ({
          source: record.source,
          channel: record.channel,
          label: record.label,
          category: record.category,
          message_id: record.messageId,
          link: record.link,
          datetime: record.datetime,
          language: record.language,
          views: record.views,
          has_video: record.hasVideo,
          has_photo: record.hasPhoto,
          media_count: record.media.length,
          has_image_text_en: Boolean(record.imageTextEn),
        })),
      };
      const deltaJson = JSON.stringify(deltaPayload);
      const shouldArchiveFullState = rotation.slot === 0 || isFirstRun;
      const { stateKey, deltaKey } = await this.archiveCycle(
        createdAt,
        cycleId,
        stateJson,
        deltaJson,
        shouldArchiveFullState,
      );
      try {
        await this.persistCycleToD1({
          cycleId,
          createdAt,
          rotationSlot: rotation.slot,
          rotationSlots: rotation.slots,
          cycleChannels: cycleChannels.length,
          channelsFetched: fetchedCount,
          totalChannels: CHANNELS.length,
          totalMessages,
          newMessages: totalNewMessages,
          backfilledMessages: backfilledRecords.length,
          translatedMessages: totalTranslated,
          failedTranslations: totalFailed,
          translationEngine: state.translation_engine,
          stateKey,
          deltaKey,
          scrapeElapsedMs,
          messageRecords: cycleRecords,
          canonicalEvents: canonical.events,
        });
      } catch (persistErr) {
        console.error(
          "[TelegramScraper] D1 persistence failed (continuing with KV):",
          persistErr instanceof Error ? persistErr.message : persistErr,
        );
      }
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 7 done: history persisted ✅");

      // ---- 8. Write canonical state to DO storage + mirror to KV hot cache ----
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 8: Writing canonical state...");
      if (stateJson.length <= 900_000) {
        await this.ctx.storage.put(LATEST_TELEGRAM_STATE_DO_KEY, stateJson);
      } else {
        await this.ctx.storage.delete(LATEST_TELEGRAM_STATE_DO_KEY);
      }
      await this.env.TELEGRAM_STATE.put(LATEST_TELEGRAM_STATE_KV_KEY, stateJson);
      debugRuntimeLog(this.runtimeEnv, "[TelegramScraper] Phase 8 done: state write complete ✅");

      // ---- 9. Cleanup old dedup records ----
      this.cleanupOldRecords();

      this.lastRunMs = Date.now();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      this.lastCycleStats = `${elapsed}s | slot ${rotation.slot + 1}/${rotation.slots} | ${fetchedCount}/${cycleChannels.length} fetched | ${allChannels.length} tracked | ${channelsWithNew.length} with new | ${totalNewMessages} new msgs | ${totalTranslated} translated | ${totalFailed} failed | ${totalBlockedUntranslated} blocked | ${imageTranslated} image-ocr | ${mediaUploaded} media | media_backfill ${mediaBackfill.recovered}/${mediaBackfill.attempted}`;
      debugRuntimeLog(this.runtimeEnv, `[TelegramScraper] ✅ Cycle complete: ${this.lastCycleStats}`);
      return hadNewMessages;
    } catch (outerErr) {
      console.error("[TelegramScraper] FATAL cycle error:", outerErr instanceof Error ? `${outerErr.message}\n${outerErr.stack}` : outerErr);
      return false;
    } finally {
      this.isRunning = false;
    }
  }

  // ==========================================================================
  // Channel fetching
  // ==========================================================================

  private async fetchChannelHtml(
    username: string,
  ): Promise<string | null> {
    try {
      const res = await fetch(`https://t.me/s/${username}`, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        if (res.status !== 404) {
          console.error(
            `[TelegramScraper] ${username} → ${res.status}`,
          );
        }
        return null;
      }

      return await res.text();
    } catch (err) {
      console.error(
        `[TelegramScraper] ${username} fetch error:`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  // ==========================================================================
  // Deduplication (DO SQLite)
  // ==========================================================================

  private isMessageSeen(channel: string, msg: ParsedMessage): boolean {
    const msgId = msg.id.split("/").pop() || "";
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT 1 FROM seen_messages WHERE channel = ? AND message_id = ? LIMIT 1",
        channel,
        msgId,
      )
      .toArray();
    return rows.length > 0;
  }

  private recordSeen(channel: string, msg: ParsedMessage): void {
    const msgId = msg.id.split("/").pop() || "";
    const textHash =
      msg.text.length > 50 ? this.hashText(msg.text) : null;
    this.ctx.storage.sql.exec(
      "INSERT OR IGNORE INTO seen_messages (channel, message_id, text_hash, first_seen) VALUES (?, ?, ?, ?)",
      channel,
      msgId,
      textHash,
      Date.now(),
    );
  }

  private hashText(text: string): string {
    const normalized = text
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      hash = (hash << 5) - hash + normalized.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  private cleanupOldRecords(): void {
    const cutoff = Date.now() - DEDUP_TTL_MS;
    const translationCacheCutoff =
      Date.now() - Math.max(TEXT_TRANSLATION_CACHE_TTL_MS, IMAGE_TRANSLATION_CACHE_TTL_MS);
    const canonicalCutoff = Date.now() - CANONICAL_HISTORY_TTL_MS;
    this.ctx.storage.sql.exec(
      "DELETE FROM seen_messages WHERE first_seen < ?",
      cutoff,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM translation_backoff WHERE updated_at < ?",
      cutoff,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM media_backoff WHERE updated_at < ?",
      cutoff,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM translation_cache WHERE updated_at < ?",
      translationCacheCutoff,
    );
    this.ctx.storage.sql.exec(
      "DELETE FROM dedupe_feedback WHERE updated_at < ?",
      canonicalCutoff,
    );
    if (this.env.INTEL_DB) {
      void this.env.INTEL_DB.prepare(
        "DELETE FROM telegram_canonical_event_sources WHERE updated_at < ?",
      ).bind(new Date(canonicalCutoff).toISOString()).run();
      void this.env.INTEL_DB.prepare(
        "DELETE FROM telegram_canonical_events WHERE updated_at < ?",
      ).bind(new Date(canonicalCutoff).toISOString()).run();
    }
  }

  private extractMessageIdFromLink(link: string): string {
    const clean = (link || "").split("?")[0].replace(/\/+$/, "");
    const id = clean.split("/").pop() || "";
    return id || link || "unknown";
  }

  private shouldAttemptBackfill(channel: string, messageId: string): boolean {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT next_retry FROM translation_backoff WHERE channel = ? AND message_id = ? LIMIT 1",
        channel,
        messageId,
      )
      .toArray() as Array<{ next_retry: number }>;
    const row = rows[0] ?? null;
    if (!row) return true;
    return row.next_retry <= Date.now();
  }

  private recordBackfillFailure(channel: string, messageId: string): void {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT fail_count FROM translation_backoff WHERE channel = ? AND message_id = ? LIMIT 1",
        channel,
        messageId,
      )
      .toArray() as Array<{ fail_count: number }>;
    const row = rows[0] ?? null;
    const failCount = (row?.fail_count ?? 0) + 1;
    const multiplier = Math.pow(2, Math.max(0, failCount - 1));
    const delayMs = Math.min(BACKFILL_MAX_RETRY_MS, BACKFILL_BASE_RETRY_MS * multiplier);
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO translation_backoff (channel, message_id, fail_count, next_retry, updated_at) VALUES (?, ?, ?, ?, ?)",
      channel,
      messageId,
      failCount,
      now + delayMs,
      now,
    );
  }

  private clearBackfillFailure(channel: string, messageId: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM translation_backoff WHERE channel = ? AND message_id = ?",
      channel,
      messageId,
    );
  }

  private hasExternalMediaReference(media: StoredMessage["media"]): boolean {
    for (const item of media) {
      if (item.url.startsWith("http")) {
        return true;
      }
      if ((item.thumbnail || "").startsWith("http")) {
        return true;
      }
    }
    return false;
  }

  private shouldAttemptMediaBackfill(channel: string, messageId: string, mediaKey: string): boolean {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT next_retry FROM media_backoff WHERE channel = ? AND message_id = ? AND media_key = ? LIMIT 1",
        channel,
        messageId,
        mediaKey,
      )
      .toArray() as Array<{ next_retry: number }>;
    const row = rows[0] ?? null;
    if (!row) return true;
    return row.next_retry <= Date.now();
  }

  private recordMediaBackfillFailure(channel: string, messageId: string, mediaKey: string): void {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT fail_count FROM media_backoff WHERE channel = ? AND message_id = ? AND media_key = ? LIMIT 1",
        channel,
        messageId,
        mediaKey,
      )
      .toArray() as Array<{ fail_count: number }>;
    const row = rows[0] ?? null;
    const failCount = (row?.fail_count ?? 0) + 1;
    const multiplier = Math.pow(2, Math.max(0, failCount - 1));
    const delayMs = Math.min(MEDIA_BACKFILL_MAX_RETRY_MS, MEDIA_BACKFILL_BASE_RETRY_MS * multiplier);
    const now = Date.now();
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO media_backoff (channel, message_id, media_key, fail_count, next_retry, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      channel,
      messageId,
      mediaKey,
      failCount,
      now + delayMs,
      now,
    );
  }

  private clearMediaBackfillFailure(channel: string, messageId: string, mediaKey: string): void {
    this.ctx.storage.sql.exec(
      "DELETE FROM media_backoff WHERE channel = ? AND message_id = ? AND media_key = ?",
      channel,
      messageId,
      mediaKey,
    );
  }

  private async backfillExternalMediaInChannels(
    channels: ChannelState[],
  ): Promise<{
    scanned: number;
    attempted: number;
    recovered: number;
    failed: number;
    records: PersistMessageRecord[];
  }> {
    const jobs: Array<{
      channelIndex: number;
      messageIndex: number;
      mediaIndex: number;
      messageId: string;
      mediaKey: string;
      item: StoredMessage["media"][number];
      channel: ChannelState;
      message: StoredMessage;
    }> = [];
    let scanned = 0;

    outer: for (let ci = 0; ci < channels.length; ci++) {
      const channel = channels[ci];
      for (let mi = 0; mi < channel.messages.length; mi++) {
        const message = channel.messages[mi];
        if (!this.hasExternalMediaReference(message.media)) {
          continue;
        }
        const messageId = this.extractMessageIdFromLink(message.link);
        for (let mediaIdx = 0; mediaIdx < message.media.length; mediaIdx++) {
          scanned++;
          const item = message.media[mediaIdx];
          if (!item.url.startsWith("http")) {
            continue;
          }
          const mediaKey = `${mediaIdx}`;
          if (!this.shouldAttemptMediaBackfill(channel.username, messageId, mediaKey)) {
            continue;
          }
          jobs.push({
            channelIndex: ci,
            messageIndex: mi,
            mediaIndex: mediaIdx,
            messageId,
            mediaKey,
            item,
            channel,
            message,
          });
          if (jobs.length >= MAX_MEDIA_BACKFILL_JOBS_PER_CYCLE) {
            break outer;
          }
        }
      }
    }

    if (jobs.length === 0) {
      return {
        scanned,
        attempted: 0,
        recovered: 0,
        failed: 0,
        records: [],
      };
    }

    let recovered = 0;
    let failed = 0;
    const changedMessageKeys = new Set<string>();

    await mapWithConcurrency(jobs, Math.max(1, Math.min(MEDIA_CONCURRENCY, 10)), async (job) => {
      try {
        const processed = await this.processOneMedia(
          job.item,
          job.channel.username,
          job.messageId,
          job.mediaIndex,
        );
        if (processed.url.startsWith("http")) {
          this.recordMediaBackfillFailure(job.channel.username, job.messageId, job.mediaKey);
          failed++;
          return;
        }
        const existing = channels[job.channelIndex]?.messages[job.messageIndex];
        if (!existing) {
          return;
        }
        existing.media[job.mediaIndex] = processed;
        this.clearMediaBackfillFailure(job.channel.username, job.messageId, job.mediaKey);
        changedMessageKeys.add(`${job.channelIndex}:${job.messageIndex}`);
        recovered++;
      } catch {
        this.recordMediaBackfillFailure(job.channel.username, job.messageId, job.mediaKey);
        failed++;
      }
    });

    const records: PersistMessageRecord[] = [];
    for (const key of changedMessageKeys) {
      const [chIdxRaw, msgIdxRaw] = key.split(":");
      const chIdx = Number.parseInt(chIdxRaw, 10);
      const msgIdx = Number.parseInt(msgIdxRaw, 10);
      if (!Number.isFinite(chIdx) || !Number.isFinite(msgIdx)) {
        continue;
      }
      const channel = channels[chIdx];
      const message = channel?.messages[msgIdx];
      if (!channel || !message) continue;
      records.push({
        source: "media_backfill",
        channel: channel.username,
        label: channel.label,
        category: channel.category,
        messageId: this.extractMessageIdFromLink(message.link),
        link: message.link,
        datetime: message.datetime,
        views: message.views,
        textOriginal: message.text_original,
        textEn: message.text_en,
        imageTextEn: message.image_text_en,
        language: message.language,
        hasVideo: message.has_video,
        hasPhoto: message.has_photo,
        media: message.media,
      });
    }

    return {
      scanned,
      attempted: jobs.length,
      recovered,
      failed,
      records,
    };
  }

  private normalizeForCache(value: string, maxChars: number): string {
    return value.replace(/\s+/g, " ").trim().toLowerCase().slice(0, maxChars);
  }

  private buildTextTranslationCacheKey(text: string, languageHint: string): string {
    const normalizedText = this.normalizeForCache(text, 2500);
    const normalizedHint = this.normalizeForCache(languageHint || "unknown", 32);
    const payload = `text|${GROQ_MODEL}|${normalizedHint}|${normalizedText}`;
    return `v1:${payload.length}:${this.hashText(payload)}:${payload.slice(0, 64)}`;
  }

  private buildImageTranslationCacheKey(imageUrl: string, contextText?: string): string {
    const normalizedUrl = imageUrl.trim();
    const normalizedContext = this.normalizeForCache(contextText || "", 240);
    const payload = `image|${GROQ_MODEL}|${normalizedUrl}|${normalizedContext}`;
    return `v1:${payload.length}:${this.hashText(payload)}:${payload.slice(0, 64)}`;
  }

  private getCachedTranslation(kind: "text" | "image", cacheKey: string): string | null {
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT value, updated_at FROM translation_cache WHERE cache_key = ? AND kind = ? LIMIT 1",
        cacheKey,
        kind,
      )
      .toArray() as Array<{ value: string; updated_at: number }>;
    const row = rows[0] ?? null;
    if (!row) return null;
    const ttl = kind === "image" ? IMAGE_TRANSLATION_CACHE_TTL_MS : TEXT_TRANSLATION_CACHE_TTL_MS;
    if (Date.now() - row.updated_at > ttl) {
      this.ctx.storage.sql.exec(
        "DELETE FROM translation_cache WHERE cache_key = ? AND kind = ?",
        cacheKey,
        kind,
      );
      return null;
    }
    return row.value;
  }

  private setCachedTranslation(kind: "text" | "image", cacheKey: string, value: string): void {
    const normalized = (value || "").trim();
    const persistValue =
      kind === "image" ? (normalized || IMAGE_TRANSLATION_CACHE_EMPTY_SENTINEL) : normalized;
    if (!persistValue) return;
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO translation_cache (cache_key, kind, value, updated_at) VALUES (?, ?, ?, ?)",
      cacheKey,
      kind,
      persistValue,
      Date.now(),
    );
  }

  // ==========================================================================
  // Persistence (R2 archive + D1 query store)
  // ==========================================================================

  private buildArchiveKey(
    type: "state" | "delta",
    createdAtIso: string,
    cycleId: string,
  ): string {
    const [datePart, timePartRaw] = createdAtIso.split("T");
    const [year = "0000", month = "00", day = "00"] = datePart.split("-");
    const hour = (timePartRaw || "00").slice(0, 2);
    const safeTs = createdAtIso.replace(/[:.]/g, "-");
    return `telegram/${type}/year=${year}/month=${month}/day=${day}/hour=${hour}/${safeTs}_${cycleId}.json`;
  }

  private async archiveCycle(
    createdAtIso: string,
    cycleId: string,
    stateJson: string,
    deltaJson: string,
    includeStateSnapshot: boolean,
  ): Promise<{ stateKey: string | null; deltaKey: string | null }> {
    if (!this.env.ARCHIVE_BUCKET) {
      return { stateKey: null, deltaKey: null };
    }

    let stateKey: string | null = null;
    let deltaKey: string | null = null;
    const archiveWrites: Promise<unknown>[] = [];

    if (includeStateSnapshot) {
      stateKey = this.buildArchiveKey("state", createdAtIso, cycleId);
      archiveWrites.push(
        this.env.ARCHIVE_BUCKET.put(stateKey, stateJson, {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        }),
      );
    }

    deltaKey = this.buildArchiveKey("delta", createdAtIso, cycleId);
    archiveWrites.push(
      this.env.ARCHIVE_BUCKET.put(deltaKey, deltaJson, {
        httpMetadata: { contentType: "application/json; charset=utf-8" },
      }),
    );

    const settled = await Promise.allSettled(archiveWrites);
    for (const result of settled) {
      if (result.status === "rejected") {
        console.error(
          "[TelegramScraper] Archive write failed:",
          result.reason instanceof Error ? result.reason.message : result.reason,
        );
      }
    }
    return { stateKey, deltaKey };
  }

  private async persistCycleToD1(input: {
    cycleId: string;
    createdAt: string;
    rotationSlot: number;
    rotationSlots: number;
    cycleChannels: number;
    channelsFetched: number;
    totalChannels: number;
    totalMessages: number;
    newMessages: number;
    backfilledMessages: number;
    translatedMessages: number;
    failedTranslations: number;
    translationEngine: string;
    stateKey: string | null;
    deltaKey: string | null;
    scrapeElapsedMs: number;
    messageRecords: PersistMessageRecord[];
    canonicalEvents: TelegramCanonicalEvent[];
  }): Promise<void> {
    if (!this.env.INTEL_DB) {
      return;
    }

    await this.ensureD1Schema();
    const db = this.env.INTEL_DB;
    await db
      .prepare(
        `INSERT OR REPLACE INTO telegram_cycles (
          cycle_id, timestamp, rotation_slot, rotation_slots, cycle_channels,
          channels_fetched, total_channels, total_messages, new_messages,
          backfilled_messages, translated_messages, failed_translations,
          translation_engine, state_r2_key, delta_r2_key, scrape_elapsed_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        input.cycleId,
        input.createdAt,
        input.rotationSlot,
        input.rotationSlots,
        input.cycleChannels,
        input.channelsFetched,
        input.totalChannels,
        input.totalMessages,
        input.newMessages,
        input.backfilledMessages,
        input.translatedMessages,
        input.failedTranslations,
        input.translationEngine,
        input.stateKey,
        input.deltaKey,
        input.scrapeElapsedMs,
        input.createdAt,
      )
      .run();

    if (input.messageRecords.length === 0) {
      return;
    }

    const messageStatements = input.messageRecords.map((record) =>
      db
        .prepare(
          `INSERT INTO telegram_cycle_messages (
            channel_username, message_id, source, label, category,
            message_link, datetime, text_original, text_en, image_text_en, views, language,
            has_video, has_photo, media_json, first_seen_cycle_id, updated_cycle_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(channel_username, message_id) DO UPDATE SET
            source = excluded.source,
            label = excluded.label,
            category = excluded.category,
            message_link = excluded.message_link,
            datetime = excluded.datetime,
            text_original = excluded.text_original,
            text_en = excluded.text_en,
            image_text_en = excluded.image_text_en,
            views = excluded.views,
            language = excluded.language,
            has_video = excluded.has_video,
            has_photo = excluded.has_photo,
            media_json = excluded.media_json,
            updated_cycle_id = excluded.updated_cycle_id,
            updated_at = excluded.updated_at`,
        )
        .bind(
          record.channel,
          record.messageId,
          record.source,
          record.label,
          record.category,
          record.link,
          record.datetime || null,
          record.textOriginal,
          record.textEn,
          record.imageTextEn || null,
          record.views || null,
          record.language || null,
          record.hasVideo ? 1 : 0,
          record.hasPhoto ? 1 : 0,
          JSON.stringify(record.media),
          input.cycleId,
          input.cycleId,
          input.createdAt,
        ),
    );

    const chunkSize = 100;
    for (let i = 0; i < messageStatements.length; i += chunkSize) {
      const chunk = messageStatements.slice(i, i + chunkSize);
      await db.batch(chunk);
    }

    if (input.canonicalEvents.length > 0) {
      const canonicalStatements = input.canonicalEvents.map((event) =>
        db
          .prepare(
            `INSERT OR REPLACE INTO telegram_canonical_events (
              event_id, event_key, datetime, category, categories_json,
              source_count, duplicate_count, source_labels_json, source_channels_json,
              text_original, text_en, image_text_en, language, media_json, has_video, has_photo,
              signal_profile_id, signal_score, signal_grade, signal_reasons_json, cycle_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            event.event_id,
            event.event_key,
            event.datetime,
            event.category,
            JSON.stringify(event.categories),
            event.source_count,
            event.duplicate_count,
            JSON.stringify(event.source_labels),
            JSON.stringify(event.source_channels),
            event.text_original,
            event.text_en,
            event.image_text_en || null,
            event.language || null,
            JSON.stringify(event.media),
            event.has_video ? 1 : 0,
            event.has_photo ? 1 : 0,
            event.signal_profile_id ?? null,
            typeof event.signal_score === "number" ? event.signal_score : null,
            event.signal_grade ?? null,
            JSON.stringify(event.signal_reasons ?? []),
            input.cycleId,
            input.createdAt,
          ),
      );

      for (let i = 0; i < canonicalStatements.length; i += chunkSize) {
        const chunk = canonicalStatements.slice(i, i + chunkSize);
        await db.batch(chunk);
      }

      const sourceStatements = input.canonicalEvents.flatMap((event) =>
        event.sources.map((source) =>
          db
            .prepare(
              `INSERT OR REPLACE INTO telegram_canonical_event_sources (
                event_id, signature, channel, label, category, message_id, message_link, datetime, views, cycle_id, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              event.event_id,
              source.signature,
              source.channel,
              source.label,
              source.category,
              source.message_id,
              source.link,
              source.datetime || null,
              source.views || null,
              input.cycleId,
              input.createdAt,
            ),
        ),
      );

      for (let i = 0; i < sourceStatements.length; i += chunkSize) {
        const chunk = sourceStatements.slice(i, i + chunkSize);
        await db.batch(chunk);
      }
    }
  }

  // ==========================================================================
  // Media processing — download from Telegram CDN, upload to R2
  // ==========================================================================

  private async processMediaBatch(
    media: AnyMediaItem[],
    channel: string,
    postId: string,
  ): Promise<StoredMessage["media"]> {
    if (!media.length) return [];

    const msgNum = postId.split("/").pop() || "unknown";
    const processed: StoredMessage["media"] = [];

    // Process in small batches to control concurrency
    for (let i = 0; i < media.length; i += MEDIA_BATCH_SIZE) {
      const batch = media.slice(i, i + MEDIA_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((item, j) =>
          this.processOneMedia(item, channel, msgNum, i + j),
        ),
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          processed.push(
            (results[j] as PromiseFulfilledResult<StoredMessage["media"][0]>)
              .value,
          );
        } else {
          // Keep original on failure
          processed.push(batch[j]);
        }
      }
    }

    return processed;
  }

  private async processOneMedia(
    item: AnyMediaItem,
    channel: string,
    msgNum: string,
    mediaIdx: number,
  ): Promise<StoredMessage["media"][0]> {
    if (!item.url.startsWith("http")) return item;

    const isVideo = item.type === "video";
    const maxBytes = isVideo ? R2_MAX_VIDEO_BYTES : R2_MAX_PHOTO_BYTES;
    const legacyKey = `${channel}/${msgNum}_${mediaIdx}.${isVideo ? "mp4" : "jpg"}`;

    // Check if already in R2 (skip re-upload)
    const existing = await this.env.MEDIA_BUCKET.head(legacyKey);
    if (existing) {
      return { ...item, url: legacyKey };
    }

    // Download from Telegram CDN
    const dlRes = await fetch(item.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!dlRes.ok) return item;

    const data = await dlRes.arrayBuffer();
    if (data.byteLength > maxBytes) {
      debugRuntimeLog(this.runtimeEnv, 
        `[TelegramScraper] Media too large (${(data.byteLength / 1024 / 1024).toFixed(1)}MB), skipping R2: ${legacyKey}`,
      );
      return item;
    }

    const resolved = resolveContentTypeAndExt({
      sourceUrl: item.url,
      responseContentType: dlRes.headers.get("content-type"),
      isVideo,
    });
    const r2Key = `${channel}/${msgNum}_${mediaIdx}.${resolved.ext}`;
    if (r2Key !== legacyKey) {
      const existingResolved = await this.env.MEDIA_BUCKET.head(r2Key);
      if (existingResolved) {
        return { ...item, url: r2Key };
      }
    }

    // Upload to R2
    await this.env.MEDIA_BUCKET.put(r2Key, data, {
      httpMetadata: { contentType: resolved.contentType },
    });

    const result: StoredMessage["media"][0] = { ...item, url: r2Key };

    // Upload video thumbnail if present
    if (item.thumbnail?.startsWith("http")) {
      const thumbKey = `${channel}/${msgNum}_${mediaIdx}_thumb.jpg`;
      try {
        const thumbRes = await fetch(item.thumbnail, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(10_000),
        });
        if (thumbRes.ok) {
          const thumbData = await thumbRes.arrayBuffer();
          if (thumbData.byteLength <= R2_MAX_PHOTO_BYTES) {
            await this.env.MEDIA_BUCKET.put(thumbKey, thumbData, {
              httpMetadata: { contentType: "image/jpeg" },
            });
            result.thumbnail = thumbKey;
          }
        }
      } catch {
        // Keep original thumbnail URL on failure
      }
    }

    return result;
  }

  // ==========================================================================
  // KV state
  // ==========================================================================

  private async loadPreviousState(): Promise<TelegramState | null> {
    try {
      const localRaw = await this.ctx.storage.get<string>(LATEST_TELEGRAM_STATE_DO_KEY);
      if (typeof localRaw === "string" && localRaw.trim().length > 0) {
        return JSON.parse(localRaw) as TelegramState;
      }
    } catch {
      // Fallback to KV on local storage parse errors.
    }

    try {
      const raw = await this.env.TELEGRAM_STATE.get(LATEST_TELEGRAM_STATE_KV_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as TelegramState;
      // Prime local canonical storage from KV once.
      if (raw.length <= 900_000) {
        try {
          await this.ctx.storage.put(LATEST_TELEGRAM_STATE_DO_KEY, raw);
        } catch {
          // Ignore local cache write failures (for example SQLITE_TOOBIG); KV copy is authoritative.
        }
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
