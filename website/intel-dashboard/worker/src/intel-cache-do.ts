import { DurableObject } from "cloudflare:workers";

interface Env {
  BACKEND_URL: string;
}

interface CachedResponse {
  data: string;
  timestamp: number;
  status: number;
}

const REFRESH_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes
const FETCH_TIMEOUT_MS = 45_000; // 45s timeout for backend
const ENDPOINTS = ["/api/intel", "/api/briefings", "/api/telegram", "/api/air-sea"];
const ENDPOINT_MAX_AGE_MS: Record<string, number> = {
  "/api/intel": 120_000,
  "/api/briefings": 5 * 60_000,
  "/api/telegram": 75_000,
  "/api/air-sea": 90_000,
};
const ENDPOINT_STALE_WINDOW_MS: Record<string, number> = {
  "/api/intel": 15 * 60_000,
  "/api/briefings": 45 * 60_000,
  "/api/telegram": 10 * 60_000,
  "/api/air-sea": 12 * 60_000,
};
const BACKGROUND_REFRESH_COOLDOWN_MS = 12_000;
const STORAGE_CHUNK_SIZE = 900_000;
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



export class IntelCacheDO extends DurableObject<Env> {
  private cache: Map<string, CachedResponse> = new Map();
  private refreshing = false;
  private inFlightFetches: Map<string, Promise<CachedResponse | null>> = new Map();
  private backgroundRefreshAfter: Map<string, number> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    this.ctx.blockConcurrencyWhile(async () => {
      // Load all endpoints from storage IN PARALLEL to minimize blockConcurrencyWhile time
      // (blockConcurrencyWhile has a 30s timeout — sequential loads risk hitting it)
      const allEndpoints = [...ENDPOINTS, "/api/whales", CHAT_HISTORY_PATH];
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
      if (!currentAlarm) {
        await this.ctx.storage.setAlarm(Date.now() + 5_000);
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Force cache bust — wipe all cached data and refresh immediately
    if (path === "/api/cache-bust") {
      console.log("[IntelCacheDO] Cache bust requested — wiping all cached data");
      this.cache.clear();
      for (const endpoint of ENDPOINTS) {
        await this.deleteChunked(endpoint);
      }
      await this.deleteChunked("/api/whales");
      await this.clearChatHistoryCacheVariants();

      const errors: string[] = [];
      try {
        await this.refreshAll();
      } catch (err: any) {
        errors.push(`refreshAll: ${err?.message ?? String(err)}`);
      }

      const cacheInfo: Record<string, unknown> = {};
      for (const [k, v] of this.cache.entries()) {
        cacheInfo[k] = {
          timestamp: new Date(v.timestamp).toISOString(),
          sizeBytes: v.data.length,
          status: v.status,
        };
      }

      return new Response(
        JSON.stringify({ status: "cache_busted", refreshed: cacheInfo, errors: errors.length ? errors : undefined, cacheKeys: [...this.cache.keys()] }),
        { headers: { "Content-Type": "application/json" } },
      );
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

      return new Response(
        JSON.stringify({
          status: "ok",
          cached: cacheInfo,
          nextAlarm: currentAlarm
            ? new Date(currentAlarm).toISOString()
            : null,
          refreshing: this.refreshing,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
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
          return new Response(cached.data, {
            status: cached.status,
            headers: {
              "Content-Type": "application/json",
              "X-Cache-Source": "durable-object-memory",
              "X-Cache-Age": String(Math.round(ageMs / 1000)),
            },
          });
        }

        if (ageMs < staleWindowMs) {
          this.scheduleBackgroundRefresh(path);
          return new Response(cached.data, {
            status: cached.status,
            headers: {
              "Content-Type": "application/json",
              "X-Cache-Source": "durable-object-stale-revalidate",
              "X-Cache-Age": String(Math.round(ageMs / 1000)),
            },
          });
        }
      }

      const fresh = await this.fetchEndpointDedup(path);
      if (fresh) {
        return new Response(fresh.data, {
          status: fresh.status,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-fresh",
          },
        });
      }

      if (cached) {
        return new Response(cached.data, {
          status: cached.status,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-stale-if-error",
            "X-Cache-Age": String(Math.round((Date.now() - cached.timestamp) / 1000)),
          },
        });
      }

      return new Response(
        JSON.stringify({ error: "Data not yet available. First refresh in progress." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response("Not Found", { status: 404 });
  }

  async alarm(): Promise<void> {
    console.log("[IntelCacheDO] Alarm fired — proactively refreshing all endpoints");
    await this.refreshAll();

    // Schedule next alarm
    await this.ctx.storage.setAlarm(Date.now() + REFRESH_INTERVAL_MS);
  }

  private async refreshAll(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      // Fetch all endpoints in parallel
      const results = await Promise.allSettled(
        ENDPOINTS.map((endpoint) => this.fetchEndpointDedup(endpoint)),
      );

      const success = results.filter(
        (r) => r.status === "fulfilled" && r.value !== null,
      ).length;
      console.log(
        `[IntelCacheDO] Refreshed ${success}/${ENDPOINTS.length} endpoints`,
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
        return new Response(cached.data, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-memory",
            "X-Cache-Age": String(Math.round(ageMs / 1000)),
          },
        });
      }

      if (ageMs < WHALE_STALE_WINDOW_MS) {
        this.scheduleBackgroundRefresh("/api/whales-freshen");
        return new Response(cached.data, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-stale-revalidate",
            "X-Cache-Age": String(Math.round(ageMs / 1000)),
          },
        });
      }
    }

    const fresh = await this.fetchWhalesDedup();
    if (fresh) {
      return new Response(fresh.data, {
        status: fresh.status,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Source": "durable-object-fresh",
        },
      });
    }

    if (cached) {
      return new Response(cached.data, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Source": "durable-object-stale-if-error",
          "X-Cache-Age": String(Math.round((Date.now() - cached.timestamp) / 1000)),
        },
      });
    }

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
    const params = new URLSearchParams({
      sessions: String(sessions),
      messages: String(messages),
    });
    return `${CHAT_HISTORY_PATH}?${params.toString()}`;
  }

  private async clearChatHistoryCacheVariants(): Promise<void> {
    const keysToDelete = new Set<string>();

    for (const key of this.cache.keys()) {
      if (key.startsWith(CHAT_HISTORY_PATH)) {
        keysToDelete.add(key);
      }
    }

    const storagePrefix = `cache:${CHAT_HISTORY_PATH}`;
    const stored = await this.ctx.storage.list({ prefix: storagePrefix });
    for (const key of stored.keys()) {
      keysToDelete.add(String(key).replace(/^cache:/, ""));
    }

    for (const endpoint of keysToDelete) {
      this.cache.delete(endpoint);
      await this.deleteChunked(endpoint);
    }
  }

  private async handleChatHistory(url: URL): Promise<Response> {
    const cacheKey = this.buildChatHistoryCacheKey(url);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const ageMs = Date.now() - cached.timestamp;
      if (ageMs < CHAT_HISTORY_REFRESH_MS) {
        return new Response(cached.data, {
          status: cached.status,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-memory",
            "X-Cache-Age": String(Math.round(ageMs / 1000)),
          },
        });
      }

      if (ageMs < CHAT_HISTORY_STALE_WINDOW_MS) {
        this.scheduleBackgroundRefresh(cacheKey, 0);
        return new Response(cached.data, {
          status: cached.status,
          headers: {
            "Content-Type": "application/json",
            "X-Cache-Source": "durable-object-stale-revalidate",
            "X-Cache-Age": String(Math.round(ageMs / 1000)),
          },
        });
      }
    }

    const fresh = await this.fetchEndpointDedup(cacheKey, 0);
    if (fresh) {
      return new Response(fresh.data, {
        status: fresh.status,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Source": "durable-object-fresh",
        },
      });
    }

    if (cached) {
      return new Response(cached.data, {
        status: cached.status,
        headers: {
          "Content-Type": "application/json",
          "X-Cache-Source": "durable-object-stale-if-error",
          "X-Cache-Age": String(Math.round((Date.now() - cached.timestamp) / 1000)),
        },
      });
    }

    return new Response(
      JSON.stringify({ error: "Chat history unavailable" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  private async fetchEndpoint(
    endpoint: string,
    retries = 1,
  ): Promise<CachedResponse | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const backendUrl = `${this.env.BACKEND_URL}${endpoint}`;
        if (attempt === 0) {
          console.log(`[IntelCacheDO] Fetching ${backendUrl}`);
        } else {
          console.log(`[IntelCacheDO] Retry ${attempt} for ${backendUrl}`);
        }

        const res = await fetch(backendUrl, {
          headers: { "User-Agent": "PyRoBOT-DO/1.0" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });

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

        this.cache.set(endpoint, cached);
        await this.saveChunked(endpoint, cached);

        console.log(
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
    try {
      const res = await fetch(
        "https://api.whale-alert.io/v1/transactions?min_value=1000000",
        {
          headers: { "Api-Key": "demo" },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        return null;
      }

      const data = await res.json() as { transactions?: Array<Record<string, any>> };
      const alerts = (data.transactions || []).map((tx) => ({
        id: tx.hash || crypto.randomUUID(),
        type: tx.from?.owner_type === "exchange" ? "exchange_flow" : "large_transfer",
        blockchain: tx.blockchain,
        amount: tx.amount,
        amountUSD: tx.amount_usd,
        from: tx.from?.address || "unknown",
        to: tx.to?.address || "unknown",
        timestamp: tx.timestamp,
        txHash: tx.hash,
      }));

      const entry: CachedResponse = {
        data: JSON.stringify(alerts.slice(0, 10)),
        timestamp: Date.now(),
        status: 200,
      };
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

    await this.ctx.storage.put(`${key}:meta`, { timestamp: cached.timestamp, status: cached.status });

    if (raw.length <= STORAGE_CHUNK_SIZE) {
      await this.ctx.storage.put(key, raw);
      await this.ctx.storage.delete(`${key}:chunks`);
      return;
    }

    const numChunks = Math.ceil(raw.length / STORAGE_CHUNK_SIZE);
    await this.ctx.storage.put(`${key}:chunks`, numChunks);
    for (let i = 0; i < numChunks; i++) {
      await this.ctx.storage.put(`${key}:${i}`, raw.slice(i * STORAGE_CHUNK_SIZE, (i + 1) * STORAGE_CHUNK_SIZE));
    }
    await this.ctx.storage.delete(key);
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
      const parts: string[] = [];
      for (let i = 0; i < numChunks; i++) {
        const chunk = await this.ctx.storage.get<string>(`${key}:${i}`);
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
