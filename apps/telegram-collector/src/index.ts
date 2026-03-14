import { Container, getContainer } from "@cloudflare/containers";
import type { TelegramCollectorBatch } from "@intel-dashboard/shared/telegram-collector.ts";
import { forwardCollectorBatch } from "./edge-client";
import { isCollectorPushBatchPath } from "./routes";
import { normalizeDebugCollectorBatch } from "./debug-batch";
import { hasCollectorControlAccess } from "./control-auth";

export interface Env {
  TELEGRAM_COLLECTOR: DurableObjectNamespace<any>;
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
}

export class TelegramCollectorContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "10m";
  pingEndpoint = "/health";
  entrypoint = ["node", "/app/src/container-server.mjs"];

  constructor(ctx: any, env: Env) {
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
    };
  }
}

const COLLECTOR_WORKER_REVISION = "join-route-v2";

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
    const getCollectorContainer = () =>
      getContainer(env.TELEGRAM_COLLECTOR as any, resolveCollectorInstanceName(env)) as {
        fetch(request: Request): Promise<Response>;
      };

    if (url.pathname === "/health") {
      const container = getCollectorContainer();
      const response = await container.fetch(new Request("https://container/health"));
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    if (url.pathname === "/status") {
      const container = getCollectorContainer();
      const response = await container.fetch(new Request("https://container/status"));
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    if (isCollectorPushBatchPath(url.pathname)) {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!env.COLLECTOR_SHARED_SECRET?.trim()) {
        return json({ error: "Collector shared secret is not configured" }, 503);
      }
      if (!hasCollectorControlAccess(request, env.COLLECTOR_SHARED_SECRET)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const payload = parseJsonObject(await request.text());
      if (!payload) {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (url.pathname === "/control/push-batch") {
        if (!env.COLLECTOR_EDGE_URL || !env.COLLECTOR_SHARED_SECRET) {
          return json({ error: "Collector edge forwarding is not configured" }, 503);
        }
        const batch = normalizeDebugCollectorBatch(payload, env.TELEGRAM_ACCOUNT_ID || "control");
        if (!batch) {
          return json({ error: "Invalid collector batch" }, 400);
        }
        const response = await forwardCollectorBatch({
          edgeUrl: env.COLLECTOR_EDGE_URL,
          edgePath: env.COLLECTOR_EDGE_PATH || "/api/telegram/collector-ingest",
          secret: env.COLLECTOR_SHARED_SECRET,
          batch,
        });
        const text = await response.text();
        return new Response(text, {
          status: response.status,
          headers: {
            "content-type": response.headers.get("content-type") || "application/json",
            "cache-control": "no-store",
          },
        });
      }
      const container = getCollectorContainer();
      const response = await container.fetch(
        new Request("https://container/control/push-batch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload as TelegramCollectorBatch),
        }),
      );
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    if (url.pathname === "/control/join-configured-channels") {
      if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
      }
      if (!env.COLLECTOR_SHARED_SECRET?.trim()) {
        return json({ error: "Collector shared secret is not configured" }, 503);
      }
      if (!hasCollectorControlAccess(request, env.COLLECTOR_SHARED_SECRET)) {
        return json({ error: "Unauthorized" }, 401);
      }
      const container = getCollectorContainer();
      const response = await container.fetch(
        new Request("https://container/control/join-configured-channels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      );
      const next = new Response(response.body, response);
      next.headers.set("x-collector-revision", COLLECTOR_WORKER_REVISION);
      return next;
    }

    return json({ error: "Not Found" }, 404);
  },
};
