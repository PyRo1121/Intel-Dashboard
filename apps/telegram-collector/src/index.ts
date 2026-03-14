import { timingSafeEqual, createHmac } from "node:crypto";
import { Container, getContainer } from "@cloudflare/containers";
import { DurableObject } from "cloudflare:workers";
import type { TelegramCollectorBatch } from "@intel-dashboard/shared/telegram-collector.ts";
import { forwardCollectorBatch, signCollectorRequest } from "./edge-client";
import { isCollectorPushBatchPath } from "./routes";
import { normalizeDebugCollectorBatch } from "./debug-batch";
import { buildDefaultCollectorControlState, isStoredCollectorControlState, normalizeCollectorControlUpdate, normalizeWatchedChannels } from "./control-state";
import type { CollectorControlState } from "@intel-dashboard/shared/telegram-collector-control.ts";

export interface Env {
  TELEGRAM_COLLECTOR: DurableObjectNamespace<TelegramCollectorContainer>;
  TELEGRAM_COLLECTOR_CONTROL: DurableObjectNamespace<TelegramCollectorControlDO>;
  COLLECTOR_EDGE_URL?: string;
  COLLECTOR_EDGE_PATH?: string;
  COLLECTOR_SHARED_SECRET?: string;
  COLLECTOR_FLUSH_INTERVAL_MS?: string;
  TELEGRAM_HOT_CHANNELS?: string;
  TELEGRAM_API_ID?: string;
  TELEGRAM_API_HASH?: string;
  TELEGRAM_SESSION_STRING?: string;
  TELEGRAM_ACCOUNT_ID?: string;
  COLLECTOR_INSTANCE_GENERATION?: string;
  COLLECTOR_SELF_URL?: string;
}


export class TelegramCollectorControlDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const key = "collector-state";
    const adminNonceTtlSeconds = 10 * 60;
    const adminRateWindowMs = 60_000;
    const adminRateLimitPerWindow = 8;
    const defaults = buildDefaultCollectorControlState({
      configured: Boolean(this.env.TELEGRAM_API_ID && this.env.TELEGRAM_API_HASH && this.env.TELEGRAM_SESSION_STRING),
      missingConfig: [],
      watchedChannels: normalizeWatchedChannels((this.env.TELEGRAM_HOT_CHANNELS || "").split(/[\n,]+/).map((part) => part.split("|")[0])),
      accountId: this.env.TELEGRAM_ACCOUNT_ID || 'primary',
    });
    if (request.method === "GET" && url.pathname === "/status") {
      const state = await this.ctx.storage.get(key) as Record<string, unknown> | undefined;
      const hasStoredState = isStoredCollectorControlState(state, defaults);
      const normalized = hasStoredState ? normalizeCollectorControlUpdate(state, defaults) : defaults;
      return json({ ok: true, runtime: "collector-control-do", stateSource: hasStoredState ? "stored" : "default", ...normalized });
    }
    if (request.method === "POST" && url.pathname === "/update") {
      const payload = await request.json().catch(() => null);
      if (!payload || typeof payload !== 'object') return json({ error: 'Invalid JSON' }, 400);
      const prev = await this.ctx.storage.get(key) as Record<string, unknown> | undefined;
      const base = isStoredCollectorControlState(prev, defaults) ? normalizeCollectorControlUpdate(prev, defaults) : defaults;
      const next = normalizeCollectorControlUpdate(payload, base);
      await this.ctx.storage.put(key, next);
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/reset") {
      await this.ctx.storage.put(key, defaults);
      return json({ ok: true });
    }
    if (request.method === "POST" && url.pathname === "/admin/guard") {
      let payload: {
        scope?: unknown;
        nonce?: unknown;
        timestampMs?: unknown;
        clientIp?: unknown;
      };
      try {
        payload = (await request.json()) as typeof payload;
      } catch {
        return json({ ok: false, reason: "invalid_json" }, 400);
      }

      const scope = typeof payload.scope === "string" ? payload.scope.trim() : "";
      const nonce = typeof payload.nonce === "string" ? payload.nonce.trim() : "";
      const timestampMs = typeof payload.timestampMs === "number" ? payload.timestampMs : Number.NaN;
      const clientIp = typeof payload.clientIp === "string" ? payload.clientIp.trim() : "unknown";

      if (!scope || !nonce || !Number.isFinite(timestampMs)) {
        return json({ ok: false, reason: "invalid_payload" }, 400);
      }

      return this.ctx.blockConcurrencyWhile(async () => {
        const now = Date.now();
        if (Math.abs(now - timestampMs) > CONTROL_REQUEST_MAX_SKEW_MS) {
          return json({ ok: false, reason: "timestamp_out_of_window" }, 409);
        }

        const nonceKey = `admin:nonce:${scope}:${nonce}`;
        const replaySeen = await this.ctx.storage.get<number>(nonceKey);
        if (typeof replaySeen === "number") {
          if (now - replaySeen <= adminNonceTtlSeconds * 1000) {
            return json({ ok: false, reason: "replay_detected" }, 409);
          }
          await this.ctx.storage.delete(nonceKey);
        }

        const window = Math.floor(now / adminRateWindowMs);
        const rateKey = `admin:rl:${scope}:${clientIp}:${window}`;
        const hits = (await this.ctx.storage.get<number>(rateKey)) ?? 0;
        if (hits >= adminRateLimitPerWindow) {
          return json(
            { ok: false, reason: "rate_limited", retryAfterMs: adminRateWindowMs - (now % adminRateWindowMs) },
            429,
          );
        }

        await this.ctx.storage.put(rateKey, hits + 1);
        await this.ctx.storage.put(nonceKey, now);

        return json({ ok: true });
      });
    }
    return json({ error: 'Not Found' }, 404);
  }
}
export class TelegramCollectorContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10m";
  pingEndpoint = "/health";
  enableInternet = true;
  entrypoint = ["node", "/app/src/container-server.mjs"];

  constructor(ctx: DurableObject["ctx"], env: Env) {
    super(ctx, env);
    this.envVars = {
      ...(env.COLLECTOR_EDGE_URL ? { COLLECTOR_EDGE_URL: env.COLLECTOR_EDGE_URL } : {}),
      ...(env.COLLECTOR_EDGE_PATH ? { COLLECTOR_EDGE_PATH: env.COLLECTOR_EDGE_PATH } : {}),
      ...(env.COLLECTOR_SHARED_SECRET ? { COLLECTOR_SHARED_SECRET: env.COLLECTOR_SHARED_SECRET } : {}),
      ...(env.COLLECTOR_FLUSH_INTERVAL_MS ? { COLLECTOR_FLUSH_INTERVAL_MS: env.COLLECTOR_FLUSH_INTERVAL_MS } : {}),
      ...(env.TELEGRAM_HOT_CHANNELS ? { TELEGRAM_HOT_CHANNELS: env.TELEGRAM_HOT_CHANNELS } : {}),
      ...(env.TELEGRAM_API_ID ? { TELEGRAM_API_ID: env.TELEGRAM_API_ID } : {}),
      ...(env.TELEGRAM_API_HASH ? { TELEGRAM_API_HASH: env.TELEGRAM_API_HASH } : {}),
      ...(env.TELEGRAM_SESSION_STRING ? { TELEGRAM_SESSION_STRING: env.TELEGRAM_SESSION_STRING } : {}),
      ...(env.TELEGRAM_ACCOUNT_ID ? { TELEGRAM_ACCOUNT_ID: env.TELEGRAM_ACCOUNT_ID } : {}),
      ...(env.COLLECTOR_SELF_URL ? { COLLECTOR_SELF_URL: env.COLLECTOR_SELF_URL } : {}),
    };
  }
}

const COLLECTOR_WORKER_REVISION = "match-v2";
const COLLECTOR_PROXY_RETRY_MS = 2000;
const COLLECTOR_PROXY_RETRY_ATTEMPTS = 8;
const CONTROL_STATE_STALE_MS = 120000;
const CONTROL_REQUEST_MAX_SKEW_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-collector-revision": COLLECTOR_WORKER_REVISION,
    },
  });
}

function isColdStartContainerError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /container is not running/i.test(message) || /failed to start container/i.test(message) || /network connection lost/i.test(message) || /operation was aborted/i.test(message);
}

async function startCollectorInBackground(container: Pick<CollectorContainerStub, "start">) {
  try {
    if (typeof container.start === 'function') {
      await container.start();
    }
  } catch {
    // Best-effort warm-up only.
  }
}

type CollectorContainerStub = DurableObjectStub<TelegramCollectorContainer>;
type ControlStatusResponse = CollectorControlState & {
  ok: true;
  runtime: "collector-control-do";
  stateSource: "stored" | "default";
};

function getCollectorContainerStub(env: Env): CollectorContainerStub {
  return getContainer(env.TELEGRAM_COLLECTOR, resolveCollectorInstanceName(env));
}

function getCollectorControlStub(env: Env): DurableObjectStub<TelegramCollectorControlDO> {
  return env.TELEGRAM_COLLECTOR_CONTROL.get(env.TELEGRAM_COLLECTOR_CONTROL.idFromName("main"));
}

async function proxyCollectorRequest(container: CollectorContainerStub, request: Request): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < COLLECTOR_PROXY_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await container.fetch(request);
    } catch (error) {
      lastError = error;
      if (!isColdStartContainerError(error) || attempt === COLLECTOR_PROXY_RETRY_ATTEMPTS - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, COLLECTOR_PROXY_RETRY_MS));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('collector unavailable');
}

function buildExpectedCollectorDefaults(env: Env) {
  return buildDefaultCollectorControlState({
    configured: Boolean(env.TELEGRAM_API_ID && env.TELEGRAM_API_HASH && env.TELEGRAM_SESSION_STRING),
    missingConfig: [],
    watchedChannels: normalizeWatchedChannels((env.TELEGRAM_HOT_CHANNELS || "").split(/[\n,]+/).map((part) => part.split("|")[0])),
    accountId: env.TELEGRAM_ACCOUNT_ID || 'primary',
  });
}

async function readControlState(env: Env): Promise<ControlStatusResponse | null> {
  const response = await getCollectorControlStub(env).fetch(new Request("https://do/status"));
  if (!response.ok) return null;
  return await response.json().catch(() => null) as ControlStatusResponse | null;
}

function isControlStateFresh(payload: ControlStatusResponse | null, defaults: ReturnType<typeof buildExpectedCollectorDefaults>): boolean {
  if (!payload || !isStoredCollectorControlState(payload, defaults)) return false;
  const updatedAt = Date.parse(payload.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  const joinedCount = payload.joinedChannels.length;
  return (Date.now() - updatedAt) <= CONTROL_STATE_STALE_MS && joinedCount > 0;
}

async function writeControlState(env: Env, payload: CollectorControlState): Promise<void> {
  await getCollectorControlStub(env).fetch(new Request("https://do/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

async function verifyControlRequestWithNonceGuard(request: Request, env: Env): Promise<boolean> {
  if (!verifyControlRequest(request, env.COLLECTOR_SHARED_SECRET)) {
    return false;
  }
  const timestampMs = Number.parseInt(request.headers.get("X-Admin-Timestamp") || "", 10);
  const nonce = request.headers.get("X-Admin-Nonce") || "";
  const response = await getCollectorControlStub(env).fetch(new Request("https://do/admin/guard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scope: new URL(request.url).pathname,
      nonce,
      timestampMs,
      clientIp: request.headers.get("CF-Connecting-IP") ?? "unknown",
    }),
  }));
  return response.ok;
}

function verifyControlRequest(request: Request, secret: string | undefined): boolean {
  const cleanSecret = (secret || '').trim();
  if (!cleanSecret) return false;
  const timestamp = request.headers.get('X-Admin-Timestamp') || '';
  const nonce = request.headers.get('X-Admin-Nonce') || '';
  const signature = request.headers.get('X-Admin-Signature') || '';
  if (!timestamp || !nonce || !signature) return false;
  const timestampMs = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return false;
  if (Math.abs(Date.now() - timestampMs) > CONTROL_REQUEST_MAX_SKEW_MS) return false;
  const payload = [request.method.toUpperCase(), new URL(request.url).pathname, timestamp, nonce].join('\n');
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', cleanSecret).update(payload).digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function resolveCollectorInstanceName(env: Env): string {
  const fingerprint = [
    env.COLLECTOR_INSTANCE_GENERATION || "",
    env.TELEGRAM_HOT_CHANNELS || "",
    env.TELEGRAM_API_ID || "",
    env.TELEGRAM_ACCOUNT_ID || "",
  ].join("|");
  return `main-${stableHash(fingerprint)}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    console.log("[collector-worker] route", request.method, url.pathname);
    const container = getCollectorContainerStub(env);

    if (url.pathname === "/health") {
      try {
        await startCollectorInBackground(container);
        const response = await proxyCollectorRequest(container, new Request("https://container/health"));
        const next = new Response(response.body, response);
        next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
        return next;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "collector unavailable" }, 503);
      }
    }

    if (url.pathname === "/status/live") {
      try {
        await startCollectorInBackground(container);
        const response = await proxyCollectorRequest(container, new Request("https://container/status"));
        const next = new Response(response.body, response);
        next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
        return next;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "collector unavailable" }, 503);
      }
    }

    if (url.pathname === "/status") {
      const defaults = buildExpectedCollectorDefaults(env);
      const controlPayload = await readControlState(env);
      const joinedCount = controlPayload?.joinedChannels.length ?? 0;
      const controlStateSource = controlPayload?.stateSource ?? null;
      if (controlStateSource === "stored" && isControlStateFresh(controlPayload, defaults) && joinedCount > 0) {
        return json({ ...controlPayload, runtime: "collector-control-do" });
      }
      try {
        await startCollectorInBackground(container);
        const response = await proxyCollectorRequest(container, new Request("https://container/status"));
        const payload = await response.clone().json().catch(() => null) as ControlStatusResponse | null;
        const defaults = buildExpectedCollectorDefaults(env);
        if (payload && typeof payload === 'object' && isStoredCollectorControlState(payload, defaults)) {
          await writeControlState(env, normalizeCollectorControlUpdate(payload, defaults));
        }
        const next = new Response(response.body, response);
        next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
        return next;
      } catch (error) {
        if (controlStateSource === "stored" && controlPayload) {
          return json({ ...(controlPayload || {}), error: error instanceof Error ? error.message : "collector unavailable" }, 200);
        }
        return json({
          ok: false,
          runtime: "collector-control-do",
          stateSource: controlStateSource ?? "default",
          ...(controlPayload || {}),
          error: error instanceof Error ? error.message : "collector unavailable",
        }, 503);
      }
    }

    if (isCollectorPushBatchPath(url.pathname)) {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!(await verifyControlRequestWithNonceGuard(request, env))) {
        return json({ error: "Forbidden" }, 403);
      }
      const payload = parseJsonObject(await request.text());
      if (!payload) {
        return json({ error: "Invalid JSON" }, 400);
      }
      const controlPayload = url.pathname === "/control/push-batch"
        ? normalizeDebugCollectorBatch(payload, env.TELEGRAM_ACCOUNT_ID || "control")
        : (payload as TelegramCollectorBatch);
      if (!controlPayload) {
        return json({ error: "Invalid collector batch" }, 400);
      }
      try {
        const response = await proxyCollectorRequest(container, new Request("https://container/control/push-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(controlPayload),
        }),
      );
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "collector unavailable" }, 503);
      }
    }

    if (url.pathname === "/control/state-update") {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!(await verifyControlRequestWithNonceGuard(request, env))) {
        return json({ error: "Forbidden" }, 403);
      }
      const payload = parseJsonObject(await request.text());
      if (!payload) {
        return json({ error: "Invalid JSON" }, 400);
      }
      const response = await getCollectorControlStub(env).fetch(new Request("https://do/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }));
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    if (url.pathname === "/control/reset-control-state") {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!(await verifyControlRequestWithNonceGuard(request, env))) {
        return json({ error: "Forbidden" }, 403);
      }
      const response = await getCollectorControlStub(env).fetch(new Request("https://do/reset", { method: "POST" }));
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    if (url.pathname === "/control/join-configured-channels") {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!(await verifyControlRequestWithNonceGuard(request, env))) {
        return json({ error: "Forbidden" }, 403);
      }
      try {
        const response = await proxyCollectorRequest(container, new Request("https://container/control/join-configured-channels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "collector unavailable" }, 503);
      }
    }

    return json({ error: "Not Found" }, 404);
  },
};
