import { DurableObject } from "cloudflare:workers";
import { resolveBackendEndpointUrl, usesBackendServiceBinding } from "./backend-origin";
import { enforceIntelAdminGuard, enforceWebhookDedupe } from "./intel-cache-guards";
import {
  buildChatHistoryCacheKeyFromLimits,
  collectPersistedChatHistoryEndpoints,
} from "./intel-cache-chat-history";
import {
  buildCacheBustRefreshEndpoints,
  isCurrentCacheGeneration,
} from "./intel-cache-refresh";
import { jsonResponse } from "./json-response";
import { debugRuntimeLog } from "./runtime-log";
import { chunkEntries, collectStaleChunkKeys, MAX_DO_STORAGE_BATCH_ENTRIES } from "./storage-batches";
import { normalizeNumber, normalizeString } from "./value-normalization";
import { buildWhalesUnavailableResponse } from "./whales-unavailable-response";

interface Env extends Cloudflare.Env {
  BACKEND_URL?: string;
  ALLOW_BACKEND_URL_FALLBACK?: string;
  USAGE_DATA_SOURCE_TOKEN?: string;
  INTEL_API_TOKEN?: string;
  WHALE_ALERT_API_KEY?: string;
  DEBUG_RUNTIME_LOGS?: string;
}

interface CachedResponse {
  data: string;
  timestamp: number;
  status: number;
}

type WhaleAlertApiTransaction = {
  hash?: unknown;
  blockchain?: unknown;
  amount?: unknown;
  amount_usd?: unknown;
  timestamp?: unknown;
  from?: {
    owner_type?: unknown;
    address?: unknown;
  } | null;
  to?: {
    address?: unknown;
  } | null;
};

const REFRESH_INTERVAL_MS = 10_000; // 10 seconds
const FETCH_TIMEOUT_MS = 45_000; // 45s timeout for backend
const ENDPOINTS = ["/api/intel", "/api/briefings", "/api/air-sea"];
const ENDPOINT_PROACTIVE_REFRESH_MS: Partial<Record<string, number>> = {
  "/api/intel": 10_000,
  "/api/briefings": 60_000,
};
const ENDPOINT_MAX_AGE_MS: Record<string, number> = {
  "/api/intel": 12_000,
  "/api/briefings": 90_000,
  "/api/air-sea": 25_000,
};
const ENDPOINT_STALE_WINDOW_MS: Record<string, number> = {
  "/api/intel": 2 * 60_000,
  "/api/briefings": 45 * 60_000,
  "/api/air-sea": 5 * 60_000,
};
const BACKGROUND_REFRESH_COOLDOWN_MS = 5_000;
const STORAGE_CHUNK_SIZE = 60_000; // Safe length under 128KB UTF-8 DO limit
const WHALE_CACHE_KEY = "cache:/api/whales";
const WHALE_REFRESH_MS = 5 * 60 * 1000; // 5 minutes
const WHALE_STALE_WINDOW_MS = 30 * 60_000;
const CHAT_HISTORY_PATH = "/api/chat-history";
const CHAT_HISTORY_REFRESH_MS = 90 * 1000;
const CHAT_HISTORY_STALE_WINDOW_MS = 10 * 60_000;
const CHAT_DEFAULT_SESSION_LIMIT = 6;
const CHAT_MAX_SESSION_LIMIT = 20;
const CHAT_DEFAULT_MESSAGE_LIMIT = 25;
const CHAT_MAX_MESSAGE_LIMIT = 80;
const ADMIN_NONCE_TTL_SECONDS = 10 * 60;
const ADMIN_RATE_WINDOW_MS = 60_000;
const ADMIN_RATE_LIMIT_PER_WINDOW = 8;
const WEBHOOK_EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;

function normalizeWhaleAlertApiKey(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export class IntelCacheDO extends DurableObject<Env> {
  private cache: Map<string, CachedResponse> = new Map();
  private refreshing = false;
  private inFlightFetches: Map<string, Promise<CachedResponse | null>> = new Map();
  private backgroundRefreshAfter: Map<string, number> = new Map();
  private cacheGeneration = 0;
  private readonly runtimeEnv: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.runtimeEnv = env;

    this.ctx.blockConcurrencyWhile(async () => {
      const defaultChatHistoryEndpoint = buildChatHistoryCacheKeyFromLimits(
        CHAT_DEFAULT_SESSION_LIMIT,
        CHAT_DEFAULT_MESSAGE_LIMIT,
      );
      // Load all endpoints from storage IN PARALLEL to minimize blockConcurrencyWhile time
      // (blockConcurrencyWhile has a 30s timeout — sequential loads risk hitting it)
      const allEndpoints = [
        ...ENDPOINTS,
        "/api/whales",
        defaultChatHistoryEndpoint,
      ];
      const results = await Promise.allSettled(
        allEndpoints.map((ep) => this.loadChunked(ep)),
      );
      for (let i = 0; i < allEndpoints.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
          this.cache.set(allEndpoints[i], result.value);
        }
      }

      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm || currentAlarm > Date.now() + REFRESH_INTERVAL_MS * 2) {
        await this.ctx.storage.setAlarm(Date.now() + 5_000);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/admin/guard") {
      return this.handleAdminGuard(request);
    }

    if (path === "/api/webhook/dedupe") {
      return this.handleWebhookDedupe(request);
    }

    // Force cache bust — wipe all cached data and refresh immediately
    if (path === "/api/cache-bust") {
      return this.ctx.blockConcurrencyWhile(async () => {
        debugRuntimeLog(this.runtimeEnv, "[IntelCacheDO] Cache bust requested — wiping all cached data");
        this.cacheGeneration += 1;
        this.cache.clear();
        this.inFlightFetches.clear();
        this.backgroundRefreshAfter.clear();

        const deletedChatHistoryEndpoints = await this.clearChatHistoryCacheVariants();
        for (const endpoint of ENDPOINTS) {
          await this.deleteChunked(endpoint);
        }
        await this.deleteChunked("/api/whales");

        const errors: string[] = [];
        const refreshTargets = buildCacheBustRefreshEndpoints(ENDPOINTS, deletedChatHistoryEndpoints);
        for (const endpoint of refreshTargets) {
          try {
            if (endpoint === "/api/whales") {
              await this.fetchWhalesDedup();
            } else {
              await this.fetchEndpointDedup(endpoint, 0);
            }
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err);
            errors.push(`${endpoint}: ${detail}`);
          }
        }

        const cacheInfo: Record<string, unknown> = {};
        for (const [k, v] of this.cache.entries()) {
          cacheInfo[k] = {
            timestamp: new Date(v.timestamp).toISOString(),
            sizeBytes: v.data.length,
            status: v.status,
          };
        }

        return jsonResponse({
          status: "cache_busted",
          refreshed: cacheInfo,
          errors: errors.length ? errors : undefined,
          cacheKeys: [...this.cache.keys()],
        });
      });
    }

    // Health / status endpoint
    if (path === "/api/health") {
      // Ensure alarm is running
      const currentAlarm = await this.ctx.storage.getAlarm();
      if (!currentAlarm) {
        await this.ctx.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
      }

      const cacheInfo: Record<string, unknown> = {};
      for (const [k, v] of this.cache.entries()) {
        cacheInfo[k] = {
          timestamp: new Date(v.timestamp).toISOString(),
          ageSeconds: Math.round((Date.now() - v.timestamp) / 1000),
          sizeBytes: v.data.length,
          status: v.status,
        };
      }

      return jsonResponse({
        status: "ok",
        cached: cacheInfo,
        nextAlarm: currentAlarm
          ? new Date(currentAlarm).toISOString()
          : null,
        refreshing: this.refreshing,
      });
    }

    if (path === "/api/whales") {
      return this.handleWhales();
    }

    if (path === CHAT_HISTORY_PATH) {
      return this.handleChatHistory(url);
    }

    if (ENDPOINTS.includes(path)) {
      const cached = this.cache.get(path);
      const maxAgeMs = ENDPOINT_MAX_AGE_MS[path] ?? REFRESH_INTERVAL_MS;
      const staleWindowMs = ENDPOINT_STALE_WINDOW_MS[path] ?? maxAgeMs * 8;

      if (cached) {
        const ageMs = Date.now() - cached.timestamp;
        if (ageMs < maxAgeMs) {
          return this.cachedJsonResponse(cached, "durable-object-memory", ageMs);
        }

        if (ageMs < staleWindowMs) {
          this.scheduleBackgroundRefresh(path);
          return this.cachedJsonResponse(cached, "durable-object-stale-revalidate", ageMs);
        }
      }

      const fresh = await this.fetchEndpointDedup(path);
      if (fresh) {
        return this.cachedJsonResponse(fresh, "durable-object-fresh");
      }

      if (cached) {
        return this.cachedJsonResponse(cached, "durable-object-stale-if-error", Date.now() - cached.timestamp);
      }

      return jsonResponse(
        { error: "Data not yet available. First refresh in progress." },
        { status: 503 },
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  private cachedJsonResponse(
    cached: CachedResponse,
    cacheSource: string,
    ageMs?: number,
    statusOverride?: number,
  ): Response {
    const headers = new Headers({
      "Content-Type": "application/json",
      "X-Cache-Source": cacheSource,
    });
    if (typeof ageMs === "number" && Number.isFinite(ageMs)) {
      headers.set("X-Cache-Age", String(Math.round(ageMs / 1000)));
    }
    return new Response(cached.data, {
      status: statusOverride ?? cached.status,
      headers,
    });
  }

  private async handleAdminGuard(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, reason: "method_not_allowed" }, { status: 405 });
    }

    let payload: {
      scope?: unknown;
      nonce?: unknown;
      timestampMs?: unknown;
      clientIp?: unknown;
    };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return jsonResponse({ ok: false, reason: "invalid_json" }, { status: 400 });
    }

    const scope = typeof payload.scope === "string" ? payload.scope.trim() : "";
    const nonce = typeof payload.nonce === "string" ? payload.nonce.trim() : "";
    const timestampMs = typeof payload.timestampMs === "number" ? payload.timestampMs : Number.NaN;
    const clientIp = typeof payload.clientIp === "string" ? payload.clientIp.trim() : "unknown";

    if (!scope || !nonce || !Number.isFinite(timestampMs)) {
      return jsonResponse({ ok: false, reason: "invalid_payload" }, { status: 400 });
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const result = await enforceIntelAdminGuard({
        storage: this.ctx.storage,
        scope,
        nonce,
        timestampMs,
        clientIp,
        nonceTtlMs: ADMIN_NONCE_TTL_SECONDS * 1000,
        rateWindowMs: ADMIN_RATE_WINDOW_MS,
        rateLimitPerWindow: ADMIN_RATE_LIMIT_PER_WINDOW,
        maxSkewMs: 5 * 60 * 1000,
      });
      return result.ok
        ? jsonResponse({ ok: true }, { status: 200 })
        : jsonResponse(result, { status: result.status });
    });
  }

  private async handleWebhookDedupe(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return jsonResponse({ ok: false, reason: "method_not_allowed" }, { status: 405 });
    }

    let payload: { provider?: unknown; eventId?: unknown };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return jsonResponse({ ok: false, reason: "invalid_json" }, { status: 400 });
    }

    const provider = typeof payload.provider === "string" ? payload.provider : "";
    const eventId = typeof payload.eventId === "string" ? payload.eventId : "";

    return this.ctx.blockConcurrencyWhile(async () => {
      const result = await enforceWebhookDedupe({
        storage: this.ctx.storage,
        provider,
        eventId,
        eventTtlMs: WEBHOOK_EVENT_TTL_SECONDS * 1000,
      });
      return result.ok
        ? jsonResponse(result, { status: 200 })
        : jsonResponse(result, { status: result.status });
    });
  }

  async alarm(): Promise<void> {
    debugRuntimeLog(this.runtimeEnv, "[IntelCacheDO] Alarm fired — proactively refreshing all endpoints");
    await this.refreshAll();

    // Schedule next alarm
    await this.ctx.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
  }

  private async refreshAll(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      const now = Date.now();
      const endpointsToRefresh = ENDPOINTS.filter((endpoint) => {
        const cadence = ENDPOINT_PROACTIVE_REFRESH_MS[endpoint];
        if (!cadence) return false;
        const cached = this.cache.get(endpoint);
        if (!cached) return true;
        return now - cached.timestamp >= cadence;
      });

      if (endpointsToRefresh.length === 0) {
        return;
      }

      // Fetch eligible endpoints in parallel
      const results = await Promise.allSettled(
        endpointsToRefresh.map((endpoint) => this.fetchEndpointDedup(endpoint)),
      );

      const success = results.filter(
        (r) => r.status === "fulfilled" && r.value !== null,
      ).length;
      debugRuntimeLog(this.runtimeEnv, 
        `[IntelCacheDO] Refreshed ${success}/${endpointsToRefresh.length} endpoints`,
      );

    } finally {
      this.refreshing = false;
    }
  }

  private async handleWhales(): Promise<Response> {
    const cached = this.cache.get("/api/whales");
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < WHALE_REFRESH_MS) {
        return this.cachedJsonResponse(cached, "durable-object-memory", ageMs, 200);
      }

      if (ageMs < WHALE_STALE_WINDOW_MS) {
        this.scheduleBackgroundRefresh("/api/whales-freshen");
        return this.cachedJsonResponse(cached, "durable-object-stale-revalidate", ageMs, 200);
      }
    }

    const fresh = await this.fetchWhalesDedup();
    if (fresh) {
      return this.cachedJsonResponse(fresh, "durable-object-fresh");
    }

    if (cached) {
      return this.cachedJsonResponse(cached, "durable-object-stale-if-error", Date.now() - cached.timestamp, 200);
    }

    return buildWhalesUnavailableResponse();
  }

  private clampPositiveInt(raw: string | null, fallback: number, max: number): number {
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
  }

  private buildChatHistoryCacheKey(url: URL): string {
    const sessions = this.clampPositiveInt(
      url.searchParams.get("sessions"),
      CHAT_DEFAULT_SESSION_LIMIT,
      CHAT_MAX_SESSION_LIMIT,
    );
    const messages = this.clampPositiveInt(
      url.searchParams.get("messages"),
      CHAT_DEFAULT_MESSAGE_LIMIT,
      CHAT_MAX_MESSAGE_LIMIT,
    );
    return buildChatHistoryCacheKeyFromLimits(sessions, messages);
  }

  private async clearChatHistoryCacheVariants(): Promise<string[]> {
    const keysToDelete = new Set<string>();

    for (const key of this.cache.keys()) {
      if (key.startsWith(CHAT_HISTORY_PATH)) {
        keysToDelete.add(key);
      }
    }

    const storagePrefix = `cache:${CHAT_HISTORY_PATH}`;
    const stored = await this.ctx.storage.list({ prefix: storagePrefix });
    for (const endpoint of collectPersistedChatHistoryEndpoints(stored.keys())) {
      keysToDelete.add(endpoint);
    }

    for (const endpoint of keysToDelete) {
      this.cache.delete(endpoint);
      await this.deleteChunked(endpoint);
    }
    return [...keysToDelete];
  }

  private async handleChatHistory(url: URL): Promise<Response> {
    const cacheKey = this.buildChatHistoryCacheKey(url);
    let cached = this.cache.get(cacheKey);
    if (!cached) {
      const persisted = await this.loadChunked(cacheKey);
      if (persisted) {
        this.cache.set(cacheKey, persisted);
        cached = persisted;
      }
    }
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < CHAT_HISTORY_REFRESH_MS) {
        return this.cachedJsonResponse(cached, "durable-object-memory", ageMs);
      }

      if (ageMs < CHAT_HISTORY_STALE_WINDOW_MS) {
        this.scheduleBackgroundRefresh(cacheKey, 0);
        return this.cachedJsonResponse(cached, "durable-object-stale-revalidate", ageMs);
      }
    }

    const fresh = await this.fetchEndpointDedup(cacheKey, 0);
    if (fresh) {
      return this.cachedJsonResponse(fresh, "durable-object-fresh");
    }

    if (cached) {
      return this.cachedJsonResponse(cached, "durable-object-stale-if-error", Date.now() - cached.timestamp);
    }

    return jsonResponse({ error: "Chat history unavailable" }, { status: 503 });
  }

  private async fetchEndpoint(
    endpoint: string,
    retries = 1,
  ): Promise<CachedResponse | null> {
    const generationAtStart = this.cacheGeneration;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const backendRequest = this.buildBackendRequest(endpoint);
        if (!backendRequest) {
          return null;
        }
        const backendUrl = backendRequest.url;
        if (attempt === 0) {
          debugRuntimeLog(this.runtimeEnv, `[IntelCacheDO] Fetching ${backendUrl}`);
        } else {
          debugRuntimeLog(this.runtimeEnv, `[IntelCacheDO] Retry ${attempt} for ${backendUrl}`);
        }

        const res = usesBackendServiceBinding(this.env)
          ? await this.env.INTEL_BACKEND.fetch(backendRequest)
          : await fetch(backendRequest);

        if (!res.ok) {
          console.error(
            `[IntelCacheDO] Backend returned ${res.status} for ${endpoint}`,
          );
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          return null;
        }

        const data = await res.text();
        const cached: CachedResponse = {
          data,
          timestamp: Date.now(),
          status: res.status,
        };

        if (!isCurrentCacheGeneration(generationAtStart, this.cacheGeneration)) {
          return null;
        }
        this.cache.set(endpoint, cached);
        await this.saveChunked(endpoint, cached);

        debugRuntimeLog(this.runtimeEnv, 
          `[IntelCacheDO] Cached ${endpoint} (${(data.length / 1024).toFixed(1)} KB)`,
        );
        return cached;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[IntelCacheDO] Fetch failed for ${endpoint} (attempt ${attempt}):`, msg);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        return null;
      }
    }
    return null;
  }

  private buildBackendRequest(endpoint: string): Request | null {
    const backendToken = (this.env.USAGE_DATA_SOURCE_TOKEN || this.env.INTEL_API_TOKEN || "").trim();
    const headers: Record<string, string> = {
      "User-Agent": "Intel Dashboard-DO/1.0",
      "X-Intel-Internal-Feed": "1",
    };
    if (backendToken) {
      headers.Authorization = `Bearer ${backendToken}`;
    }
    const init: RequestInit = {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    };

    try {
      return new Request(resolveBackendEndpointUrl(this.env, endpoint), init);
    } catch (error) {
      console.error(
        `[IntelCacheDO] Backend binding resolution failed for ${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private fetchEndpointDedup(endpoint: string, retries = 1): Promise<CachedResponse | null> {
    const existing = this.inFlightFetches.get(endpoint);
    if (existing) return existing;

    let pending: Promise<CachedResponse | null>;
    pending = this.fetchEndpoint(endpoint, retries).finally(() => {
      if (this.inFlightFetches.get(endpoint) === pending) {
        this.inFlightFetches.delete(endpoint);
      }
    });

    this.inFlightFetches.set(endpoint, pending);
    return pending;
  }

  private scheduleBackgroundRefresh(endpoint: string, retries = 1): void {
    const now = Date.now();
    const allowedAt = this.backgroundRefreshAfter.get(endpoint) ?? 0;
    if (now < allowedAt) return;

    this.backgroundRefreshAfter.set(endpoint, now + BACKGROUND_REFRESH_COOLDOWN_MS);

    if (endpoint === "/api/whales-freshen") {
      void this.fetchWhalesDedup();
      return;
    }

    void this.fetchEndpointDedup(endpoint, retries);
  }

  private async fetchWhales(): Promise<CachedResponse | null> {
    const generationAtStart = this.cacheGeneration;
    const apiKey = normalizeWhaleAlertApiKey(this.env.WHALE_ALERT_API_KEY);
    if (!apiKey) {
      return this.cache.get("/api/whales") ?? null;
    }

    try {
      const res = await fetch(
        "https://api.whale-alert.io/v1/transactions?min_value=1000000&limit=25",
        {
          headers: { "Api-Key": apiKey },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json() as { transactions?: WhaleAlertApiTransaction[] };
      const alerts = (Array.isArray(data.transactions) ? data.transactions : []).map((tx) => {
        const fromOwnerType = normalizeString(tx.from?.owner_type) ?? "";
        const hash = normalizeString(tx.hash) ?? crypto.randomUUID();
        return {
          id: hash,
          type: fromOwnerType === "exchange" ? "exchange_flow" : "large_transfer",
          blockchain: normalizeString(tx.blockchain) ?? "unknown",
          amount: normalizeNumber(tx.amount) ?? 0,
          amountUSD: normalizeNumber(tx.amount_usd) ?? 0,
          from: normalizeString(tx.from?.address) ?? "unknown",
          to: normalizeString(tx.to?.address) ?? "unknown",
          timestamp: normalizeNumber(tx.timestamp) ?? 0,
          txHash: hash,
        };
      });

      const entry: CachedResponse = {
        data: JSON.stringify(alerts.slice(0, 10)),
        timestamp: Date.now(),
        status: 200,
      };
      if (!isCurrentCacheGeneration(generationAtStart, this.cacheGeneration)) {
        return null;
      }
      this.cache.set("/api/whales", entry);
      await this.ctx.storage.put(WHALE_CACHE_KEY, entry);
      return entry;
    } catch (err) {
      console.error("[IntelCacheDO] WhaleAlert fetch failed:", err);
      return null;
    }
  }

  private fetchWhalesDedup(): Promise<CachedResponse | null> {
    const key = "/api/whales-freshen";
    const existing = this.inFlightFetches.get(key);
    if (existing) return existing;

    let pending: Promise<CachedResponse | null>;
    pending = this.fetchWhales().finally(() => {
      if (this.inFlightFetches.get(key) === pending) {
        this.inFlightFetches.delete(key);
      }
    });

    this.inFlightFetches.set(key, pending);
    return pending;
  }

  private async saveChunked(endpoint: string, cached: CachedResponse): Promise<void> {
    const key = `cache:${endpoint}`;
    const raw = cached.data;
    const previousChunkCount = await this.ctx.storage.get<number>(`${key}:chunks`);

    await this.ctx.storage.put(`${key}:meta`, { timestamp: cached.timestamp, status: cached.status });

    if (raw.length <= STORAGE_CHUNK_SIZE) {
      await this.ctx.storage.put(key, raw);
      await this.ctx.storage.delete(`${key}:chunks`);
      const staleKeys = collectStaleChunkKeys(key, previousChunkCount, 0);
      for (const batch of chunkEntries(staleKeys, MAX_DO_STORAGE_BATCH_ENTRIES)) {
        await this.ctx.storage.delete(batch);
      }
      return;
    }

    const numChunks = Math.ceil(raw.length / STORAGE_CHUNK_SIZE);
    const puts: Record<string, unknown> = {
      [`${key}:chunks`]: numChunks,
    };
    for (let i = 0; i < numChunks; i++) {
      puts[`${key}:${i}`] = raw.slice(i * STORAGE_CHUNK_SIZE, (i + 1) * STORAGE_CHUNK_SIZE);
    }
    for (const batch of chunkEntries(Object.entries(puts), MAX_DO_STORAGE_BATCH_ENTRIES)) {
      await this.ctx.storage.put(Object.fromEntries(batch));
    }
    await this.ctx.storage.delete(key);
    const staleKeys = collectStaleChunkKeys(key, previousChunkCount, numChunks);
    for (const batch of chunkEntries(staleKeys, MAX_DO_STORAGE_BATCH_ENTRIES)) {
      await this.ctx.storage.delete(batch);
    }
  }

  private async loadChunked(endpoint: string): Promise<CachedResponse | null> {
    const key = `cache:${endpoint}`;
    const meta = await this.ctx.storage.get<{ timestamp: number; status: number }>(`${key}:meta`);
    if (!meta) {
      const stored = await this.ctx.storage.get<CachedResponse>(key);
      return stored ?? null;
    }

    const numChunks = await this.ctx.storage.get<number>(`${key}:chunks`);
    let data: string;

    if (numChunks && numChunks > 0) {
      const keysToLoad: string[] = [];
      for (let i = 0; i < numChunks; i++) keysToLoad.push(`${key}:${i}`);
      const chunksMap = new Map<string, string>();
      for (const batch of chunkEntries(keysToLoad, MAX_DO_STORAGE_BATCH_ENTRIES)) {
        const result = await this.ctx.storage.get<string>(batch);
        for (const [chunkKey, chunkValue] of result.entries()) {
          chunksMap.set(chunkKey, chunkValue);
        }
      }
      const parts: string[] = [];
      for (let i = 0; i < numChunks; i++) {
        const chunk = chunksMap.get(`${key}:${i}`);
        if (!chunk) return null;
        parts.push(chunk);
      }
      data = parts.join("");
    } else {
      const stored = await this.ctx.storage.get<string>(key);
      if (!stored) return null;
      data = stored;
    }

    return { data, timestamp: meta.timestamp, status: meta.status };
  }

  private async deleteChunked(endpoint: string): Promise<void> {
    const key = `cache:${endpoint}`;
    await this.ctx.storage.delete(key);
    await this.ctx.storage.delete(`${key}:meta`);
    const numChunks = await this.ctx.storage.get<number>(`${key}:chunks`);
    if (numChunks) {
      const deleteKeys = [`${key}:chunks`];
      for (let i = 0; i < numChunks; i++) deleteKeys.push(`${key}:${i}`);
      await this.ctx.storage.delete(deleteKeys);
    }
  }
}
